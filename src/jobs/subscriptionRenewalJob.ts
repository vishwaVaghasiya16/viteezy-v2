import { subscriptionAutoRenewalService } from "@/services/subscriptionAutoRenewalService";
import { logger } from "@/utils/logger";
import cron from "node-cron";

/**
 * Subscription Auto-Renewal Job
 * 
 * This job processes all subscriptions that are due for renewal.
 * It should be run daily (or more frequently) to check for subscriptions
 * that need to be renewed.
 * 
 * Usage:
 * - Manual: Call processRenewals() directly
 * - Scheduled: Use node-cron or similar to run this daily
 * - API: Use the admin endpoint to trigger manually
 */
export class SubscriptionRenewalJob {
  private isRunning: boolean = false;
  private lastRunDate: Date | null = null;
  private lastRunResult: any = null;

  /**
   * Process all due renewals
   * @param limit - Maximum number of subscriptions to process per run
   */
  async processRenewals(limit: number = 100): Promise<void> {
    // Prevent concurrent runs
    if (this.isRunning) {
      logger.warn("Subscription renewal job is already running, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info("🔄 Starting subscription auto-renewal job...");

      const result = await subscriptionAutoRenewalService.processDueRenewals(limit);

      this.lastRunDate = new Date();
      this.lastRunResult = result;

      logger.info(
        `✅ Subscription renewal job completed: ${result.successful} successful, ${result.failed} failed out of ${result.processed} processed`
      );

      // Log failed renewals for monitoring
      if (result.failed > 0) {
        const failedRenewals = result.results.filter((r) => !r.success);
        logger.warn(
          `⚠️ ${result.failed} subscription renewals failed:`,
          failedRenewals.map((r) => ({
            subscriptionId: r.subscriptionId,
            error: r.error,
          }))
        );
      }
    } catch (error: any) {
      logger.error(`❌ Subscription renewal job failed: ${error.message}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      logger.info(`⏱️ Subscription renewal job took ${duration}ms`);
    }
  }

  /**
   * Get job status
   */
  getStatus(): {
    isRunning: boolean;
    lastRunDate: Date | null;
    lastRunResult: any;
  } {
    return {
      isRunning: this.isRunning,
      lastRunDate: this.lastRunDate,
      lastRunResult: this.lastRunResult,
    };
  }
}

export const subscriptionRenewalJob = new SubscriptionRenewalJob();

// Initialize cron job when this module is imported
// Schedule: Run daily at 2 AM in production; every hour in development
const cronSchedule = process.env.NODE_ENV === "production" 
  ? "0 2 * * *"   // Daily at 2 AM in production
  : "0 * * * *";  // Every hour in development (override via SUBSCRIPTION_RENEWAL_CRON if needed)

// Initialize and start the cron job
const cronTask = cron.schedule(cronSchedule, async () => {
  logger.info("🕐 Scheduled subscription renewal job triggered");
  console.log("🔄 [CRON] Processing subscription renewals...");
  
  try {
    await subscriptionRenewalJob.processRenewals(100);
    logger.info("✅ [CRON] Subscription renewal job completed");
  } catch (error: any) {
    logger.error(`❌ [CRON] Subscription renewal job error: ${error.message}`);
  }
}, {
  timezone: "UTC" // Adjust timezone as needed
});

// Start the cron task (it starts automatically, but we can explicitly start it)
cronTask.start();

logger.info(`✅ Subscription renewal cron job scheduled: ${cronSchedule} (${process.env.NODE_ENV || "development"} mode)`);
logger.info(`📅 Cron job is ${cronTask.getStatus() === "scheduled" ? "active" : "inactive"}`);

