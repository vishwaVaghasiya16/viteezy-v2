/**
 * @fileoverview Subscription Webhook Service
 * @description Service for handling subscription-related webhook events from payment gateways
 * @module services/subscriptionWebhookService
 */

import mongoose from "mongoose";
import Stripe from "stripe";
import { Subscriptions, ISubscription } from "@/models/commerce/subscriptions.model";
import { Payments } from "@/models/commerce/payments.model";
import { Orders } from "@/models/commerce/orders.model";
import { WebhookEvents } from "@/models/commerce/webhookEvents.model";
import { User } from "@/models/core";
import { PaymentMethod, SubscriptionStatus, PaymentStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import { AppError } from "@/utils/AppError";
import { emailService } from "@/services/emailService";
import { subscriptionAutoRenewalService } from "@/services/subscriptionAutoRenewalService";

export class SubscriptionWebhookService {
  /**
   * Handle Stripe subscription webhook events with idempotency
   */
  async handleStripeSubscriptionEvent(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const eventId = event.id;
    const eventType = event.type;

    logger.info(`Processing Stripe subscription event: ${eventType} (ID: ${eventId})`);

    // Check idempotency - has this event been processed?
    const existingEvent = await WebhookEvents.findOne({
      eventId: eventId,
      gateway: PaymentMethod.STRIPE,
    });

    if (existingEvent?.processed) {
      logger.info(`Event ${eventId} already processed, skipping`);
      return {
        success: true,
        message: "Event already processed",
      };
    }

    // Create or update webhook event record
    let webhookEvent = existingEvent;
    if (!webhookEvent) {
      webhookEvent = await WebhookEvents.create({
        eventId: eventId,
        gateway: PaymentMethod.STRIPE,
        eventType: eventType,
        processed: false,
        payload: event as any,
        retryCount: 0,
      });
    } else {
      webhookEvent.retryCount += 1;
      webhookEvent.payload = event as any;
      await webhookEvent.save();
    }

    try {
      let result: { success: boolean; message: string };

      switch (eventType) {
        case "invoice.paid":
          result = await this.handleInvoicePaid(event);
          break;
        case "invoice.payment_failed":
          result = await this.handleInvoicePaymentFailed(event);
          break;
        case "customer.subscription.updated":
          result = await this.handleSubscriptionUpdated(event);
          break;
        case "customer.subscription.deleted":
          result = await this.handleSubscriptionDeleted(event);
          break;
        case "customer.subscription.paused":
          result = await this.handleSubscriptionPaused(event);
          break;
        case "customer.subscription.resumed":
          result = await this.handleSubscriptionResumed(event);
          break;
        default:
          logger.info(`Unhandled subscription event type: ${eventType}`);
          result = { success: true, message: `Event type ${eventType} not handled` };
      }

      // Mark event as processed
      webhookEvent.processed = true;
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return result;
    } catch (error: any) {
      logger.error(`Failed to process subscription event ${eventId}: ${error.message}`);
      webhookEvent.error = error.message;
      await webhookEvent.save();
      throw error;
    }
  }

  /**
   * Handle invoice.paid - Subscription renewal payment succeeded
   */
  private async handleInvoicePaid(event: Stripe.Event): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as any; // Use any to access expanded fields
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription?.id || null;

    logger.info(`Invoice paid for subscription: ${subscriptionId}`);

    if (!subscriptionId) {
      logger.warn("Invoice paid event without subscription ID");
      return { success: false, message: "No subscription ID in invoice" };
    }

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update subscription
    subscription.lastBilledDate = new Date(invoice.period_end * 1000);
    subscription.renewalCount = (subscription.renewalCount || 0) + 1;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.retryCount = 0; // Reset retry count on success
    subscription.nextRetryDate = undefined;

    // Calculate next billing date
    const cycleDays = subscription.cycleDays;
    const nextBillingDate = new Date(subscription.nextBillingDate);
    nextBillingDate.setDate(nextBillingDate.getDate() + cycleDays);
    subscription.nextBillingDate = nextBillingDate;

    const nextDeliveryDate = new Date(subscription.nextDeliveryDate);
    nextDeliveryDate.setDate(nextDeliveryDate.getDate() + cycleDays);
    subscription.nextDeliveryDate = nextDeliveryDate;

    await subscription.save();

    // Create payment record for renewal
    await Payments.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      orderId: subscription.orderId, // Link to original order
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.COMPLETED,
      amount: {
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency.toUpperCase(),
        taxRate: 0,
      },
      currency: invoice.currency.toUpperCase(),
      gatewayTransactionId: typeof invoice.payment_intent === 'string' 
        ? invoice.payment_intent 
        : invoice.payment_intent?.id || invoice.id,
      transactionId: typeof invoice.payment_intent === 'string' 
        ? invoice.payment_intent 
        : invoice.payment_intent?.id || invoice.id,
      processedAt: new Date(),
      isRenewalPayment: true,
      renewalCycleNumber: subscription.renewalCount,
      gatewayResponse: invoice as any,
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: subscriptionId,
        renewalNumber: subscription.renewalCount,
      },
    });

    logger.info(`Subscription ${subscription.subscriptionNumber} renewed successfully`);

    return { success: true, message: "Invoice paid processed successfully" };
  }

  /**
   * Handle invoice.payment_failed - Subscription renewal payment failed
   */
  private async handleInvoicePaymentFailed(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const invoice = event.data.object as any; // Use any to access expanded fields
    const subscriptionId = typeof invoice.subscription === 'string' 
      ? invoice.subscription 
      : invoice.subscription?.id || null;

    logger.warn(`Invoice payment failed for subscription: ${subscriptionId}`);

    if (!subscriptionId) {
      logger.warn("Invoice payment failed event without subscription ID");
      return { success: false, message: "No subscription ID in invoice" };
    }

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update subscription status to PAST_DUE
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.retryCount = (subscription.retryCount || 0) + 1;
    subscription.lastRetryDate = new Date();

    // Calculate next retry date (24 hours from now)
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + 1);
    subscription.nextRetryDate = nextRetryDate;

    await subscription.save();

    // Create failed payment record
    await Payments.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      orderId: subscription.orderId,
      paymentMethod: PaymentMethod.STRIPE,
      status: PaymentStatus.FAILED,
      amount: {
        amount: invoice.amount_due / 100,
        currency: invoice.currency.toUpperCase(),
        taxRate: 0,
      },
      currency: invoice.currency.toUpperCase(),
      gatewayTransactionId: typeof invoice.payment_intent === 'string' 
        ? invoice.payment_intent 
        : invoice.payment_intent?.id || invoice.id,
      failureReason: (invoice as any).last_payment_error?.message || "Payment failed",
      isRenewalPayment: true,
      renewalCycleNumber: (subscription.renewalCount || 0) + 1,
      gatewayResponse: invoice as any,
      metadata: {
        invoiceId: invoice.id,
        subscriptionId: subscriptionId,
        retryCount: subscription.retryCount,
      },
    });

    // Send email notification to user
    try {
      const user = await User.findById(subscription.userId).lean();
      if (user && user.email) {
        const userName = `${user.firstName} ${user.lastName}`.trim();
        await emailService.sendSubscriptionPaymentFailedEmail(
          user.email,
          userName,
          {
            subscriptionNumber: subscription.subscriptionNumber,
            amount: invoice.amount_due / 100,
            currency: invoice.currency.toUpperCase(),
            retryCount: subscription.retryCount,
            nextRetryDate: nextRetryDate,
            failureReason: (invoice as any).last_payment_error?.message || "Payment failed",
          }
        );
        logger.info(`Payment failed email sent to ${user.email}`);
      }
    } catch (emailError: any) {
      logger.error(`Failed to send payment failed email: ${emailError.message}`);
    }

    logger.warn(`Subscription ${subscription.subscriptionNumber} payment failed (retry ${subscription.retryCount})`);

    return { success: true, message: "Invoice payment failed processed successfully" };
  }

  /**
   * Handle customer.subscription.updated - Subscription updated (cancel_at_period_end, etc.)
   */
  private async handleSubscriptionUpdated(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const stripeSubscription = event.data.object as any; // Use any to access all fields
    const subscriptionId = stripeSubscription.id;

    logger.info(`Subscription updated: ${subscriptionId}`);

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update cancel_at_period_end
    if (stripeSubscription.cancel_at_period_end !== undefined) {
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      if (stripeSubscription.cancel_at_period_end && stripeSubscription.current_period_end) {
        subscription.cancelledAt = new Date(stripeSubscription.current_period_end * 1000);
        logger.info(`Subscription ${subscription.subscriptionNumber} set to cancel at period end`);
      }
    }

    // Update status based on Stripe status
    if (stripeSubscription.status === "active") {
      subscription.status = SubscriptionStatus.ACTIVE;
    } else if (stripeSubscription.status === "past_due") {
      subscription.status = SubscriptionStatus.PAST_DUE;
    } else if (stripeSubscription.status === "canceled") {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
    } else if (stripeSubscription.status === "paused") {
      subscription.status = SubscriptionStatus.PAUSED;
      subscription.pausedAt = new Date();
    }

    await subscription.save();

    return { success: true, message: "Subscription updated successfully" };
  }

  /**
   * Handle customer.subscription.deleted - Subscription cancelled
   */
  private async handleSubscriptionDeleted(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const stripeSubscription = event.data.object as Stripe.Subscription;
    const subscriptionId = stripeSubscription.id;

    logger.info(`Subscription deleted: ${subscriptionId}`);

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.CANCELLED;
    subscription.cancelledAt = new Date();
    subscription.isAutoRenew = false;

    await subscription.save();

    return { success: true, message: "Subscription deleted processed successfully" };
  }

  /**
   * Handle customer.subscription.paused - Subscription paused
   */
  private async handleSubscriptionPaused(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const stripeSubscription = event.data.object as Stripe.Subscription;
    const subscriptionId = stripeSubscription.id;

    logger.info(`Subscription paused: ${subscriptionId}`);

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.PAUSED;
    subscription.pausedAt = new Date();

    await subscription.save();

    return { success: true, message: "Subscription paused processed successfully" };
  }

  /**
   * Handle customer.subscription.resumed - Subscription resumed
   */
  private async handleSubscriptionResumed(
    event: Stripe.Event
  ): Promise<{ success: boolean; message: string }> {
    const stripeSubscription = event.data.object as Stripe.Subscription;
    const subscriptionId = stripeSubscription.id;

    logger.info(`Subscription resumed: ${subscriptionId}`);

    // Find subscription by gateway subscription ID
    const subscription = await Subscriptions.findOne({
      gatewaySubscriptionId: subscriptionId,
      isDeleted: false,
    });

    if (!subscription) {
      logger.warn(`Subscription not found for gateway ID: ${subscriptionId}`);
      return { success: false, message: "Subscription not found" };
    }

    // Update subscription status
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.pausedAt = undefined;
    subscription.pausedUntil = undefined;

    await subscription.save();

    return { success: true, message: "Subscription resumed processed successfully" };
  }

  /**
   * Handle Mollie subscription webhook events
   */
  async handleMollieSubscriptionEvent(
    paymentId: string,
    status: string
  ): Promise<{ success: boolean; message: string }> {
    logger.info(`Processing Mollie subscription event: ${paymentId} (Status: ${status})`);

    // Check idempotency
    const existingEvent = await WebhookEvents.findOne({
      eventId: paymentId,
      gateway: PaymentMethod.MOLLIE,
    });

    if (existingEvent?.processed) {
      logger.info(`Event ${paymentId} already processed, skipping`);
      return {
        success: true,
        message: "Event already processed",
      };
    }

    // Create or update webhook event record
    let webhookEvent = existingEvent;
    if (!webhookEvent) {
      webhookEvent = await WebhookEvents.create({
        eventId: paymentId,
        gateway: PaymentMethod.MOLLIE,
        eventType: `payment.${status}`,
        processed: false,
        payload: { paymentId, status } as any,
        retryCount: 0,
      });
    } else {
      webhookEvent.retryCount += 1;
      webhookEvent.payload = { paymentId, status } as any;
      await webhookEvent.save();
    }

    try {
      // Find subscription by gateway subscription ID (Mollie uses payment ID)
      const subscription = await Subscriptions.findOne({
        gatewaySubscriptionId: paymentId,
        isDeleted: false,
      });

      if (!subscription) {
        logger.warn(`Subscription not found for Mollie payment ID: ${paymentId}`);
        webhookEvent.processed = true;
        webhookEvent.processedAt = new Date();
        await webhookEvent.save();
        return { success: false, message: "Subscription not found" };
      }

      let result: { success: boolean; message: string };

      if (status === "paid") {
        result = await this.handleMolliePaymentPaid(paymentId, subscription);
      } else if (status === "failed") {
        result = await this.handleMolliePaymentFailed(paymentId, subscription);
      } else {
        result = { success: true, message: `Status ${status} not handled` };
      }

      // Mark event as processed
      webhookEvent.processed = true;
      webhookEvent.processedAt = new Date();
      await webhookEvent.save();

      return result;
    } catch (error: any) {
      logger.error(`Failed to process Mollie subscription event ${paymentId}: ${error.message}`);
      webhookEvent.error = error.message;
      await webhookEvent.save();
      throw error;
    }
  }

  /**
   * Handle Mollie payment paid (renewal)
   */
  private async handleMolliePaymentPaid(
    paymentId: string,
    subscription: ISubscription
  ): Promise<{ success: boolean; message: string }> {
    logger.info(`Mollie payment paid for subscription: ${subscription.subscriptionNumber}`);

    // Update subscription
    subscription.lastBilledDate = new Date();
    subscription.renewalCount = (subscription.renewalCount || 0) + 1;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.retryCount = 0;
    subscription.nextRetryDate = undefined;

    // Calculate next billing date
    const cycleDays = subscription.cycleDays;
    const nextBillingDate = new Date(subscription.nextBillingDate);
    nextBillingDate.setDate(nextBillingDate.getDate() + cycleDays);
    subscription.nextBillingDate = nextBillingDate;

    const nextDeliveryDate = new Date(subscription.nextDeliveryDate);
    nextDeliveryDate.setDate(nextDeliveryDate.getDate() + cycleDays);
    subscription.nextDeliveryDate = nextDeliveryDate;

    await subscription.save();

    // Create payment record (amount would come from Mollie API)
    const totalAmount = subscription.items.reduce((sum, item) => sum + item.totalAmount, 0);
    await Payments.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      orderId: subscription.orderId,
      paymentMethod: PaymentMethod.MOLLIE,
      status: PaymentStatus.COMPLETED,
      amount: {
        amount: totalAmount,
        currency: "EUR",
        taxRate: subscription.items[0]?.taxRate || 0,
      },
      currency: "EUR",
      gatewayTransactionId: paymentId,
      transactionId: paymentId,
      processedAt: new Date(),
      isRenewalPayment: true,
      renewalCycleNumber: subscription.renewalCount,
      metadata: {
        paymentId: paymentId,
        subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
        renewalNumber: subscription.renewalCount,
      },
    });

    logger.info(`Subscription ${subscription.subscriptionNumber} renewed successfully via Mollie`);

    return { success: true, message: "Mollie payment paid processed successfully" };
  }

  /**
   * Handle Mollie payment failed
   */
  private async handleMolliePaymentFailed(
    paymentId: string,
    subscription: ISubscription
  ): Promise<{ success: boolean; message: string }> {
    logger.warn(`Mollie payment failed for subscription: ${subscription.subscriptionNumber}`);

    // Update subscription status
    subscription.status = SubscriptionStatus.PAST_DUE;
    subscription.retryCount = (subscription.retryCount || 0) + 1;
    subscription.lastRetryDate = new Date();

    // Calculate next retry date
    const nextRetryDate = new Date();
    nextRetryDate.setDate(nextRetryDate.getDate() + 1);
    subscription.nextRetryDate = nextRetryDate;

    await subscription.save();

    // Create failed payment record
    const totalAmount = subscription.items.reduce((sum, item) => sum + item.totalAmount, 0);
    await Payments.create({
      subscriptionId: subscription._id,
      userId: subscription.userId,
      orderId: subscription.orderId,
      paymentMethod: PaymentMethod.MOLLIE,
      status: PaymentStatus.FAILED,
      amount: {
        amount: totalAmount,
        currency: "EUR",
        taxRate: subscription.items[0]?.taxRate || 0,
      },
      currency: "EUR",
      gatewayTransactionId: paymentId,
      failureReason: "Payment failed",
      isRenewalPayment: true,
      renewalCycleNumber: (subscription.renewalCount || 0) + 1,
      metadata: {
        paymentId: paymentId,
        subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
        retryCount: subscription.retryCount,
      },
    });

    // Send email notification
    try {
      const user = await User.findById(subscription.userId).lean();
      if (user && user.email) {
        const userName = `${user.firstName} ${user.lastName}`.trim();
        await emailService.sendSubscriptionPaymentFailedEmail(
          user.email,
          userName,
          {
            subscriptionNumber: subscription.subscriptionNumber,
            amount: totalAmount,
            currency: "EUR",
            retryCount: subscription.retryCount,
            nextRetryDate: nextRetryDate,
            failureReason: "Payment failed",
          }
        );
        logger.info(`Payment failed email sent to ${user.email}`);
      }
    } catch (emailError: any) {
      logger.error(`Failed to send payment failed email: ${emailError.message}`);
    }

    return { success: true, message: "Mollie payment failed processed successfully" };
  }
}

export const subscriptionWebhookService = new SubscriptionWebhookService();

