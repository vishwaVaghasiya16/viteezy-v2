import mongoose from "mongoose";
import { Inventory } from "@/models/inventory";
import { Skus } from "@/models/inventory";
import { Locations } from "@/models/inventory";
import { LowStockAlert } from "../types/inventory.types";
import { computeAvailableQuantity, computeIsLowStock } from "../types/inventory.types";

class AlertService {
  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * checkLowStock()
   *
   * Called after every stock-reducing movement.
   * Fetches the current Inventory record and fires an alert if
   * availableQuantity <= lowStockThreshold.
   */
  async checkLowStock(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId
  ): Promise<void> {
    const inv = await Inventory.findOne(
      { skuId, locationId, isDeleted: false },
      { stockQuantity: 1, reservedQuantity: 1, lowStockThreshold: 1 }
    ).lean();

    if (!inv) return;

    const available = computeAvailableQuantity(
      inv.stockQuantity,
      inv.reservedQuantity
    );

    if (!computeIsLowStock(available, inv.lowStockThreshold) && available > 0) {
      return; // stock is fine — nothing to do
    }

    // Build full alert payload
    const alert = await this.buildAlertPayload(
      skuId,
      locationId,
      available,
      inv.lowStockThreshold
    );

    if (!alert) return;

    // Dispatch
    await this.dispatch(alert);
  }

  /**
   * checkAllLowStock()
   *
   * Scans the entire Inventory collection for items at or below threshold.
   * Useful for a scheduled job (cron) or a manual admin trigger.
   * Returns all alerts found — does NOT dispatch them (caller decides).
   */
  async checkAllLowStock(): Promise<LowStockAlert[]> {
    // Find all inventory records where available <= threshold
    // Since availableQuantity is a virtual, we use $expr in the query
    const records = await Inventory.aggregate([
      {
        $match: { isDeleted: false },
      },
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $match: {
          $expr: {
            $lte: ["$availableQuantity", "$lowStockThreshold"],
          },
        },
      },
      {
        $lookup: {
          from: "inventory_skus",
          localField: "skuId",
          foreignField: "_id",
          as: "sku",
        },
      },
      {
        $lookup: {
          from: "inventory_locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: { path: "$sku", preserveNullAndEmptyArrays: false },
      },
      {
        $unwind: { path: "$location", preserveNullAndEmptyArrays: false },
      },
      {
        $project: {
          skuId: "$sku._id",
          skuCode: "$sku.skuCode",
          displayName: "$sku.displayName",
          variantType: "$sku.variantType",
          locationId: "$location._id",
          locationName: "$location.name",
          locationType: "$location.type",
          availableQuantity: 1,
          lowStockThreshold: 1,
          deficit: {
            $subtract: ["$lowStockThreshold", "$availableQuantity"],
          },
        },
      },
    ]);

    return records as LowStockAlert[];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRIVATE
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Build a full LowStockAlert payload by joining SKU and Location documents.
   */
  private async buildAlertPayload(
    skuId: mongoose.Types.ObjectId,
    locationId: mongoose.Types.ObjectId,
    availableQuantity: number,
    lowStockThreshold: number
  ): Promise<LowStockAlert | null> {
    const [sku, location] = await Promise.all([
      Skus.findById(skuId, {
        skuCode: 1,
        displayName: 1,
        variantType: 1,
      }).lean(),
      Locations.findById(locationId, {
        name: 1,
        type: 1,
      }).lean(),
    ]);

    if (!sku || !location) return null;

    return {
      skuId: sku._id as mongoose.Types.ObjectId,
      skuCode: sku.skuCode,
      displayName: sku.displayName,
      variantType: sku.variantType,
      locationId: location._id as mongoose.Types.ObjectId,
      locationName: location.name,
      locationType: location.type,
      availableQuantity,
      lowStockThreshold,
      deficit: lowStockThreshold - availableQuantity,
    };
  }

  /**
   * dispatch()
   *
   * Sends notifications to all Admin users via the NotificationService.
   */
  private async dispatch(alert: LowStockAlert): Promise<void> {
    const isOutOfStock = alert.availableQuantity <= 0;
    const level = isOutOfStock ? "OUT OF STOCK" : "LOW STOCK";

    // Build the message
    const title = `⚠️ ${level}: ${alert.skuCode}`;
    const message = `${alert.displayName} is running low at ${alert.locationName}. ` +
                    `Only ${alert.availableQuantity} units left (Threshold: ${alert.lowStockThreshold}).`;

    try {
      // 1. Fetch all active Admin users
      const { User } = await import("@/models/core/users.model");
      const { UserRole, NotificationCategory } = await import("@/models/enums");
      const { notificationService } = await import("./notificationService");

      const admins = await User.find({ 
        role: UserRole.ADMIN, 
        isActive: true, 
        isDeleted: false 
      }).select("_id").lean();

      if (admins.length === 0) {
        console.warn(`[INVENTORY ALERT] No admins found to notify for ${alert.skuCode}`);
        return;
      }

      // 2. Send notification to each admin
      await Promise.all(
        admins.map((admin) =>
          notificationService.createNotification({
            userId: admin._id,
            category: NotificationCategory.INVENTORY_LOW_STOCK,
            title,
            message,
            data: {
              skuId: alert.skuId,
              skuCode: alert.skuCode,
              locationId: alert.locationId,
              availableQuantity: alert.availableQuantity,
            },
          })
        )
      );

      console.log(`[INVENTORY ALERT] Notification dispatched to ${admins.length} admin(s) for ${alert.skuCode}`);
    } catch (error: any) {
      console.error(`[INVENTORY ALERT] Failed to dispatch notifications: ${error.message}`);
    }
  }
}

export const alertService = new AlertService();