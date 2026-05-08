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
   * The single place to swap notification targets.
   * Currently logs to console.
   *
   * Future enhancements — replace or extend this method only:
   *   - Email: call your existing email service
   *   - Slack: POST to a webhook URL
   *   - Dashboard: write to a notifications collection
   *   - Multiple channels: call all three
   */
  private async dispatch(alert: LowStockAlert): Promise<void> {
    const isOutOfStock = alert.availableQuantity <= 0;
    const level = isOutOfStock ? "OUT OF STOCK" : "LOW STOCK";

    console.warn(
      `[INVENTORY ALERT] ${level} — ` +
      `SKU: ${alert.skuCode} (${alert.displayName}) | ` +
      `Location: ${alert.locationName} (${alert.locationType}) | ` +
      `Available: ${alert.availableQuantity} | ` +
      `Threshold: ${alert.lowStockThreshold} | ` +
      `Deficit: ${alert.deficit}`
    );

    // ── TODO: replace with your notification transport ────────────────────
    // Example — email:
    // await emailService.sendLowStockAlert(alert);
    //
    // Example — Slack:
    // await slackService.postMessage({
    //   channel: "#inventory-alerts",
    //   text: `⚠️ ${level}: ${alert.skuCode} at ${alert.locationName} — ${alert.availableQuantity} remaining`,
    // });
    //
    // Example — notifications collection:
    // await Notifications.create({
    //   category: NotificationCategory.SYSTEM,
    //   title: `${level}: ${alert.skuCode}`,
    //   message: `Only ${alert.availableQuantity} units left at ${alert.locationName}`,
    //   metadata: alert,
    // });
  }
}


export const alertService = new AlertService();