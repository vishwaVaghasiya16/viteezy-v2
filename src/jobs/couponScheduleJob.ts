import cron from "node-cron";
import { Coupons } from "@/models/commerce/coupons.model";
import { logger } from "@/utils/logger";

/**
 * Coupon Schedule Job
 *
 * Ensures coupons are active while the current time is within [validFrom, validUntil].
 * - Activates coupons where validFrom <= now <= validUntil and isActive = false
 * - Deactivates coupons where validUntil < now and isActive = true
 *
 * Runs on a configurable cron schedule (default: every 5 minutes) and once on startup.
 */
export class CouponScheduleJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastRunDuration: number = 0;
  private totalRuns: number = 0;
  private totalActivated: number = 0;
  private totalDeactivated: number = 0;

  async process(): Promise<{ activated: number; deactivated: number }> {
    if (this.isRunning) {
      logger.warn("Coupon schedule job is already running, skipping...");
      return { activated: 0, deactivated: 0 };
    }

    const start = Date.now();
    this.isRunning = true;
    this.totalRuns++;

    try {
      const now = new Date();
      logger.info("🔄 Starting coupon schedule job", {
        nowUTC: now.toISOString(),
        nowMs: now.getTime(),
      });

      // Activate coupons that are currently within the valid window
      const activateResult = await Coupons.updateMany(
        {
          isDeleted: { $ne: true },
          validFrom: { $lte: now },
          validUntil: { $gte: now },
          isActive: false,
        },
        {
          $set: { isActive: true, updatedAt: new Date() },
        }
      );

      // Deactivate coupons that have expired
      const deactivateResult = await Coupons.updateMany(
        {
          isDeleted: { $ne: true },
          validUntil: { $lt: now },
          isActive: true,
        },
        {
          $set: { isActive: false, updatedAt: new Date() },
        }
      );

      const activated = activateResult.modifiedCount || 0;
      const deactivated = deactivateResult.modifiedCount || 0;

      this.totalActivated += activated;
      this.totalDeactivated += deactivated;

      if (activated > 0 || deactivated > 0) {
        logger.info("✅ Coupon schedule job changes", {
          activated,
          deactivated,
        });
      } else {
        logger.info("ℹ️ Coupon schedule job: no changes");
      }

      return { activated, deactivated };
    } catch (error: any) {
      logger.error(`❌ Coupon schedule job failed: ${error.message}`, {
        error: error.stack,
      });
      throw error;
    } finally {
      this.isRunning = false;
      this.lastRunTime = new Date();
      this.lastRunDuration = Date.now() - start;
      logger.info(`⏱️ Coupon schedule job took ${this.lastRunDuration}ms`);
    }
  }

  getStatus(): {
    isRunning: boolean;
    lastRunTime: Date | null;
    lastRunDuration: number;
    totalRuns: number;
    totalActivated: number;
    totalDeactivated: number;
  } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      lastRunDuration: this.lastRunDuration,
      totalRuns: this.totalRuns,
      totalActivated: this.totalActivated,
      totalDeactivated: this.totalDeactivated,
    };
  }
}

export const couponScheduleJob = new CouponScheduleJob();

const runCouponCheck = async () => {
  try {
    await couponScheduleJob.process();
  } catch (error: any) {
    logger.error(`❌ Coupon schedule job error: ${error.message}`);
  }
};

// Cron schedule; default every 5 minutes
const cronSchedule = process.env.COUPON_SCHEDULE_JOB_CRON || "*/5 * * * *";
if (!cron.validate(cronSchedule)) {
  logger.error(`❌ Invalid cron schedule for Coupon job: ${cronSchedule}`);
} else {
  const cronTask = cron.schedule(cronSchedule, () => {
    logger.info("🕐 [CRON] Coupon schedule job triggered");
    runCouponCheck();
  });
  cronTask.start();
  logger.info(`✅ Coupon schedule cron job scheduled: ${cronSchedule}`);
}

// Run once on startup after 5 seconds
setTimeout(runCouponCheck, 5000);
