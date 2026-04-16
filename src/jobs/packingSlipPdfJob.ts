import cron from "node-cron";
import { Orders } from "@/models/commerce";
import { Payments } from "@/models/commerce";
import { OrderStatus, PaymentStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import axios from "axios";
import { config } from "@/config";

/**
 * Packing Slip PDF Generation Job
 * 
 * This job processes orders that are confirmed and have completed payment:
 * - Finds orders with status CONFIRMED and payment status COMPLETED
 * - Calls Python PDF generation API to generate packing slip
 * - Python API updates order status to PACKING_SLIP_READY
 * 
 * Runs every 5 minutes to process new orders
 */
export class PackingSlipPdfJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private totalRuns: number = 0;
  private totalProcessed: number = 0;
  private totalSuccess: number = 0;
  private totalFailed: number = 0;

  /**
   * Python PDF API URL - should be configurable via environment variable
   */
  private readonly PDF_API_URL: string = config.pdf.generationApiUrl;

  /**
   * Process orders that need PDF generation
   */
  async processOrders(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn("Packing slip PDF job is already running, skipping...");
      return { processed: 0, success: 0, failed: 0 };
    }

    if (!this.PDF_API_URL.trim()) {
      logger.warn(
        "Packing slip PDF job skipped: PDF_GENERATION_API_URL is not configured"
      );
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
      logger.info("🔄 Starting packing slip PDF generation job...");

      // Find orders with status CONFIRMED
      const confirmedOrders = await Orders.find({
        status: OrderStatus.CONFIRMED,
        isDeleted: false,
      })
        .select("_id orderNumber userId")
        .lean();

      if (confirmedOrders.length === 0) {
        logger.info("No confirmed orders found for PDF generation");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Found ${confirmedOrders.length} confirmed orders`);

      // Process each order
      for (const order of confirmedOrders) {
        try {
          // Check if payment status is COMPLETED
          const payment = await Payments.findOne({
            orderId: order._id,
            userId: order.userId,
            status: PaymentStatus.COMPLETED,
            isDeleted: false,
          }).lean();

          if (!payment) {
            logger.debug(
              `Order ${order.orderNumber} (${order._id}) does not have completed payment, skipping...`
            );
            continue;
          }

          // Call Python PDF generation API
          logger.info(
            `Generating PDF for order ${order.orderNumber} (${order._id})`
          );

          const response = await axios.post(
            this.PDF_API_URL,
            {
              order_id: order._id.toString(),
            },
            {
              headers: {
                "Content-Type": "application/json",
              },
              timeout: 60000, // 60 seconds timeout for PDF generation
            }
          );

          if (response.data && response.data.pdf_url) {
            logger.info(
              `✅ PDF generated successfully for order ${order.orderNumber}: ${response.data.pdf_url}`
            );
            success++;
            processed++;
          } else {
            logger.warn(
              `⚠️ PDF API response missing pdf_url for order ${order.orderNumber}`
            );
            failed++;
            processed++;
          }
        } catch (error: any) {
          logger.error(
            `❌ Failed to generate PDF for order ${order.orderNumber} (${order._id}): ${error.message}`,
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              error: error.message,
              statusCode: error.response?.status,
              responseData: error.response?.data,
            }
          );
          failed++;
          processed++;
        }
      }

      this.totalProcessed += processed;
      this.totalSuccess += success;
      this.totalFailed += failed;

      logger.info(
        `✅ Packing slip PDF job completed: ${success} successful, ${failed} failed out of ${processed} processed`
      );
    } catch (error: any) {
      logger.error(`❌ Packing slip PDF job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ Packing slip PDF job took ${duration}ms`);
    }

    return { processed, success, failed };
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
export const packingSlipPdfJob = new PackingSlipPdfJob();

// Packing slip PDF cron schedule (default: every 5 minutes)
const packingSlipCronSchedule = config.jobs.packingSlipCron;
cron.schedule(packingSlipCronSchedule, async () => {
  try {
    await packingSlipPdfJob.processOrders();
  } catch (error: any) {
    logger.error(`Error in scheduled packing slip PDF job: ${error.message}`);
  }
});
logger.info(`✅ Packing slip PDF cron job scheduled: ${packingSlipCronSchedule}`);
