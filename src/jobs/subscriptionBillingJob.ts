import cron from "node-cron";
import mongoose from "mongoose";
import { Subscriptions } from "@/models/commerce/subscriptions.model";
import { SubscriptionChanges } from "@/models/commerce/subscriptionChanges.model";
import { logger } from "@/utils/logger";
import { SubscriptionStatus } from "@/models/enums";

/**
 * Subscription Billing Job
 *
 * This job checks ACTIVE subscriptions whose nextBillingDate is due
 * and prepares them for billing using either the activePlanSnapshot
 * or a pending subscription change (newPlanSnapshot).
 *
 * Note: Actual payment charging is handled by existing payment/subscription
 * services and gateway-specific logic.
 */
export class SubscriptionBillingJob {
  private isRunning = false;

  async runOnce(limit: number = 100): Promise<void> {
    if (this.isRunning) {
      logger.warn("Subscription billing job is already running, skipping...");
      return;
    }

    this.isRunning = true;

    try {
      const now = new Date();

      const subscriptions = await Subscriptions.find({
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { $lte: now },
        isDeleted: false,
      })
        .limit(limit)
        .lean();

      for (const subscription of subscriptions) {
        try {
          await this.processSubscription(subscription as any);
        } catch (err: any) {
          logger.error(
            `Subscription billing job: failed processing subscription ${subscription._id}`,
            { error: err.message }
          );
        }
      }
    } catch (err: any) {
      logger.error("Subscription billing job failed", { error: err.message });
    } finally {
      this.isRunning = false;
    }
  }

  private async processSubscription(subscription: any): Promise<void> {
    const subscriptionId = subscription._id as mongoose.Types.ObjectId;

    // Check if there is a pending subscription change effective now
    const pendingChange = await SubscriptionChanges.findOne({
      subscriptionId,
      status: "PENDING",
      effectiveDate: { $lte: new Date() },
      isDeleted: false,
    }).lean();

    const planSnapshot =
      pendingChange?.newPlanSnapshot ||
      subscription.activePlanSnapshot ||
      subscription.items ||
      [];

    logger.info(
      `SubscriptionBillingJob: subscription ${subscriptionId.toString()} is due for billing. Using ${
        pendingChange ? "PENDING change snapshot" : "active plan/items"
      } with ${planSnapshot.length} items.`
    );

    // At this point you can integrate with existing payment/subscription
    // auto-renewal services to actually create renewal orders and charge
    // via Stripe/Mollie based on subscription.gateway.
  }
}

export const subscriptionBillingJob = new SubscriptionBillingJob();

// Cron: run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  logger.info("⏰ Subscription billing cron triggered (every 5 minutes)");
  await subscriptionBillingJob.runOnce();
});


