import mongoose from "mongoose";
import { Orders } from "@/models/commerce/orders.model";
import { Subscriptions } from "@/models/commerce/subscriptions.model";
import { SubscriptionStatus, ProductVariant } from "@/models/enums";
import { Inventory } from "@/models/inventory";
import { InventoryMovements } from "@/models/inventory";
import { Skus } from "@/models/inventory";
import { Locations } from "@/models/inventory";
import {
  MovementType,
  MovementStatus,
  LocationType,
  AdjustmentDirection,
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
import { MovementLocationRules } from "@/constants/inventory.constants";
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
        } else if (dto.quantity > orderItem.quantity!) {
          throw new AppError(
            `Requested quantity (${dto.quantity}) exceeds order item quantity (${orderItem.quantity}) for SKU ${sku.skuCode}`,
            400
          );
        }
      }
    }
    if (dto.subscriptionId) {
      const subscriptionObjectId = new mongoose.Types.ObjectId(dto.subscriptionId);
      const subscription = await Subscriptions.findById(subscriptionObjectId).lean();

      if (!subscription) {
        throw new AppError(`Subscription not found: ${dto.subscriptionId}`, 404);
      }

      // Subscription must be active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new AppError(
          `Subscription ${dto.subscriptionId} is not active. Status: ${subscription.status}`,
          400
        );
      }

      // Find the item in subscription.items that matches this SKU's product
      const subscriptionItem = subscription.items.find(
        (item: any) => item.productId.toString() === sku.productId.toString()
      );

      if (!subscriptionItem) {
        throw new AppError(
          `SKU ${sku.skuCode} (product ${sku.productId}) is not part of subscription ${dto.subscriptionId}`,
          400
        );
      }

      // Business rule: all subscription items are SACHETS
      // Enforce this at the service layer since it is not stored on the document
      if (sku.variantType !== ProductVariant.SACHETS) {
        throw new AppError(
          `Subscription movements are only allowed for SACHETS. ` +
          `SKU ${sku.skuCode} is a ${sku.variantType}`,
          400
        );
      }

      // Use capsuleCount as quantity if not provided
      if (!dto.quantity) {
        finalQuantity = subscriptionItem.capsuleCount || 1;
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
      customerId: dto.customerId
        ? new mongoose.Types.ObjectId(dto.customerId)
        : undefined,
      referenceCode: dto.referenceCode,
      adjustmentDirection: dto.adjustmentDirection,
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

    // ── Location Validation Matrix Check ──────────────────────────────
    const rule = MovementLocationRules[movementType];
    if (rule) {
      if (fromLocation && !rule.allowedSources.includes(fromLocation.type)) {
        throw new AppError(
          `Invalid routing for ${movementType}: Cannot originate from ${fromLocation.type}. Allowed: ${rule.allowedSources.join(", ")}`,
          400
        );
      }
      if (toLocation && !rule.allowedDestinations.includes(toLocation.type)) {
        throw new AppError(
          `Invalid routing for ${movementType}: Cannot arrive at ${toLocation.type}. Allowed: ${rule.allowedDestinations.join(", ")}`,
          400
        );
      }
      if (rule.requiresSameLocation && fromLocation && toLocation && !fromLocation._id.equals(toLocation._id)) {
        throw new AppError(`${movementType} must occur within the same location.`, 400);
      }
    }

    // Global Check: Locations cannot be the same (Except for reservations)
    if (
      !rule?.requiresSameLocation &&
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
      //  PURCHASE: Handled by Matrix
      case MovementType.PURCHASE:
        break;

      //  TRANSFER: source must have sufficient available (unreserved) stock
      case MovementType.TRANSFER: {
        if (!fromLocation) break;

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
        if (!ctx.orderId && !ctx.subscriptionId) {
          throw new AppError(
            "Sale movements must be linked to an orderId or subscriptionId",
            400
          );
        }
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

      case MovementType.ADJUSTMENT: {
        if (!ctx.adjustmentDirection) {
          throw new AppError("adjustmentDirection is required for Adjustment movements", 400);
        }
        if (ctx.adjustmentDirection === AdjustmentDirection.DECREASE) {
          if (!fromLocation) {
            throw new AppError("fromLocationId is required for Decrease adjustment", 400);
          }
          const inv = await this.getInventoryOrThrow(sku._id, fromLocation._id, "Adjustment location");
          const available = computeAvailableQuantity(inv.stockQuantity, inv.reservedQuantity);
          if (available < quantity) {
            throw new AppError(
              `Cannot deduct ${quantity} units — only ${available} available ` +
              `(stock: ${inv.stockQuantity}, reserved: ${inv.reservedQuantity}) at ${fromLocation.name}`,
              400
            );
          }
        } else {
          if (!toLocation) {
            throw new AppError("toLocationId is required for Increase adjustment", 400);
          }
        }
        break;
      }

      //  PURCHASE, RETURN: no stock checks needed (adding stock) ─
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
    type SnapshotsGroup = { before: StockSnapshot; delta: StockSnapshot; after: StockSnapshot };
    let fromSnapshots: SnapshotsGroup | undefined;
    let toSnapshots: SnapshotsGroup | undefined;

    switch (ctx.movementType) {
      //  PURCHASE: add stock to toLocation 
      case MovementType.PURCHASE: {
        const updated = await this.incrementStock(
          ctx.sku._id,
          ctx.toLocation!._id,
          ctx.quantity,
          session
        );
        toSnapshots = this.buildSnapshots(ctx.toLocation!, updated, ctx.quantity, 0);
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
        fromSnapshots = this.buildSnapshots(ctx.fromLocation!, fromUpdated, -ctx.quantity, 0);
        toSnapshots = this.buildSnapshots(ctx.toLocation!, toUpdated, ctx.quantity, 0);
        break;
      }

      //  SALE: deduct both stock and reserved 
      case MovementType.SALE: {
        const matchCondition: any = {};
        if (ctx.orderId) matchCondition.orderId = ctx.orderId;
        else if (ctx.subscriptionId) matchCondition.subscriptionId = ctx.subscriptionId;

        const reservation = await InventoryMovements.findOne(
          {
            movementType: MovementType.RESERVATION,
            status: MovementStatus.COMPLETED,
            skuId: ctx.sku._id,
            fromLocationId: ctx.fromLocation!._id,
            ...matchCondition,
          },
          null,
          { session }
        );

        if (!reservation || reservation.quantity < ctx.quantity) {
          throw new AppError(
            `Hard block: SALE operation failed. No sufficient prior RESERVATION found for SKU ${ctx.sku.skuCode} linked to the provided order/subscription.`,
            409
          );
        }

        const updated = await this.decrementStockAndReserved(
          ctx.sku._id,
          ctx.fromLocation!._id,
          ctx.quantity,
          session
        );
        fromSnapshots = this.buildSnapshots(ctx.fromLocation!, updated, -ctx.quantity, -ctx.quantity);
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
        toSnapshots = this.buildSnapshots(ctx.toLocation!, updated, ctx.quantity, 0);
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
        fromSnapshots = this.buildSnapshots(ctx.fromLocation!, updated, 0, ctx.quantity);
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
        fromSnapshots = this.buildSnapshots(ctx.fromLocation!, updated, 0, -ctx.quantity);
        break;
      }

      case MovementType.ADJUSTMENT: {
        if (ctx.adjustmentDirection === AdjustmentDirection.INCREASE) {
          const updated = await this.incrementStock(
            ctx.sku._id, ctx.toLocation!._id, ctx.quantity, session
          );
          toSnapshots = this.buildSnapshots(ctx.toLocation!, updated, ctx.quantity, 0);
        } else {
          const updated = await this.decrementAvailableStock(
            ctx.sku._id, ctx.fromLocation!._id, ctx.quantity, session
          );
          fromSnapshots = this.buildSnapshots(ctx.fromLocation!, updated, -ctx.quantity, 0);
        }
        break;
      }
    }

    const idempotencyKey = this.generateIdempotencyKey(ctx);

    try {
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
            customerId: ctx.customerId ?? null,
            referenceCode: ctx.referenceCode ?? null,
            reason: ctx.adjustmentReason ?? null,
            note: ctx.adjustmentNote ?? null,
            idempotencyKey,
            snapshot: {
              skuCode: ctx.sku.skuCode,
              skuDisplayName: ctx.sku.displayName,
              fromLocationName: ctx.fromLocation?.name ?? null,
              toLocationName: ctx.toLocation?.name ?? null,
            },
            performedBy: ctx.performedBy,
            stockBefore: {
              fromLocation: fromSnapshots?.before,
              toLocation: toSnapshots?.before,
            },
            stockDelta: {
              fromLocation: fromSnapshots?.delta,
              toLocation: toSnapshots?.delta,
            },
            stockAfter: {
              fromLocation: fromSnapshots?.after,
              toLocation: toSnapshots?.after,
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
        stockBefore: {
          fromLocation: fromSnapshots?.before,
          toLocation: toSnapshots?.before,
        },
        stockDelta: {
          fromLocation: fromSnapshots?.delta,
          toLocation: toSnapshots?.delta,
        },
        stockAfter: {
          fromLocation: fromSnapshots?.after,
          toLocation: toSnapshots?.after,
        },
      };
    } catch (error: any) {
      if (error.code === 11000 && error.keyPattern?.idempotencyKey && idempotencyKey) {
        const existing = await InventoryMovements.findOne({ idempotencyKey }).lean();
        if (existing) {
          const buildSnapshotFromDb = (locDb?: any, locId?: any, locName?: string) => {
            if (!locDb || locDb.stockQuantity == null) return undefined;
            return {
              locationId: locId,
              locationName: locName || "",
              stockQuantity: locDb.stockQuantity,
              reservedQuantity: locDb.reservedQuantity,
              availableQuantity: locDb.stockQuantity - locDb.reservedQuantity,
            };
          };

          return {
            movementId: existing._id as mongoose.Types.ObjectId,
            movementType: existing.movementType,
            status: MovementStatus.COMPLETED,
            skuId: existing.skuId as mongoose.Types.ObjectId,
            quantity: existing.quantity,
            stockBefore: {
              fromLocation: buildSnapshotFromDb(existing.stockBefore?.fromLocation, existing.fromLocationId, existing.snapshot?.fromLocationName),
              toLocation: buildSnapshotFromDb(existing.stockBefore?.toLocation, existing.toLocationId, existing.snapshot?.toLocationName),
            },
            stockDelta: {
              fromLocation: buildSnapshotFromDb(existing.stockDelta?.fromLocation, existing.fromLocationId, existing.snapshot?.fromLocationName),
              toLocation: buildSnapshotFromDb(existing.stockDelta?.toLocation, existing.toLocationId, existing.snapshot?.toLocationName),
            },
            stockAfter: {
              fromLocation: buildSnapshotFromDb(existing.stockAfter?.fromLocation, existing.fromLocationId, existing.snapshot?.fromLocationName),
              toLocation: buildSnapshotFromDb(existing.stockAfter?.toLocation, existing.toLocationId, existing.snapshot?.toLocationName),
            },
          };
        }
      }
      throw error;
    }
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

  /**
   * Decrement stockQuantity against computed available stock (ADJUSTMENT DECREASE).
   */
  private async decrementAvailableStock(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    quantity: number,
    session: mongoose.ClientSession
  ): Promise<InventoryUpdateResult> {
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId,
        locationId,
        $expr: {
          $gte: [
            { $subtract: ["$stockQuantity", "$reservedQuantity"] },
            quantity
          ]
        }
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
        `Insufficient available stock for adjustment. Stock is either too low or currently reserved for SKU ${skuId} at location ${locationId}`,
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
   * Build StockSnapshots (before, delta, after) from a location context + updated inventory counts + deltas.
   */
  private buildSnapshots(
    location: { _id: mongoose.Types.ObjectId; name: string },
    updated: InventoryUpdateResult,
    deltaStock: number,
    deltaReserved: number
  ): { before: StockSnapshot; delta: StockSnapshot; after: StockSnapshot } {
    const delta = {
      locationId: location._id,
      locationName: location.name,
      stockQuantity: deltaStock,
      reservedQuantity: deltaReserved,
      availableQuantity: deltaStock - deltaReserved,
    };
    const after = {
      locationId: location._id,
      locationName: location.name,
      stockQuantity: updated.stockQuantity,
      reservedQuantity: updated.reservedQuantity,
      availableQuantity: computeAvailableQuantity(updated.stockQuantity, updated.reservedQuantity),
    };
    const before = {
      locationId: location._id,
      locationName: location.name,
      stockQuantity: updated.stockQuantity - deltaStock,
      reservedQuantity: updated.reservedQuantity - deltaReserved,
      availableQuantity: computeAvailableQuantity(
        updated.stockQuantity - deltaStock,
        updated.reservedQuantity - deltaReserved
      ),
    };
    return { before, delta, after };
  }

  private generateIdempotencyKey(ctx: ProcessedMovementContext): string | undefined {
    const { movementType, sku, fromLocation, toLocation, orderId, subscriptionId, customerId, referenceCode, quantity } = ctx;
    const link = orderId?.toString() || subscriptionId?.toString() || customerId?.toString() || "NOLINK";

    switch (movementType) {
      case MovementType.RESERVATION:
          if (subscriptionId) {
            // Subscription renewal — key per subscription + SKU + location + month
            const period = new Date().toISOString().slice(0, 7); // YYYY-MM
            return `RES:SUB:${subscriptionId}:${sku._id}:${fromLocation?._id}:${period}`;
          }
        return `RES:${link}:${sku._id}:${fromLocation?._id}`;
      case MovementType.RELEASE_RESERVATION:
        return `REL:${link}:${sku._id}:${fromLocation?._id}`;
      case MovementType.SALE:
        return `SALE:${link}:${sku._id}:${fromLocation?._id}:QTY${quantity}`;
      case MovementType.TRANSFER:
        if (referenceCode) {
          return `TX:${referenceCode}:${sku._id}:${fromLocation?._id}:${toLocation?._id}`;
        }
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * Trigger a low-stock alert check after stock-reducing movements.
   * Runs outside the transaction — a failed alert never rolls back stock.
   */
  private async triggerAlertIfNeeded(ctx: ProcessedMovementContext): Promise<void> {
    const stockReducingTypes: MovementType[] = [
      MovementType.TRANSFER,
      MovementType.SALE,
      MovementType.RESERVATION,
    ];

    const isReducingAdjustment =
      ctx.movementType === MovementType.ADJUSTMENT &&
      ctx.adjustmentDirection === AdjustmentDirection.DECREASE;

    if (!stockReducingTypes.includes(ctx.movementType) && !isReducingAdjustment) return;

    const locationId = ctx.fromLocation?._id;
    if (!locationId) return;

    try {
      await alertService.checkLowStock(ctx.sku._id, locationId);
    } catch (err) {
      console.error("[MovementService] Alert check failed (non-fatal):", err);
    }
  }
}

// EXPORT SINGLETON

export const movementService = new MovementService();