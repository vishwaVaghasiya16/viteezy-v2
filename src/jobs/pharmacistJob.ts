import cron from "node-cron";
import { Orders } from "@/models/commerce";
import { OrderStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import * as fs from "fs";
import * as path from "path";
import { emailService } from "@/services/emailService";
import { Addresses } from "@/models/core/addresses.model";
import { User } from "@/models/core/users.model";

/**
 * Pharmacist Job
 * 
 * Step 3 - Processes orders after packing slip is ready:
 * - Reads orders with status PACKING_SLIP_READY
 * - Creates CSV files for pharmacist
 * - Sends CSV files to pharmacist via email
 * - Updates order status to READY_FOR_SHIPMENT
 * 
 * Runs every 5 minutes to process new orders
 */

interface PharmacistOrderLine {
  orderId: string;
  orderNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  postcode: string;
  city: string;
  recurringMonths: number;
  pharmacistOrderNumber?: string;
  pharmacistIngredientCode?: number;
  pieces: number;
}

interface PharmacistOrderBatch {
  batchName: string;
  batchNumber: number;
  orderNumber: string;
  fileName: string;
  orderLines: PharmacistOrderLine[];
}

export class PharmacistJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private totalRuns: number = 0;
  private totalProcessed: number = 0;
  private totalSuccess: number = 0;
  private totalFailed: number = 0;

  private readonly CSV_FOLDER = process.env.PHARMACIST_CSV_FOLDER || "/data/csv";
  private readonly CSV_FILE_EXTENSION = ".csv";
  private readonly ONE_MONTH = 1;
  private readonly THREE_MONTHS = 3;
  private readonly SINGLE_BAGS = "SINGLE-BAGS";
  private readonly MULTIPLE_BAGS = "MULTIPLE-BAGS";

  /**
   * Process orders that need pharmacist CSV generation
   */
  async processOrders(): Promise<{
    processed: number;
    success: number;
    failed: number;
  }> {
    if (this.isRunning) {
      logger.warn("Pharmacist job is already running, skipping...");
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
      logger.info("🔄 Starting pharmacist job...");

      // Ensure CSV directory exists
      await this.createDirectory();

      // Find orders with status PACKING_SLIP_READY
      const orders = await Orders.find({
        status: OrderStatus.PACKING_SLIP_READY,
        isDeleted: false,
      })
        .populate("userId", "firstName lastName email")
        .populate("shippingAddressId")
        .lean();

      if (orders.length === 0) {
        logger.info("No orders with PACKING_SLIP_READY status found");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Found ${orders.length} orders with PACKING_SLIP_READY status`);

      // Build pharmacist order lines from orders
      const pharmacistOrderLines: PharmacistOrderLine[] = [];
      
      for (const order of orders) {
        try {
          const orderLines = await this.buildPharmacistOrderLines(order);
          pharmacistOrderLines.push(...orderLines);
        } catch (error: any) {
          logger.error(
            `Failed to build pharmacist order lines for order ${order.orderNumber}: ${error.message}`
          );
          failed++;
          continue;
        }
      }

      if (pharmacistOrderLines.length === 0) {
        logger.info("No pharmacist order lines generated");
        return { processed: 0, success: 0, failed: 0 };
      }

      logger.info(`Generated ${pharmacistOrderLines.length} pharmacist order lines`);

      // Process orders by filters (1 month and 3 months)
      await this.processOneMonthOrders(pharmacistOrderLines);
      await this.processThreeMonthsOrders(pharmacistOrderLines);

      // Send CSV files to pharmacist
      await this.emailResultsToPharmacist();

      success = orders.length;
      processed = orders.length;

      logger.info(
        `✅ Pharmacist job completed: ${success} successful, ${failed} failed out of ${processed} processed`
      );
    } catch (error: any) {
      logger.error(`❌ Pharmacist job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      failed = processed;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ Pharmacist job took ${duration}ms`);
    }

    this.totalProcessed += processed;
    this.totalSuccess += success;
    this.totalFailed += failed;

    return { processed, success, failed };
  }

  /**
   * Create CSV directory if it doesn't exist
   */
  private async createDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.CSV_FOLDER)) {
        fs.mkdirSync(this.CSV_FOLDER, { recursive: true });
        logger.info(`Created CSV directory: ${this.CSV_FOLDER}`);
      }
    } catch (error: any) {
      logger.error(`Failed to create CSV directory: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build pharmacist order lines from an order
   * Note: This is a simplified version. In production, you'll need to:
   * - Get blend ingredients from order
   * - Map to ingredient units with pharmacist codes
   * - Filter out unitless ingredients
   */
  private async buildPharmacistOrderLines(order: any): Promise<PharmacistOrderLine[]> {
    const orderLines: PharmacistOrderLine[] = [];

    // Get user and address information
    const user = order.userId || (order.userId ? await User.findById(order.userId).lean() : null);
    const address = order.shippingAddressId 
      ? await Addresses.findById(order.shippingAddressId).lean()
      : null;

    if (!user || !address) {
      logger.warn(`Missing user or address for order ${order.orderNumber}`);
      return orderLines;
    }

    // Get recurring months from order (default to 1 if not available)
    const recurringMonths = order.selectedPlanDays 
      ? Math.floor(order.selectedPlanDays / 30) || 1
      : 1;

    // Determine sequence type (FIRST or RECURRING)
    // This should be determined based on subscription status or order metadata
    const sequenceType = order.planType === "Subscription" ? "RECURRING" : "FIRST";

    // For now, create a basic order line
    // TODO: Replace with actual blend ingredient mapping
    // This should iterate through blend ingredients and create lines for each ingredient
    const orderLine: PharmacistOrderLine = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      postcode: address.postalCode || "",
      city: address.city || "",
      recurringMonths: recurringMonths,
      pharmacistIngredientCode: 0, // TODO: Get from ingredient unit
      pieces: 1, // TODO: Calculate based on blend ingredients
    };

    orderLines.push(orderLine);

    return orderLines;
  }

  /**
   * Process one month orders
   */
  private async processOneMonthOrders(
    pharmacistOrderLines: PharmacistOrderLine[]
  ): Promise<void> {
    const oneMonthOrders = pharmacistOrderLines.filter(
      (line) => line.recurringMonths === this.ONE_MONTH
    );

    if (oneMonthOrders.length === 0) {
      return;
    }

    // Filter by sequence type
    const firstOrders = oneMonthOrders.filter(
      (line) => !line.pharmacistOrderNumber || line.pharmacistOrderNumber.includes("FIRST")
    );
    const recurringOrders = oneMonthOrders.filter(
      (line) => line.pharmacistOrderNumber && line.pharmacistOrderNumber.includes("RECURRING")
    );

    // Process single bags and multiple bags
    // For now, we'll create simplified batches
    // TODO: Implement proper filtering logic based on Java code
    await this.processOrdersByLimit(
      firstOrders,
      this.ONE_MONTH,
      "FIRST",
      this.SINGLE_BAGS,
      false
    );
    await this.processOrdersByLimit(
      recurringOrders,
      this.ONE_MONTH,
      "RECURRING",
      this.SINGLE_BAGS,
      false
    );
  }

  /**
   * Process three months orders
   */
  private async processThreeMonthsOrders(
    pharmacistOrderLines: PharmacistOrderLine[]
  ): Promise<void> {
    const threeMonthsOrders = pharmacistOrderLines.filter(
      (line) => line.recurringMonths === this.THREE_MONTHS
    );

    if (threeMonthsOrders.length === 0) {
      return;
    }

    // Filter by sequence type
    const firstOrders = threeMonthsOrders.filter(
      (line) => !line.pharmacistOrderNumber || line.pharmacistOrderNumber.includes("FIRST")
    );
    const recurringOrders = threeMonthsOrders.filter(
      (line) => line.pharmacistOrderNumber && line.pharmacistOrderNumber.includes("RECURRING")
    );

    // Process single bags and multiple bags
    await this.processOrdersByLimit(
      firstOrders,
      this.THREE_MONTHS,
      "FIRST",
      this.SINGLE_BAGS,
      false
    );
    await this.processOrdersByLimit(
      recurringOrders,
      this.THREE_MONTHS,
      "RECURRING",
      this.SINGLE_BAGS,
      false
    );
  }

  /**
   * Process orders by limit (80 for 1 month, 36 for 3 months)
   */
  private async processOrdersByLimit(
    pharmacistOrderLines: PharmacistOrderLine[],
    recurringMonths: number,
    sequenceType: string,
    amountOfBagsCode: string,
    isSleep: boolean
  ): Promise<void> {
    const limit = recurringMonths === this.ONE_MONTH ? 80 : 36;
    let batchNumber = 1;
    const batches: PharmacistOrderLine[][] = [];
    let currentBatch: PharmacistOrderLine[] = [];

    for (const line of pharmacistOrderLines) {
      const uniqueOrderNumbers = new Set(
        currentBatch.map((l) => l.orderNumber)
      ).size;

      if (uniqueOrderNumbers >= limit && !currentBatch.some((l) => l.orderNumber === line.orderNumber)) {
        if (currentBatch.length > 0) {
          batches.push([...currentBatch]);
          currentBatch = [];
          batchNumber++;
        }
      }

      currentBatch.push(line);
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Create CSV files for each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const pharmacistOrderNumber = this.getOrderNumber(
        recurringMonths,
        amountOfBagsCode,
        batchNumber + i
      );
      const fileName = `${pharmacistOrderNumber}${this.CSV_FILE_EXTENSION}`;
      const batchName = this.getBatchName(
        recurringMonths,
        sequenceType,
        amountOfBagsCode,
        isSleep,
        batchNumber + i
      );

      await this.convertAndSaveCsv(
        batchName,
        batchNumber + i,
        pharmacistOrderNumber,
        fileName,
        batch
      );
    }
  }

  /**
   * Generate pharmacist order number
   */
  private getOrderNumber(
    recurringMonths: number,
    amountOfBagsCode: string,
    batchNumber: number
  ): string {
    const today = new Date();
    const dateFormatted = `${String(today.getDate()).padStart(2, "0")}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getFullYear()).slice(-2)}`;
    const double = recurringMonths === this.THREE_MONTHS && amountOfBagsCode === this.MULTIPLE_BAGS 
      ? "DUBBEL" 
      : "";
    return `O${dateFormatted}${batchNumber}${double}`;
  }

  /**
   * Generate batch name
   */
  private getBatchName(
    recurringMonths: number,
    sequenceType: string,
    amountOfBagsCode: string,
    isSleep: boolean,
    batchNumber: number
  ): string {
    const recurringMonthsCode = recurringMonths === this.ONE_MONTH ? "ONE-MONTH" : "THREE-MONTHS";
    const sleepCode = isSleep ? "SLEEP" : "NO-SLEEP";
    return `${recurringMonthsCode}-${sequenceType}-${amountOfBagsCode}-${sleepCode}-${batchNumber}`;
  }

  /**
   * Convert and save CSV file
   */
  private async convertAndSaveCsv(
    batchName: string,
    batchNumber: number,
    pharmacistOrderNumber: string,
    fileName: string,
    pharmacistOrderLines: PharmacistOrderLine[]
  ): Promise<void> {
    try {
      const filePath = path.join(this.CSV_FOLDER, fileName);
      const csvContent = this.buildCsvContent(pharmacistOrderLines, pharmacistOrderNumber);

      fs.writeFileSync(filePath, csvContent, "utf-8");
      logger.info(`Created CSV file: ${fileName} with ${pharmacistOrderLines.length} order lines`);

      // Update orders with pharmacist order number
      const orderIds = pharmacistOrderLines.map((line) => line.orderId);
      await Orders.updateMany(
        { _id: { $in: orderIds } },
        { $set: { metadata: { ...{}, pharmacistOrderNumber } } }
      );
    } catch (error: any) {
      logger.error(`Failed to create CSV file ${fileName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build CSV content
   */
  private buildCsvContent(
    pharmacistOrderLines: PharmacistOrderLine[],
    pharmacistOrderNumber: string
  ): string {
    // CSV columns: Customer_id, Email, Voornaam, Achternaam, Postcode, Plaats, aantal, Ordernummer, Vitamines, Stuks
    const headers = [
      "Customer_id",
      "Email",
      "Voornaam",
      "Achternaam",
      "Postcode",
      "Plaats",
      "aantal",
      "Ordernummer",
      "Vitamines",
      "Stuks",
    ];

    const rows = pharmacistOrderLines.map((line) => {
      return [
        line.orderNumber,
        line.email,
        line.firstName,
        line.lastName,
        line.postcode,
        line.city,
        String(line.recurringMonths),
        pharmacistOrderNumber,
        String(line.pharmacistIngredientCode || ""),
        String(line.pieces),
      ];
    });

    const csvRows = [headers, ...rows].map((row) => row.join(";"));
    return csvRows.join("\n");
  }

  /**
   * Email CSV files to pharmacist
   */
  private async emailResultsToPharmacist(): Promise<void> {
    try {
      // Find all CSV files in the directory
      const files = fs.readdirSync(this.CSV_FOLDER).filter((file) =>
        file.endsWith(this.CSV_FILE_EXTENSION)
      );

      if (files.length === 0) {
        logger.info("No CSV files to send to pharmacist");
        return;
      }

      logger.info(`Found ${files.length} CSV files to send to pharmacist`);

      // Get pharmacist email from environment
      const pharmacistEmail =
        process.env.PHARMACIST_EMAIL || "pharmacist@viteezy.com";

      // Prepare file paths
      const filePaths = files.map((file) => path.join(this.CSV_FOLDER, file));

      // Send email with CSV attachments
      await emailService.sendPharmacistRequestEmail({
        to: pharmacistEmail,
        files: filePaths,
        subject: process.env.PHARMACIST_CSV_SUBJECT || "Pharmacist Order CSV Files",
      });

      logger.info(`Sent ${files.length} CSV files to pharmacist at ${pharmacistEmail}`);

      // Update order statuses to READY_FOR_SHIPMENT
      // Find all orders that were processed (have pharmacistOrderNumber in metadata)
      const orders = await Orders.find({
        status: OrderStatus.PACKING_SLIP_READY,
        isDeleted: false,
        "metadata.pharmacistOrderNumber": { $exists: true },
      });

      for (const order of orders) {
        await Orders.updateOne(
          { _id: order._id },
          { $set: { status: OrderStatus.READY_FOR_SHIPMENT } }
        );
      }

      logger.info(`Updated ${orders.length} orders to READY_FOR_SHIPMENT status`);

      // Optionally, delete CSV files after sending (or archive them)
      // Uncomment if you want to clean up after sending
      // for (const filePath of filePaths) {
      //   fs.unlinkSync(filePath);
      // }
    } catch (error: any) {
      logger.error(`Failed to email CSV files to pharmacist: ${error.message}`);
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
export const pharmacistJob = new PharmacistJob();

// Schedule the job to run every 5 minutes
// Cron format: minute hour day month day-of-week
// "*/5 * * * *" = every 5 minutes
const cronSchedule =
  process.env.PHARMACIST_JOB_SCHEDULE || "*/5 * * * *";

cron.schedule(cronSchedule, async () => {
  try {
    await pharmacistJob.processOrders();
  } catch (error: any) {
    logger.error(`Error in scheduled pharmacist job: ${error.message}`);
  }
});

logger.info(`✅ Pharmacist cron job scheduled: ${cronSchedule}`);
