import mongoose from "mongoose";
import { movementService } from "./movement.service";
import { Skus, Locations } from "@/models/inventory";
import {
  MovementType,
  LocationType,
  ProductVariant,
} from "@/models/enums";
import { CreateMovementDto } from "../types/inventory.types";
import { logger } from "@/utils/logger";

/**
 * InventoryIntegrationService
 *
 * Bridges the Inventory module with the rest of the Viteezy platform (Orders, Subscriptions, Payments).
 * This service encapsulates the logic of mapping Order/Subscription items to SKUs and triggering
 * the appropriate inventory movements.
 */
class InventoryIntegrationService {
  /**
   * reserveStockForOrder
   *
   * Called when an order is CONFIRMED (usually after payment).
   * Maps each order item to a SKU and reserves stock at the default Fulfillment Center.
   */
  async reserveStockForOrder(order: any, performedBy: string): Promise<void> {
    logger.info(`Processing inventory reservations for order ${order.orderNumber}`);

    // Find a default Fulfillment Center
    // TODO: Implement warehouse routing logic if multiple FCs exist.
    // For now, we pick the first active FC.
    const fulfillmentCenter = await Locations.findOne({
      type: LocationType.FULFILLMENT_CENTER,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!fulfillmentCenter) {
      logger.error("No active Fulfillment Center found to reserve stock.");
      return;
    }

    for (const item of order.items) {
      try {
        // Find SKU for the product variant
        const sku = await Skus.findOne({
          productId: item.productId,
          variantType: item.variantType,
          isActive: true,
          isDeleted: false,
        }).lean();

        if (!sku) {
          logger.warn(`No active SKU found for product ${item.productId} (${item.variantType}). Skipping reservation.`);
          continue;
        }

        const quantity = item.quantity || 1;

        const dto: CreateMovementDto = {
          movementType: MovementType.RESERVATION,
          skuId: (sku._id as mongoose.Types.ObjectId).toString(),
          fromLocationId: (fulfillmentCenter._id as mongoose.Types.ObjectId).toString(),
          quantity,
          orderId: order._id.toString(),
          referenceCode: order.orderNumber,
        };

        await movementService.createMovement(dto, performedBy);
        logger.info(`Reserved ${quantity} units of SKU ${sku.skuCode} for order ${order.orderNumber}`);
      } catch (error: any) {
        logger.error(`Failed to reserve stock for item in order ${order.orderNumber}: ${error.message}`);
        // We continue with other items even if one fails, but in production you might want to rollback.
      }
    }
  }

  /**
   * releaseReservationForOrder
   *
   * Called when an order is CANCELLED.
   * Releases previously reserved stock.
   */
  async releaseReservationForOrder(order: any, performedBy: string): Promise<void> {
    logger.info(`Releasing inventory reservations for order ${order.orderNumber}`);

    const fulfillmentCenter = await Locations.findOne({
      type: LocationType.FULFILLMENT_CENTER,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!fulfillmentCenter) {
      logger.error("No active Fulfillment Center found to release reservation.");
      return;
    }

    for (const item of order.items) {
      try {
        const sku = await Skus.findOne({
          productId: item.productId,
          variantType: item.variantType,
        }).lean();

        if (!sku) continue;

        const quantity = item.quantity || 1;

        const dto: CreateMovementDto = {
          movementType: MovementType.RELEASE_RESERVATION,
          skuId: (sku._id as mongoose.Types.ObjectId).toString(),
          fromLocationId: (fulfillmentCenter._id as mongoose.Types.ObjectId).toString(),
          quantity,
          orderId: order._id.toString(),
          referenceCode: order.orderNumber,
        };

        await movementService.createMovement(dto, performedBy);
        logger.info(`Released ${quantity} units of SKU ${sku.skuCode} for order ${order.orderNumber}`);
      } catch (error: any) {
        logger.error(`Failed to release reservation for item in order ${order.orderNumber}: ${error.message}`);
      }
    }
  }

  /**
   * recordSaleForOrder
   *
   * Called when an order is SHIPPED.
   * Decrements both stock and reserved quantities at the Fulfillment Center.
   */
  async recordSaleForOrder(order: any, performedBy: string): Promise<void> {
    logger.info(`Recording inventory sale for order ${order.orderNumber}`);

    const fulfillmentCenter = await Locations.findOne({
      type: LocationType.FULFILLMENT_CENTER,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!fulfillmentCenter) {
      logger.error("No active Fulfillment Center found to record sale.");
      return;
    }

    for (const item of order.items) {
      try {
        const sku = await Skus.findOne({
          productId: item.productId,
          variantType: item.variantType,
        }).lean();

        if (!sku) continue;

        const quantity = item.quantity || 1;

        const dto: CreateMovementDto = {
          movementType: MovementType.SALE,
          skuId: (sku._id as mongoose.Types.ObjectId).toString(),
          fromLocationId: (fulfillmentCenter._id as mongoose.Types.ObjectId).toString(),
          quantity,
          orderId: order._id.toString(),
          referenceCode: order.orderNumber,
        };

        await movementService.createMovement(dto, performedBy);
        logger.info(`Recorded sale of ${quantity} units of SKU ${sku.skuCode} for order ${order.orderNumber}`);
      } catch (error: any) {
        logger.error(`Failed to record sale for item in order ${order.orderNumber}: ${error.message}`);
      }
    }
  }
}

export const inventoryIntegrationService = new InventoryIntegrationService();
