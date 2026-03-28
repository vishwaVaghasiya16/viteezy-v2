/**
 * Scheduled job to process subscription cancellations
 * This job transitions subscriptions from PENDING_CANCELLATION to CANCELLED
 * when their scheduled cancellation date is reached
 */

import cron from 'node-cron';
import { Subscriptions } from '../models/commerce/subscriptions.model';
import { SubscriptionStatus } from '../models/enums';
import { logger } from '../utils/logger';

class SubscriptionCancellationJob {
  private cronSchedule = '0 0 * * *'; // Run daily at midnight UTC

  /**
   * Process scheduled cancellations
   * Finds subscriptions with PENDING_CANCELLATION status where scheduledCancellationDate is today or in the past
   * and transitions them to CANCELLED status
   */
  async processScheduledCancellations(limit: number = 100): Promise<void> {
    try {
      logger.info('🔄 [CANCELLATION JOB] Processing scheduled cancellations...');

      const now = new Date();
      
      // Find subscriptions that should be cancelled today
      const subscriptionsToCancel = await Subscriptions.find({
        status: SubscriptionStatus.PENDING_CANCELLATION,
        scheduledCancellationDate: { $lte: now },
        isDeleted: false,
      })
      .limit(limit)
      .lean();

      if (subscriptionsToCancel.length === 0) {
        logger.info('ℹ️ [CANCELLATION JOB] No subscriptions to cancel today');
        return;
      }

      logger.info(`📋 [CANCELLATION JOB] Found ${subscriptionsToCancel.length} subscriptions to cancel`);

      // Update subscriptions to CANCELLED status
      const updateResult = await Subscriptions.updateMany(
        {
          _id: { $in: subscriptionsToCancel.map((sub: any) => sub._id) },
          status: SubscriptionStatus.PENDING_CANCELLATION,
          scheduledCancellationDate: { $lte: now },
        },
        {
          $set: {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: now,
            // Keep subscriptionEndDate as is
            // Clear scheduledCancellationDate as cancellation is now processed
            scheduledCancellationDate: null,
          },
        }
      );

      logger.info(`✅ [CANCELLATION JOB] Successfully cancelled ${updateResult.modifiedCount} subscriptions`);

      // Log details of cancelled subscriptions
      for (const subscription of subscriptionsToCancel) {
        logger.info(`🔴 [CANCELLATION] Subscription ${subscription.subscriptionNumber} cancelled - was scheduled for ${subscription.scheduledCancellationDate}`);
      }

    } catch (error: any) {
      logger.error(`❌ [CANCELLATION JOB] Error processing scheduled cancellations: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start the scheduled cancellation job
   */
  start(): void {
    logger.info('🕐 Starting subscription cancellation job');
    
    const cronTask = cron.schedule(this.cronSchedule, async () => {
      logger.info('🕐 [CRON] Scheduled subscription cancellation job triggered');
      console.log('🔄 [CRON] Processing subscription cancellations...');
      
      try {
        await this.processScheduledCancellations(100);
        logger.info('✅ [CRON] Subscription cancellation job completed');
      } catch (error: any) {
        logger.error(`❌ [CRON] Subscription cancellation job error: ${error.message}`);
      }
    }, {
      timezone: 'UTC',
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('🛑 Stopping subscription cancellation job');
      cronTask.stop();
    });

    process.on('SIGTERM', () => {
      logger.info('🛑 Stopping subscription cancellation job');
      cronTask.stop();
    });
  }
}

export const subscriptionCancellationJob = new SubscriptionCancellationJob();
