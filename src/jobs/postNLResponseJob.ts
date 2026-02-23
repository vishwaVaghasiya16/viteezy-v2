import cron from "node-cron";
import { Orders } from "@/models/commerce";
import { Shipments } from "@/models/commerce";
import { OrderStatus, ShipmentStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import * as fs from "fs";
import * as path from "path";
import { downloadFromSFTP, listSFTPFiles } from "@/utils/sftpUploader";
import { parseXML } from "@/utils/xmlParser";
import { Addresses } from "@/models/core/addresses.model";

interface DeliveryOrderResponse {
  orderNo: string;
  trackAndTraceCode: string;
  status?: string;
}

/**
 * PostNL Response Job
 * 
 * Step 5 - Handles PostNL barcode response:
 * - Reads XML files from PostNL SFTP server
 * - Parses barcode/tracking code from XML
 * - Creates or updates Shipment
 * - Updates Order status to SHIPPED
 * 
 * Runs every 5 minutes to check for new responses
 */

export class PostNLResponseJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private totalRuns: number = 0;
  private totalProcessed: number = 0;
  private totalSuccess: number = 0;
  private totalFailed: number = 0;

  // Use path.join for cross-platform compatibility (Windows/Linux)
  private readonly XML_FOLDER = process.env.POSTNL_RESPONSE_XML_FOLDER 
    ? path.resolve(process.env.POSTNL_RESPONSE_XML_FOLDER)
    : path.join(process.cwd(), "data", "xml", "responses");
  private readonly SFTP_RESPONSE_DIR = "/Shipment/";

  /**
   * Process PostNL response XML files
   */
  async processResponses(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn("PostNL Response job is already running, skipping...");
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
      logger.info("🔄 Starting PostNL Response job...");

      // Ensure local directory exists
      await this.createDirectory();

      // List XML files from SFTP
      const remoteFiles = await listSFTPFiles(this.SFTP_RESPONSE_DIR);
      const xmlFiles = remoteFiles.filter((file) => file.endsWith(".xml"));

      if (xmlFiles.length === 0) {
        logger.info("No XML response files found on SFTP");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Found ${xmlFiles.length} XML response files`);

      // Process each XML file
      for (const fileName of xmlFiles) {
        try {
          const remotePath = `${this.SFTP_RESPONSE_DIR}${fileName}`;
          const localPath = path.join(this.XML_FOLDER, fileName);

          // Download XML file
          await downloadFromSFTP(remotePath, localPath);

          // Parse XML and process response
          const responseData = await this.parseResponseFile(localPath, fileName);
          if (responseData) {
            await this.processResponse(responseData, fileName);
          }

          // Delete remote file after successful processing
          // Note: SFTP delete functionality needs to be added to sftpUploader
          // For now, we'll leave files on server

          success++;
          processed++;
        } catch (error: any) {
          logger.error(`Failed to process response file ${fileName}: ${error.message}`);
          failed++;
          processed++;
        }
      }

      logger.info(
        `✅ PostNL Response job completed: ${success} successful, ${failed} failed out of ${processed} processed`
      );
    } catch (error: any) {
      logger.error(`❌ PostNL Response job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      failed = processed;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ PostNL Response job took ${duration}ms`);
    }

    this.totalProcessed += processed;
    this.totalSuccess += success;
    this.totalFailed += failed;

    return { processed, success, failed };
  }

  /**
   * Create directory if it doesn't exist
   */
  private async createDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.XML_FOLDER)) {
        fs.mkdirSync(this.XML_FOLDER, { recursive: true });
        logger.info(`Created response XML directory: ${this.XML_FOLDER}`);
      }
    } catch (error: any) {
      logger.error(`Failed to create response XML directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse response XML file
   */
  private async parseResponseFile(
    filePath: string,
    fileName: string
  ): Promise<DeliveryOrderResponse | null> {
    try {
      // Parse XML file
      const xmlContent = fs.readFileSync(filePath, "utf-8");
      const responseData = parseXML(xmlContent);
      return responseData;
    } catch (error: any) {
      logger.error(`Failed to parse response file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Process response data
   */
  private async processResponse(
    responseData: DeliveryOrderResponse,
    fileName: string
  ): Promise<void> {
    try {

      if (!responseData.orderNo || !responseData.trackAndTraceCode) {
        logger.warn(`Invalid response XML: missing orderNo or trackAndTraceCode in ${fileName}`);
        return;
      }

      // Find order by order number
      const order = await Orders.findOne({
        orderNumber: responseData.orderNo,
        isDeleted: false,
      }).lean();

      if (!order) {
        logger.warn(`Order not found for order number: ${responseData.orderNo}`);
        return;
      }

      // Build tracking URL
      const trackingUrl = await this.buildTrackingUrl(
        responseData.trackAndTraceCode,
        order.shippingAddressId
      );

      // Create or update Shipment
      const shipment = await Shipments.findOneAndUpdate(
        { orderId: order._id },
        {
          orderId: order._id,
          carrier: "PostNL",
          trackingCode: responseData.trackAndTraceCode,
          trackingUrl: trackingUrl,
          shipmentStatus: ShipmentStatus.PENDING,
          statusHistory: [
            {
              status: ShipmentStatus.PENDING,
              timestamp: new Date(),
            },
          ],
          // Set pharmacist_order_number if available in order metadata
          pharmacistOrderNumber: order.metadata?.pharmacistOrderNumber,
        },
        {
          upsert: true,
          new: true,
        }
      );

      logger.info(
        `Created/updated shipment ${shipment._id} for order ${order.orderNumber} with tracking code ${responseData.trackAndTraceCode}`
      );

      // Update order status to SHIPPED
      await Orders.updateOne(
        { _id: order._id },
        {
          $set: {
            status: OrderStatus.SHIPPED,
            trackingNumber: responseData.trackAndTraceCode,
            shippedAt: new Date(),
          },
        }
      );

      logger.info(`Updated order ${order.orderNumber} status to SHIPPED`);
    } catch (error: any) {
      logger.error(`Failed to process response: ${error.message}`, {
        orderNo: responseData.orderNo,
        fileName: fileName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Build PostNL tracking URL
   */
  private async buildTrackingUrl(
    trackingCode: string,
    addressId: any
  ): Promise<string> {
    try {
      if (addressId) {
        const address = await Addresses.findById(addressId).lean();
        if (address) {
          // Format: https://jouw.postnl.nl/track-and-trace/{barcode}-{country}-{postcode}
          const country = address.country || "NL";
          const postcode = address.postalCode || "";
          return `https://jouw.postnl.nl/track-and-trace/${trackingCode}-${country}-${postcode}`;
        }
      }
    } catch (error: any) {
      logger.warn(`Failed to build tracking URL with address: ${error.message}`);
    }
    // Fallback to basic tracking URL
    return `https://jouw.postnl.nl/track-and-trace/${trackingCode}`;
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
export const postNLResponseJob = new PostNLResponseJob();

// Schedule: every 5 minutes (override via POSTNL_RESPONSE_JOB_SCHEDULE)
const cronSchedule = process.env.POSTNL_RESPONSE_JOB_SCHEDULE || "*/5 * * * *";

// Validate cron schedule
if (!cron.validate(cronSchedule)) {
  logger.error(`❌ Invalid cron schedule for PostNL Response job: ${cronSchedule}`);
} else {
  cron.schedule(cronSchedule, async () => {
    try {
      logger.info("🕐 [CRON] Scheduled PostNL Response job triggered");
      await postNLResponseJob.processResponses();
    } catch (error: any) {
      logger.error(`Error in scheduled PostNL Response job: ${error.message}`);
    }
  });

  logger.info(`✅ PostNL Response cron job scheduled: ${cronSchedule}`);
}
