import cron from "node-cron";
import { HeaderBanner } from "@/models/cms/headerBanner.model";
import { logger } from "@/utils/logger";
import { config } from "@/config";
import { DeviceType } from "@/models/enums";

/**
 * Header Banner Schedule Job
 * 
 * This job processes scheduled banners:
 * - Activates banners whose startDate has arrived
 * - Deactivates banners whose endDate has passed
 * 
 * Runs every 5 minutes to ensure timely activation/deactivation
 */
export class HeaderBannerScheduleJob {
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private lastRunDuration: number = 0;
  private totalRuns: number = 0;
  private totalActivated: number = 0;
  private totalDeactivated: number = 0;

  /**
   * Process scheduled banners - activate/deactivate based on schedule
   */
  async processScheduledBanners(): Promise<{
    activated: number;
    deactivated: number;
    processed: number;
  }> {
    if (this.isRunning) {
      logger.warn("Header banner schedule job is already running, skipping...");
      return { activated: 0, deactivated: 0, processed: 0 };
    }

    const startTime = Date.now();
    this.isRunning = true;
    this.totalRuns++;

    try {
      const now = new Date();
      logger.info("🔄 Starting header banner schedule job...", {
        serverTimeUTC: now.toISOString(),
        serverTimeMs: now.getTime(),
      });

      let activated = 0;
      let deactivated = 0;

      // Find banners that should be activated only when now is INSIDE [startDate, endDate]
      // startDate <= now <= endDate (so we don't activate if end time already passed)
      const bannersToActivate = await HeaderBanner.find({
        isDeleted: { $ne: true },
        isScheduled: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
        isActive: false,
      }).lean();

      // Find banners that should be deactivated (endDate < now and active)
      const bannersToDeactivate = await HeaderBanner.find({
        isDeleted: { $ne: true },
        isScheduled: true,
        endDate: { $lt: now },
        isActive: true,
      }).lean();

      if (bannersToActivate.length > 0 || bannersToDeactivate.length > 0) {
        logger.info("📋 Banner schedule check", {
          toActivate: bannersToActivate.length,
          toDeactivate: bannersToDeactivate.length,
          nowUTC: now.toISOString(),
          activateIds: bannersToActivate.map((b) => b._id),
          deactivateIds: bannersToDeactivate.map((b) => b._id),
        });
      }

      // Process activations
      for (const banner of bannersToActivate) {
        try {
          // Deactivate all other active banners for the same device type
          await HeaderBanner.updateMany(
            {
              deviceType: banner.deviceType as DeviceType,
              isActive: true,
              isDeleted: { $ne: true },
              _id: { $ne: banner._id },
            },
            {
              $set: { isActive: false },
            }
          );

          // Activate this banner
          await HeaderBanner.updateOne(
            { _id: banner._id },
            { $set: { isActive: true } }
          );

          activated++;
          logger.info(
            `✅ Activated scheduled banner: ${banner._id} for device type: ${banner.deviceType}`
          );
        } catch (error: any) {
          logger.error(
            `❌ Failed to activate banner ${banner._id}: ${error.message}`
          );
        }
      }

      // Process deactivations
      for (const banner of bannersToDeactivate) {
        try {
          await HeaderBanner.updateOne(
            { _id: banner._id },
            { $set: { isActive: false } }
          );

          deactivated++;
          logger.info(
            `✅ Deactivated scheduled banner: ${banner._id} for device type: ${banner.deviceType}`
          );
        } catch (error: any) {
          logger.error(
            `❌ Failed to deactivate banner ${banner._id}: ${error.message}`
          );
        }
      }

      const processed = activated + deactivated;
      this.totalActivated += activated;
      this.totalDeactivated += deactivated;

      if (processed > 0) {
        logger.info(
          `✅ Header banner schedule job completed: ${activated} activated, ${deactivated} deactivated`
        );
      }

      return { activated, deactivated, processed };
    } catch (error: any) {
      logger.error(
        `❌ Header banner schedule job failed: ${error.message}`,
        {
          error: error.stack,
        }
      );
      throw error;
    } finally {
      this.isRunning = false;
      const duration = Date.now() - startTime;
      this.lastRunTime = new Date();
      this.lastRunDuration = duration;
      logger.info(`⏱️ Header banner schedule job took ${duration}ms`);
    }
  }

  /**
   * Get job status
   */
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

export const headerBannerScheduleJob = new HeaderBannerScheduleJob();

// Run the schedule check (shared by both cron and setInterval)
const runScheduleCheck = async () => {
  try {
    await headerBannerScheduleJob.processScheduledBanners();
  } catch (error: any) {
    logger.error(`❌ Header banner schedule job error: ${error.message}`);
  }
};

// 1) Cron: every 5 minutes
const cronSchedule = config.jobs.headerBannerCron;
const cronTask = cron.schedule(cronSchedule, () => {
  logger.info("🕐 [CRON] Scheduled header banner job triggered");
  runScheduleCheck();
});
cronTask.start();

// 2) setInterval: run every 2 minutes so banners activate close to start time
const INTERVAL_MS = 2 * 60 * 1000;
const intervalId = setInterval(runScheduleCheck, INTERVAL_MS);

// Run once on startup after 5 seconds (so DB is ready)
setTimeout(runScheduleCheck, 5000);

logger.info(`✅ Header banner schedule: cron ${cronSchedule} + check every 2 min`);
