import mongoose from "mongoose";
import { Inventory } from "@/models/inventory";
import { InventoryMovements } from "@/models/inventory";
import { Skus } from "@/models/inventory";
import { Locations } from "@/models/inventory";
import {
  MovementType,
  MovementStatus,
  LocationType,
} from "@/models/enums";
import {
  CreateMovementDto,
  ProcessedMovementContext,
  MovementResult,
  StockSnapshot,
  requiresFromLocation,
  requiresToLocation,
  requiresOrderId,
  requiresAdjustmentReason,
  computeAvailableQuantity,
} from "../types/inventory.types";
import { alertService } from "@/services/alert.service";
import { AppError } from "@/utils/AppError";

// TYPES

interface InventoryUpdateResult {
  stockQuantity: number;
  reservedQuantity: number;
}

// MOVEMENT SERVICE

class MovementService {
  // PUBLIC — MAIN ENTRY POINT

  /**
   * createMovement()
   *
   * The single entry point for ALL stock changes in the system.
   * Flow:
   *   1. Validate & enrich the DTO (fetch SKU + Locations)
   *   2. Run business rule checks (sufficient stock, location type guards)
   *   3. Open MongoDB session + transaction
   *   4. Apply stock changes atomically
   *   5. Record the InventoryMovement document
   *   6. Commit transaction
   *   7. Trigger low-stock alert check (outside transaction)
   */
  async createMovement(
    dto: CreateMovementDto,
    performedBy: string
  ): Promise<MovementResult> {
    //  Step 1: Validate & enrich 
    const context = await this.buildContext(dto, performedBy);

    //  Step 2: Pre-transaction business rule checks 
    await this.validateBusinessRules(context);

    //  Step 3–6: Open session and execute atomically 
    const session = await mongoose.startSession();
    let result: MovementResult;

    try {
      result = await session.withTransaction(async () => {
        return await this.executeMovement(context, session);
      });
    } finally {
      await session.endSession();
    }

    //  Step 7: Low-stock alert check (non-blocking, outside transaction) 
    await this.triggerAlertIfNeeded(context);

    return result;
  }

  // STEP 1 — BUILD CONTEXT
  // Fetch and validate all referenced documents before opening a session.
  // Failing early here avoids acquiring a session for invalid data.

