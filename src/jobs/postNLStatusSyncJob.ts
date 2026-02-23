import cron from "node-cron";
import { Orders } from "@/models/commerce";
import { Shipments } from "@/models/commerce";
import { OrderStatus, ShipmentStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import axios from "axios";

/**
 * PostNL Status Sync Job
 * 
 * Step 6 - Syncs shipment statuses from PostNL API:
 * - Fetches updated shipment statuses from PostNL API
 * - Updates Shipment records with new status
 * - Updates status_history
 * - Handles special statuses:
 *   - AT_PICKUP_POINT: Send SMS to customer
 *   - DELIVERED: Update order status to DELIVERED, set deliveredAt
 * 
 * Runs every 30 minutes to sync statuses
 */

interface PostNLShipmentStatus {
  barcode: string;
  status: string;
  statusCode: number;
  statusDescription: string;
  timestamp?: string;
}

export class PostNLStatusSyncJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private totalRuns: number = 0;
  private totalProcessed: number = 0;
  private totalSuccess: number = 0;
  private totalFailed: number = 0;

  private readonly POSTNL_API_URL =
    process.env.POSTNL_API_URL || "https://api.postnl.nl";
  private readonly POSTNL_SHIPMENT_API_KEY =
    process.env.POSTNL_SHIPMENT_API_KEY || "";
  private readonly CUSTOMER_NUMBER = process.env.POSTNL_CUSTOMER_NUMBER || "10825993";

  /**
   * Sync shipment statuses from PostNL
   */
  async syncStatuses(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn("PostNL Status Sync job is already running, skipping...");
      return { processed: 0, success: 0, failed: 0 };
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.totalRuns++;
    this.lastRunTime = new Date();

    let processed = 0;
    let success = 0;
    let failed = 0;

    try {
      logger.info("🔄 Starting PostNL Status Sync job...");

      // Fetch updated shipments from PostNL API
      const shipments = await this.fetchUpdatedShipments();

      if (shipments.length === 0) {
        logger.info("No updated shipments found");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Found ${shipments.length} updated shipments`);

      // Process each shipment
      for (const shipmentStatus of shipments) {
        try {
          await this.updateShipmentStatus(shipmentStatus);
          success++;
          processed++;
        } catch (error: any) {
          logger.error(
            `Failed to update shipment status for barcode ${shipmentStatus.barcode}: ${error.message}`
          );
          failed++;
          processed++;
        }
      }

      logger.info(
        `✅ PostNL Status Sync job completed: ${success} successful, ${failed} failed out of ${processed} processed`
      );
    } catch (error: any) {
      logger.error(`❌ PostNL Status Sync job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      failed = processed;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ PostNL Status Sync job took ${duration}ms`);
    }

    this.totalProcessed += processed;
    this.totalSuccess += success;
    this.totalFailed += failed;

    return { processed, success, failed };
  }

  /**
   * Fetch updated shipments from PostNL API
   * Matches Java implementation: uses LocalDateTime format (YYYY-MM-DDTHH:mm:ss.SSS)
   * and both parameters named 'period'
   */
  private async fetchUpdatedShipments(): Promise<PostNLShipmentStatus[]> {
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      // Format date as LocalDateTime (YYYY-MM-DDTHH:mm:ss.SSS) without timezone
      // Java LocalDateTime.toString() format
      const formatLocalDateTime = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
      };

      const period1 = formatLocalDateTime(twoHoursAgo);
      const period2 = formatLocalDateTime(now);

      // Build URL with both parameters named 'period' (matching Java implementation)
      const url = `${this.POSTNL_API_URL}/shipment/v2/status/${this.CUSTOMER_NUMBER}/updatedshipments?period=${encodeURIComponent(period1)}&period=${encodeURIComponent(period2)}`;

      const response = await axios.get(url, {
        headers: {
          Accept: "application/json",
          apikey: this.POSTNL_SHIPMENT_API_KEY,
        },
        timeout: 30000,
      });

      return response.data || [];
    } catch (error: any) {
      logger.error(`Failed to fetch updated shipments: ${error.message}`, {
        statusCode: error.response?.status,
        responseData: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Update shipment status
   */
  private async updateShipmentStatus(
    shipmentStatus: PostNLShipmentStatus
  ): Promise<void> {
    // Find shipment by tracking code
    const shipment = await Shipments.findOne({
      trackingCode: shipmentStatus.barcode,
      isDeleted: false,
    }).lean();

    if (!shipment) {
      logger.warn(`Shipment not found for barcode: ${shipmentStatus.barcode}`);
      return;
    }

    // Map PostNL status to our ShipmentStatus enum
    const mappedStatus = this.mapPostNLStatus(shipmentStatus.status);

    // Check if status has changed
    if (shipment.shipmentStatus === mappedStatus) {
      logger.debug(`Shipment ${shipment._id} status unchanged: ${mappedStatus}`);
      return;
    }

    // Update shipment
    const updateData: any = {
      shipmentStatus: mappedStatus,
      $push: {
        statusHistory: {
          status: mappedStatus,
          timestamp: shipmentStatus.timestamp
            ? new Date(shipmentStatus.timestamp)
            : new Date(),
        },
      },
    };

    // Set pickedUpAt if status is PICKED_UP
    if (mappedStatus === ShipmentStatus.PICKED_UP && !shipment.pickedUpAt) {
      updateData.pickedUpAt = new Date();
    }

    // Set deliveredAt if status is DELIVERED
    if (mappedStatus === ShipmentStatus.DELIVERED) {
      updateData.deliveredAt = new Date();

      // Update order status to DELIVERED
      await Orders.updateOne(
        { _id: shipment.orderId },
        {
          $set: {
            status: OrderStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        }
      );

      logger.info(
        `Updated order ${shipment.orderId} status to DELIVERED`
      );
    }

    await Shipments.updateOne({ _id: shipment._id }, updateData);

    logger.info(
      `Updated shipment ${shipment._id} status from ${shipment.shipmentStatus} to ${mappedStatus}`
    );

    // Handle AT_PICKUP_POINT status - send SMS
    if (mappedStatus === ShipmentStatus.AT_PICKUP_POINT) {
      await this.sendPickupPointSMS(shipment);
    }
  }

  /**
   * Map PostNL status to ShipmentStatus enum
   */
  private mapPostNLStatus(postNLStatus: string): ShipmentStatus {
    const statusMap: Record<string, ShipmentStatus> = {
      "1": ShipmentStatus.PENDING, // Pre-alerted
      "2": ShipmentStatus.PENDING, // Accepted
      "3": ShipmentStatus.PICKED_UP, // Collected
      "4": ShipmentStatus.IN_TRANSIT, // Sorted
      "5": ShipmentStatus.IN_TRANSIT, // In storage
      "6": ShipmentStatus.OUT_FOR_DELIVERY, // Out for delivery
      "7": ShipmentStatus.AT_PICKUP_POINT, // At pickup point
      "8": ShipmentStatus.DELIVERED, // Delivered
      "9": ShipmentStatus.EXCEPTION, // Exception
      "10": ShipmentStatus.RETURNED, // Returned
    };

    // Also handle status descriptions
    const statusLower = postNLStatus.toLowerCase();
    if (statusLower.includes("delivered")) {
      return ShipmentStatus.DELIVERED;
    }
    if (statusLower.includes("pickup") || statusLower.includes("pick-up")) {
      return ShipmentStatus.AT_PICKUP_POINT;
    }
    if (statusLower.includes("transit")) {
      return ShipmentStatus.IN_TRANSIT;
    }
    if (statusLower.includes("out for delivery")) {
      return ShipmentStatus.OUT_FOR_DELIVERY;
    }
    if (statusLower.includes("picked up") || statusLower.includes("collected")) {
      return ShipmentStatus.PICKED_UP;
    }
    if (statusLower.includes("exception")) {
      return ShipmentStatus.EXCEPTION;
    }
    if (statusLower.includes("returned")) {
      return ShipmentStatus.RETURNED;
    }

    // Default mapping by status code
    return statusMap[postNLStatus] || ShipmentStatus.PENDING;
  }

  /**
   * Send SMS to customer when shipment is at pickup point
   */
  private async sendPickupPointSMS(shipment: any): Promise<void> {
    try {
      // Get order and address to find customer phone
      const order = await Orders.findById(shipment.orderId)
        .populate("shippingAddressId")
        .lean();

      if (!order) {
        logger.warn(`Order not found for shipment ${shipment._id}`);
        return;
      }

      // Get phone from shipping address
      const address = order.shippingAddressId as any;
      const phone = address?.phone;

      if (!phone) {
        logger.warn(`Phone number not found for order ${order._id}`);
        return;
      }

      // TODO: Implement SMS service (Infobip or similar)
      // For now, just log - SMS service needs to be implemented
      logger.info(
        `SMS should be sent to ${phone} for shipment at pickup point. Order: ${order.orderNumber}, Tracking URL: ${shipment.trackingUrl}`
      );

      // Example SMS service call (to be implemented):
      // await smsService.sendSMS({
      //   to: phone,
      //   message: `Your order ${order.orderNumber} is ready for pickup at PostNL location. Track your package: ${shipment.trackingUrl}`
      // });
    } catch (error: any) {
      logger.error(`Failed to send pickup point SMS: ${error.message}`);
      // Don't throw - SMS failure shouldn't block status update
    }
  }

  /**
   * Get job status
   */
  getStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    totalRuns: number;
    totalProcessed: number;
    totalSuccess: number;
    totalFailed: number;
  } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      totalRuns: this.totalRuns,
      totalProcessed: this.totalProcessed,
      totalSuccess: this.totalSuccess,
      totalFailed: this.totalFailed,
    };
  }
}

// Create singleton instance
export const postNLStatusSyncJob = new PostNLStatusSyncJob();

// Schedule: every 30 minutes (override via POSTNL_STATUS_SYNC_SCHEDULE)
const cronSchedule = process.env.POSTNL_STATUS_SYNC_SCHEDULE || "*/30 * * * *";

// Validate cron schedule
if (!cron.validate(cronSchedule)) {
  logger.error(`❌ Invalid cron schedule for PostNL Status Sync job: ${cronSchedule}`);
} else {
  cron.schedule(cronSchedule, async () => {
    try {
      logger.info("🕐 [CRON] Scheduled PostNL Status Sync job triggered");
      await postNLStatusSyncJob.syncStatuses();
    } catch (error: any) {
      logger.error(`Error in scheduled PostNL Status Sync job: ${error.message}`);
    }
  });

  logger.info(`✅ PostNL Status Sync cron job scheduled: ${cronSchedule}`);
}
