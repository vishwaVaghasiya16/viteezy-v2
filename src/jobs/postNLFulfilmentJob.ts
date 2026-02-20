import cron from "node-cron";
import { Orders } from "@/models/commerce";
import { OrderStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import * as fs from "fs";
import * as path from "path";
import { buildXML } from "@/utils/xmlBuilder";
import { uploadToSFTP } from "@/utils/sftpUploader";
import { Addresses } from "@/models/core/addresses.model";
import { User } from "@/models/core/users.model";

/**
 * PostNL Fulfilment Job
 * 
 * Step 4 - Processes orders ready for shipment:
 * - Reads orders with status READY_FOR_SHIPMENT
 * - Creates XML files for PostNL
 * - Uploads XML files to PostNL via SFTP
 * - No DB change yet (status remains READY_FOR_SHIPMENT)
 * 
 * Runs every 5 minutes to process new orders
 */

export class PostNLFulfilmentJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private totalRuns: number = 0;
  private totalProcessed: number = 0;
  private totalSuccess: number = 0;
  private totalFailed: number = 0;

  // Use path.join for cross-platform compatibility (Windows/Linux)
  private readonly XML_FOLDER = process.env.POSTNL_XML_FOLDER 
    ? path.resolve(process.env.POSTNL_XML_FOLDER)
    : path.join(process.cwd(), "data", "xml");
  private readonly XML_FILE_EXTENSION = ".xml";
  private readonly SHIPPING_NL = "03085";
  private readonly SHIPPING_BE = "04946";
  private readonly SHIPMENT_TYPE = "Commercial Goods";
  private readonly LANGUAGE = "NL";

  /**
   * Process orders that need PostNL XML generation
   */
  async processOrders(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn("PostNL Fulfilment job is already running, skipping...");
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
      logger.info("🔄 Starting PostNL Fulfilment job...");

      // Ensure XML directory exists
      await this.createDirectory();

      // Find orders with status READY_FOR_SHIPMENT
      const orders = await Orders.find({
        status: OrderStatus.READY_FOR_SHIPMENT,
        isDeleted: false,
      })
        .populate("userId", "firstName lastName email")
        .populate("shippingAddressId")
        .lean();

      if (orders.length === 0) {
        logger.info("No orders with READY_FOR_SHIPMENT status found");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Found ${orders.length} orders with READY_FOR_SHIPMENT status`);

      // Process each order
      for (const order of orders) {
        try {
          const xmlFile = await this.createXMLForOrder(order);
          if (xmlFile) {
            await this.uploadXMLFile(xmlFile, order);
            success++;
          } else {
            logger.warn(`Failed to create XML for order ${order.orderNumber}`);
            failed++;
          }
          processed++;
        } catch (error: any) {
          logger.error(
            `Failed to process order ${order.orderNumber}: ${error.message}`,
            { orderId: order._id.toString(), error: error.message }
          );
          failed++;
          processed++;
        }
      }

      logger.info(
        `✅ PostNL Fulfilment job completed: ${success} successful, ${failed} failed out of ${processed} processed`
      );
    } catch (error: any) {
      logger.error(`❌ PostNL Fulfilment job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      failed = processed;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ PostNL Fulfilment job took ${duration}ms`);
    }

    this.totalProcessed += processed;
    this.totalSuccess += success;
    this.totalFailed += failed;

    return { processed, success, failed };
  }

  /**
   * Create XML directory if it doesn't exist
   */
  private async createDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.XML_FOLDER)) {
        fs.mkdirSync(this.XML_FOLDER, { recursive: true });
        logger.info(`Created XML directory: ${this.XML_FOLDER}`);
      }
    } catch (error: any) {
      logger.error(`Failed to create XML directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create XML file for an order
   */
  private async createXMLForOrder(order: any): Promise<string | null> {
    try {
      const user = order.userId 
        ? await User.findById(order.userId).lean()
        : null;
      const address = order.shippingAddressId 
        ? await Addresses.findById(order.shippingAddressId).lean()
        : null;

      if (!user || !address) {
        logger.warn(`Missing user or address for order ${order.orderNumber}`);
        return null;
      }

      // Get order date/time
      const orderDate = new Date(order.createdAt || Date.now());
      const dateStr = orderDate.toISOString().split("T")[0]; // yyyy-MM-dd
      const timeStr = orderDate.toTimeString().split(" ")[0]; // HH:mm:ss

      // Get shipping agent code based on country
      const shippingAgentCode = this.getShippingAgentCode(address.country || "NL");

      // Build delivery order lines
      // TODO: Replace with actual blend ingredient mapping
      const deliveryOrderLines = this.buildDeliveryOrderLines(order);

      if (deliveryOrderLines.length === 0) {
        logger.warn(`No delivery order lines for order ${order.orderNumber}`);
        return null;
      }

      // Build XML
      const xmlContent = buildXML({
        messageNo: order._id.toString(),
        messageDate: dateStr,
        messageTime: timeStr,
        orderNo: order.orderNumber,
        webOrderNo: order._id.toString(),
        orderDate: dateStr,
        orderTime: timeStr,
        customerNo: user._id.toString(),
        onlyHomeAddress: false,
        shipToFirstName: user.firstName || "",
        shipToLastName: user.lastName || "",
        shipToStreet: address.streetName || "",
        shipToHouseNo: address.houseNumber || "",
        shipToAnnex: address.houseNumberAddition || "",
        shipToPostalCode: address.postalCode || "",
        shipToCity: address.city || "",
        shipToCountryCode: address.country || "NL",
        shipToPhone: address.phone || "",
        shipToEmail: user.email || "",
        language: this.LANGUAGE,
        shippingAgentCode: shippingAgentCode,
        shipmentType: this.SHIPMENT_TYPE,
        deliveryOrderLines: deliveryOrderLines,
      });

      // Save XML file
      const fileName = `${order._id}${this.XML_FILE_EXTENSION}`;
      const filePath = path.join(this.XML_FOLDER, fileName);
      fs.writeFileSync(filePath, xmlContent, "utf-8");

      logger.info(`Created XML file: ${fileName} for order ${order.orderNumber}`, {
        filePath: filePath,
        storageLocation: this.XML_FOLDER,
      });
      return filePath;
    } catch (error: any) {
      logger.error(`Failed to create XML for order ${order.orderNumber}: ${error.message}`);
      return null;
    }
  }

  /**
   * Build delivery order lines from order
   * TODO: Replace with actual blend ingredient mapping
   */
  private buildDeliveryOrderLines(order: any): Array<{
    itemNo: string;
    itemDescription: string;
    quantity: number;
  }> {
    const lines: Array<{ itemNo: string; itemDescription: string; quantity: number }> = [];

    // Get recurring months (default to 1)
    const recurringMonths = order.selectedPlanDays 
      ? Math.floor(order.selectedPlanDays / 30) || 1
      : 1;

    const packs = recurringMonths * 30;

    // For now, add a basic vitamin pack line
    // TODO: Replace with actual blend ingredient logic
    lines.push({
      itemNo: `VIT${packs}`,
      itemDescription: "Vitamine packs",
      quantity: 1,
    });

    return lines;
  }

  /**
   * Get shipping agent code based on country
   */
  private getShippingAgentCode(countryCode: string): string {
    switch (countryCode?.toUpperCase()) {
      case "NL":
        return this.SHIPPING_NL;
      case "BE":
        return this.SHIPPING_BE;
      default:
        return "";
    }
  }

  /**
   * Upload XML file to PostNL via SFTP
   */
  private async uploadXMLFile(filePath: string, order: any): Promise<void> {
    try {
      const fileName = path.basename(filePath);
      const remotePath = `/Order/${fileName}`;

      await uploadToSFTP(filePath, remotePath);

      logger.info(`Uploaded XML file ${fileName} to PostNL for order ${order.orderNumber}`, {
        localPath: filePath,
        remotePath: remotePath,
      });
      
      // Note: We don't update order status here - that happens when barcode is received (Step 5)
    } catch (error: any) {
      logger.error(`Failed to upload XML file ${filePath}: ${error.message}`, {
        error: error.message,
        localPath: filePath,
        storageLocation: this.XML_FOLDER,
      });
      // Log where the file is stored for manual upload
      logger.warn(`⚠️ XML file saved locally at: ${filePath}`, {
        fileName: fileName,
        fullPath: filePath,
        storageFolder: this.XML_FOLDER,
        note: "Configure SFTP_PRIVATEKEY_FILENAME or SFTP_PRIVATE_KEY in .env to enable automatic upload",
      });
      throw error;
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
export const postNLFulfilmentJob = new PostNLFulfilmentJob();

// Schedule the job to run every 1 minute (or as configured)
const cronSchedule =
  process.env.POSTNL_FULFILMENT_JOB_SCHEDULE || "* * * * *";

// Validate cron schedule
if (!cron.validate(cronSchedule)) {
  logger.error(`❌ Invalid cron schedule for PostNL Fulfilment job: ${cronSchedule}`);
} else {
  cron.schedule(cronSchedule, async () => {
    try {
      logger.info("🕐 [CRON] Scheduled PostNL Fulfilment job triggered");
      await postNLFulfilmentJob.processOrders();
    } catch (error: any) {
      logger.error(`Error in scheduled PostNL Fulfilment job: ${error.message}`);
    }
  });

  logger.info(`✅ PostNL Fulfilment cron job scheduled: ${cronSchedule}`);
}