  private async buildContext(
    dto: CreateMovementDto,
    performedBy: string
  ): Promise<ProcessedMovementContext> {
    // Fetch SKU
    const sku = await Skus.findOne({
      _id: dto.skuId,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!sku) {
      throw new AppError(`SKU not found or inactive: ${dto.skuId}`, 404);
    }

    // Fetch fromLocation if needed
    let fromLocation: ProcessedMovementContext["fromLocation"] | undefined;
    if (requiresFromLocation(dto.movementType) && dto.fromLocationId) {
      const loc = await Locations.findOne({
        _id: dto.fromLocationId,
        isActive: true,
        isDeleted: false,
      }).lean();

      if (!loc) {
        throw new AppError(`Source location not found or inactive: ${dto.fromLocationId}`, 404);
      }

      fromLocation = {
        _id: loc._id as mongoose.Types.ObjectId,
        name: loc.name,
        type: loc.type,
      };
    }

    // Fetch toLocation if needed
    let toLocation: ProcessedMovementContext["toLocation"] | undefined;
    if (requiresToLocation(dto.movementType) && dto.toLocationId) {
      const loc = await Locations.findOne({
        _id: dto.toLocationId,
        isActive: true,
        isDeleted: false,
      }).lean();

      if (!loc) {
        throw new AppError(`Target location not found or inactive: ${dto.toLocationId}`, 404);
      }

      toLocation = {
        _id: loc._id as mongoose.Types.ObjectId,
        name: loc.name,
        type: loc.type,
      };
    }

    // ── Linkage (Order/Subscription) ───────────────────────────────────
    let orderId: mongoose.Types.ObjectId | undefined;
    let finalQuantity = dto.quantity;

    if (dto.orderId) {
      orderId = new mongoose.Types.ObjectId(dto.orderId);

      // AUTO-SYNC: Fetch the order to verify/get the correct quantity
      const { Orders } = await import("@/models/commerce/orders.model");
      const order = await Orders.findById(orderId).lean();

      if (order) {
        // Find the item in the order that matches this SKU's product and variant
        const orderItem = order.items.find(
          (item: any) =>
            item.productId.toString() === sku.productId.toString() &&
            item.variantType === sku.variantType
        );

        if (!orderItem) {
          throw new AppError(
            `SKU ${sku.skuCode} is not part of Order ${dto.orderId}`,
            400
          );
        }

        // If quantity was missing or wrong, use the order's quantity
        if (!dto.quantity) {
          finalQuantity = orderItem.quantity || 1;
        } else if (dto.quantity !== orderItem.quantity) {
          throw new AppError(
            `Quantity mismatch. Order requires ${orderItem.quantity} units, but you requested ${dto.quantity}.`,
            400
          );
        }
      }
    }

    return {
      movementType: dto.movementType,
      sku: {
        _id: sku._id as mongoose.Types.ObjectId,
        skuCode: sku.skuCode,
        displayName: sku.displayName,
        productId: sku.productId,
        variantType: sku.variantType as any,
      },
      fromLocation,
      toLocation,
      quantity: finalQuantity,
      orderId,
      subscriptionId: dto.subscriptionId
        ? new mongoose.Types.ObjectId(dto.subscriptionId)
        : undefined,
      referenceCode: dto.referenceCode,
      adjustmentReason: dto.adjustmentReason,
      adjustmentNote: dto.adjustmentNote,
      performedBy: new mongoose.Types.ObjectId(performedBy),
    };
  }

  // STEP 2 — BUSINESS RULE VALIDATION
  // Checks that run before the transaction opens.
  // Each check throws a descriptive error on failure.

  private async validateBusinessRules(
    ctx: ProcessedMovementContext
  ): Promise<void> {
    const { movementType, sku, fromLocation, toLocation, quantity } = ctx;

    // Global Check: Locations cannot be the same
    if (
      fromLocation &&
      toLocation &&
      fromLocation._id.equals(toLocation._id)
    ) {
      throw new AppError(
        "Source and destination locations cannot be the same.",
        400
      );
    }

    switch (movementType) {
      //  PURCHASE: must come from a Manufacturer
      case MovementType.PURCHASE: {
        if (fromLocation && fromLocation.type !== LocationType.MANUFACTURER) {
          throw new AppError(
            `Purchase movements must originate from a Manufacturer, got: ${fromLocation.type}`,
            400
          );
        }
        break;
      }

      //  TRANSFER: source must have sufficient available (unreserved) stock
      case MovementType.TRANSFER: {
        if (!fromLocation) break;
        
        // Transfers cannot come from Manufacturers (use Purchase instead)
        if (fromLocation.type === LocationType.MANUFACTURER) {
          throw new AppError(
            "Cannot use TRANSFER for Manufacturer stock. Please use PURCHASE instead.",
            400
          );
        }

        const inv = await this.getInventoryOrThrow(sku._id, fromLocation._id, "Transfer source");
        const available = computeAvailableQuantity(inv.stockQuantity, inv.reservedQuantity);
        
        if (available < quantity) {
          throw new AppError(
            `Insufficient available stock at ${fromLocation.name}. ` +
            `Available: ${available} (Total: ${inv.stockQuantity}, Reserved: ${inv.reservedQuantity}), Requested: ${quantity}`,
            400
          );
        }
        break;
      }

      //  SALE: fulfillment center must have sufficient reserved stock
      case MovementType.SALE: {
        if (!fromLocation) break;
        const inv = await this.getInventoryOrThrow(sku._id, fromLocation._id, "Sale source");
        
        // Sales deduct from RESERVED quantity
        if (inv.reservedQuantity < quantity) {
          throw new AppError(
            `Cannot complete sale at ${fromLocation.name}. ` +
            `Insufficient reserved stock. Reserved: ${inv.reservedQuantity}, Requested: ${quantity}`,
            400
          );
        }
        break;
      }

      //  RESERVATION: must have sufficient available (unreserved) stock 
      case MovementType.RESERVATION: {
        if (!fromLocation) break;

        // Check for duplicate reservation for the same order/subscription
        if (ctx.orderId || ctx.subscriptionId) {
          const existingMatch: any = {
            skuId: sku._id,
            movementType: MovementType.RESERVATION,
          };
          if (ctx.orderId) existingMatch.orderId = ctx.orderId;
          if (ctx.subscriptionId) existingMatch.subscriptionId = ctx.subscriptionId;

          const alreadyReserved = await InventoryMovements.findOne(existingMatch);
          if (alreadyReserved) {
            throw new AppError(
              `Stock has already been reserved for this SKU in ${ctx.orderId ? "order" : "subscription"} ${ctx.orderId || ctx.subscriptionId}`,
              409
            );
          }
        }

        const inv = await this.getInventoryOrThrow(sku._id, fromLocation._id, "Reservation source");
        const available = computeAvailableQuantity(inv.stockQuantity, inv.reservedQuantity);
        
        if (available < quantity) {
          throw new AppError(
            `Insufficient available stock to reserve at ${fromLocation.name}. ` +
            `Available: ${available}, Requested: ${quantity}`,
            400
          );
        }
        break;
      }

      //  RELEASE_RESERVATION: must have sufficient reserved stock to release
      case MovementType.RELEASE_RESERVATION: {
        if (!fromLocation) break;
        const inv = await this.getInventoryOrThrow(
          sku._id,
          fromLocation._id,
          "Release reservation source"
        );
        if (inv.reservedQuantity < quantity) {
          throw new AppError(
            `Cannot release ${quantity} units — only ${inv.reservedQuantity} reserved at ${fromLocation.name}`,
            400
          );
        }
        break;
      }

      //  ADJUSTMENT (deduct): must have sufficient stock 
      case MovementType.ADJUSTMENT: {
        // Only validate for deduction adjustments (fromLocation provided)
        if (!fromLocation) break;
        const inv = await this.getInventoryOrThrow(
          sku._id,
          fromLocation._id,
          "Adjustment location"
        );
        if (inv.stockQuantity < quantity) {
          throw new AppError(
            `Cannot deduct ${quantity} units — only ${inv.stockQuantity} in stock at ${fromLocation.name}`,
            400
          );
        }
        break;
      }

      //  PURCHASE, RETURN: no stock checks needed (adding stock) ─
      case MovementType.PURCHASE:
      case MovementType.RETURN:
        break;
    }
  }

  // STEP 4+5 — EXECUTE MOVEMENT (inside session)
  // Routes to the correct stock operation based on movementType.
  // All Inventory writes and the InventoryMovement insert happen here.

  private async executeMovement(
    ctx: ProcessedMovementContext,
    session: mongoose.ClientSession
  ): Promise<MovementResult> {
    let fromSnapshot: StockSnapshot | undefined;
    let toSnapshot: StockSnapshot | undefined;

    switch (ctx.movementType) {
      //  PURCHASE: add stock to toLocation 
      case MovementType.PURCHASE: {
        const updated = await this.incrementStock(
          ctx.sku._id,
          ctx.toLocation!._id,
          ctx.quantity,
          session
        );
        toSnapshot = this.buildSnapshot(ctx.toLocation!, updated);
        break;
      }

      //  TRANSFER: deduct from source, add to destination 
      case MovementType.TRANSFER: {
        const fromUpdated = await this.decrementStock(
          ctx.sku._id,
          ctx.fromLocation!._id,
          ctx.quantity,
          session
        );
        const toUpdated = await this.incrementStock(
          ctx.sku._id,
          ctx.toLocation!._id,
          ctx.quantity,
          session
        );
        fromSnapshot = this.buildSnapshot(ctx.fromLocation!, fromUpdated);
        toSnapshot = this.buildSnapshot(ctx.toLocation!, toUpdated);
        break;
      }

      //  SALE: deduct both stock and reserved 
      case MovementType.SALE: {
        const updated = await this.decrementStockAndReserved(
          ctx.sku._id,
          ctx.fromLocation!._id,
          ctx.quantity,
          session
        );
        fromSnapshot = this.buildSnapshot(ctx.fromLocation!, updated);
        break;
      }

      //  RETURN: add stock back to warehouse ─
      case MovementType.RETURN: {
        const updated = await this.incrementStock(
          ctx.sku._id,
          ctx.toLocation!._id,
          ctx.quantity,
          session
        );
        toSnapshot = this.buildSnapshot(ctx.toLocation!, updated);
        break;
      }

      //  RESERVATION: increment reservedQuantity only 
      case MovementType.RESERVATION: {
        const updated = await this.incrementReserved(
          ctx.sku._id,
          ctx.fromLocation!._id,
          ctx.quantity,
          session
        );
        fromSnapshot = this.buildSnapshot(ctx.fromLocation!, updated);
        break;
      }

      //  RELEASE_RESERVATION: decrement reservedQuantity only ─
      case MovementType.RELEASE_RESERVATION: {
        const updated = await this.decrementReserved(
          ctx.sku._id,
          ctx.fromLocation!._id,
          ctx.quantity,
          session
        );
        fromSnapshot = this.buildSnapshot(ctx.fromLocation!, updated);
        break;
      }

      //  ADJUSTMENT: add or deduct stock at a single location ─
      case MovementType.ADJUSTMENT: {
        if (ctx.toLocation) {
          // Positive adjustment — add stock
          const updated = await this.incrementStock(
            ctx.sku._id,
            ctx.toLocation._id,
            ctx.quantity,
            session
          );
          toSnapshot = this.buildSnapshot(ctx.toLocation, updated);
        } else {
          // Negative adjustment — deduct stock
          const updated = await this.decrementStock(
            ctx.sku._id,
            ctx.fromLocation!._id,
            ctx.quantity,
            session
          );
          fromSnapshot = this.buildSnapshot(ctx.fromLocation!, updated);
        }
        break;
      }
    }

    //  Record the movement ─
    const [movement] = await InventoryMovements.create(
      [
        {
          movementType: ctx.movementType,
          status: MovementStatus.COMPLETED,
          skuId: ctx.sku._id,
          fromLocationId: ctx.fromLocation?._id ?? null,
          toLocationId: ctx.toLocation?._id ?? null,
          quantity: ctx.quantity,
          orderId: ctx.orderId ?? null,
          subscriptionId: ctx.subscriptionId ?? null,
          referenceCode: ctx.referenceCode ?? null,
          reason: ctx.adjustmentReason ?? null,
          note: ctx.adjustmentNote ?? null,
          snapshot: {
            skuCode: ctx.sku.skuCode,
            skuDisplayName: ctx.sku.displayName,
            fromLocationName: ctx.fromLocation?.name ?? null,
            toLocationName: ctx.toLocation?.name ?? null,
          },
          performedBy: ctx.performedBy,
          stockAfter: {
            fromLocation: fromSnapshot
              ? {
                stockQuantity: fromSnapshot.stockQuantity,
                reservedQuantity: fromSnapshot.reservedQuantity,
                availableQuantity: fromSnapshot.availableQuantity,
              }
              : undefined,
            toLocation: toSnapshot
              ? {
                stockQuantity: toSnapshot.stockQuantity,
                reservedQuantity: toSnapshot.reservedQuantity,
                availableQuantity: toSnapshot.availableQuantity,
              }
              : undefined,
          },
        },
      ],
      { session }
    );

    return {
      movementId: movement._id as mongoose.Types.ObjectId,
      movementType: ctx.movementType,
      status: MovementStatus.COMPLETED,
      skuId: ctx.sku._id,
      quantity: ctx.quantity,
      stockAfter: {
        fromLocation: fromSnapshot,
        toLocation: toSnapshot,
      },
    };
  }

  // ATOMIC INVENTORY OPERATIONS
  // All use findOneAndUpdate with { new: true, upsert: true } so an
  // Inventory record is created automatically on first stock movement.

  /**
   * Increment stockQuantity at a location.
   * Creates the Inventory record if it doesn't exist yet (upsert).
   */
  private async incrementStock(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    const updated = await Inventory.findOneAndUpdate(
      { skuId, locationId },
      { $inc: { stockQuantity: quantity } },
      {
        new: true,
        upsert: true,
        session,
        setDefaultsOnInsert: true,
        select: "stockQuantity reservedQuantity",
      }
    ).lean();

    if (!updated) throw new AppError("Internal error: Failed to update inventory (incrementStock)", 500);
    return updated as InventoryUpdateResult;
  }

  /**
   * Decrement stockQuantity at a location.
   * Uses $inc with negative value — Mongoose min validator catches underflow.
   */
  private async decrementStock(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId,
        locationId,
        stockQuantity: { $gte: quantity }, // atomic underflow guard
      },
      { $inc: { stockQuantity: -quantity } },
      {
        new: true,
        session,
        select: "stockQuantity reservedQuantity",
      }
    ).lean();

    if (!updated) {
      throw new AppError(
        `Insufficient stock or inventory record missing for SKU ${skuId} at location ${locationId}`,
        400
      );
    }
    return updated as InventoryUpdateResult;
  }

  /**
   * Increment reservedQuantity only (RESERVATION).
   * Guard: reserved cannot exceed stock in a single atomic op.
   */
  private async incrementReserved(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    // Use aggregation pipeline update to atomically check reserved + qty <= stock
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId,
        locationId,
        $expr: {
          $lte: [
            { $add: ["$reservedQuantity", quantity] },
            "$stockQuantity",
          ],
        },
      },
      { $inc: { reservedQuantity: quantity } },
      {
        new: true,
        session,
        select: "stockQuantity reservedQuantity",
      }
    ).lean();

    if (!updated) {
      throw new AppError(
        `Cannot reserve ${quantity} units — insufficient available stock or record missing ` +
        `for SKU ${skuId} at location ${locationId}`,
        400
      );
    }
    return updated as InventoryUpdateResult;
  }

  /**
   * Decrement reservedQuantity only (RELEASE_RESERVATION / cancellation).
   */
  private async decrementReserved(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId,
        locationId,
        reservedQuantity: { $gte: quantity }, // atomic underflow guard
      },
      { $inc: { reservedQuantity: -quantity } },
      {
        new: true,
        session,
        select: "stockQuantity reservedQuantity",
      }
    ).lean();

    if (!updated) {
      throw new AppError(
        `Cannot release ${quantity} reserved units — insufficient reserved stock ` +
        `for SKU ${skuId} at location ${locationId}`,
        400
      );
    }
    return updated as InventoryUpdateResult;
  }

  /**
   * Decrement both stockQuantity AND reservedQuantity atomically (SALE).
   * This is what happens when a fulfillment partner ships an order.
   */
  private async decrementStockAndReserved(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId,
        locationId,
        stockQuantity: { $gte: quantity },
        reservedQuantity: { $gte: quantity },
      },
      {
        $inc: {
          stockQuantity: -quantity,
          reservedQuantity: -quantity,
        },
      },
      {
        new: true,
        session,
        select: "stockQuantity reservedQuantity",
      }
    ).lean();

    if (!updated) {
      throw new AppError(
        `Cannot complete sale of ${quantity} units — ` +
        `insufficient stock or reserved quantity for SKU ${skuId} at location ${locationId}`,
        400
      );
    }
    return updated as InventoryUpdateResult;
  }

  // HELPERS

  /**
   * Fetch an Inventory record or throw a descriptive error.
   * Used in pre-transaction business rule checks.
   */
  private async getInventoryOrThrow(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    label: string
  ): Promise<{ stockQuantity: number; reservedQuantity: number }> {
    const inv = await Inventory.findOne(
      { skuId, locationId, isDeleted: false },
      { stockQuantity: 1, reservedQuantity: 1 }
    ).lean();

    if (!inv) {
      throw new AppError(
        `No inventory record found for ${label} — ` +
        `SKU ${skuId} has never been stocked at location ${locationId}`,
        404
      );
    }

    return inv as { stockQuantity: number; reservedQuantity: number };
  }

  /**
   * Build a StockSnapshot from a location context + updated inventory counts.
   */
  private buildSnapshot(
    location: { _id: mongoose.Types.ObjectId; name: string },
    updated: InventoryUpdateResult
  ): StockSnapshot {
    return {
      locationId: location._id,
      locationName: location.name,
      stockQuantity: updated.stockQuantity,
      reservedQuantity: updated.reservedQuantity,
      availableQuantity: computeAvailableQuantity(
        updated.stockQuantity,
        updated.reservedQuantity
      ),
    };
  }

  /**
   * Trigger a low-stock alert check after stock-reducing movements.
   * Runs outside the transaction — a failed alert never rolls back stock.
   */
  private async triggerAlertIfNeeded(
    ctx: ProcessedMovementContext
  ): Promise<void> {
    const stockReducingTypes: MovementType[] = [
      MovementType.TRANSFER,
      MovementType.SALE,
      MovementType.RESERVATION,
      MovementType.ADJUSTMENT,
    ];

    if (!stockReducingTypes.includes(ctx.movementType)) return;

    const locationId = ctx.fromLocation?._id ?? ctx.toLocation?._id;
    if (!locationId) return;

    try {
      await alertService.checkLowStock(ctx.sku._id, locationId);
    } catch (err) {
      // Alert failure must never crash the movement response
      console.error("[MovementService] Alert check failed (non-fatal):", err);
    }
  }
}

// EXPORT SINGLETON

export const movementService = new MovementService();