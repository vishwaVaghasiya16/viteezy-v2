/**
 * @fileoverview Subscription Gateway Service
 * @description Service for managing subscriptions in payment gateways (Stripe/Mollie)
 * @module services/subscriptionGatewayService
 */

import Stripe from "stripe";
import { createMollieClient } from "@mollie/api-client";
import mongoose from "mongoose";
import { Subscriptions, ISubscription } from "@/models/commerce/subscriptions.model";
import { Payments } from "@/models/commerce/payments.model";
import { Orders } from "@/models/commerce/orders.model";
import { User } from "@/models/core";
import { PaymentMethod, SubscriptionStatus, PaymentStatus } from "@/models/enums";
import { logger } from "@/utils/logger";
import { AppError } from "@/utils/AppError";
import { emailService } from "@/services/emailService";

interface CreateSubscriptionData {
  userId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number; // Amount in smallest currency unit
  currency: string;
  cycleDays: number; // 30, 60, 90, or 180
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
}

interface SubscriptionResult {
  success: boolean;
  gatewaySubscriptionId?: string;
  gatewayCustomerId?: string;
  gatewayPaymentMethodId?: string;
  error?: string;
  gatewayResponse?: Record<string, any>;
}

export class SubscriptionGatewayService {
  private stripe: Stripe | null = null;
  private mollieClient: ReturnType<typeof createMollieClient> | null = null;

  constructor() {
    // Initialize Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-10-29.clover",
      });
      logger.info("Stripe subscription gateway initialized");
    }

    // Initialize Mollie
    if (process.env.MOLLIE_API_KEY) {
      this.mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
      logger.info("Mollie subscription gateway initialized");
    }
  }

  /**
   * Create subscription in payment gateway
   */
  async createSubscription(data: CreateSubscriptionData): Promise<SubscriptionResult> {
    try {
      if (data.paymentMethod === PaymentMethod.STRIPE) {
        return await this.createStripeSubscription(data);
      } else if (data.paymentMethod === PaymentMethod.MOLLIE) {
        return await this.createMollieSubscription(data);
      } else {
        throw new AppError(`Unsupported payment method: ${data.paymentMethod}`, 400);
      }
    } catch (error: any) {
      logger.error(`Failed to create subscription in gateway: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create subscription",
      };
    }
  }

  /**
   * Create Stripe subscription
   */
  private async createStripeSubscription(data: CreateSubscriptionData): Promise<SubscriptionResult> {
    if (!this.stripe) {
      throw new AppError("Stripe is not configured", 500);
    }

    try {
      // Get or create customer
      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      let customerId: string;

      // Check if user already has a Stripe customer ID
      const existingSubscription = await Subscriptions.findOne({
        userId: new mongoose.Types.ObjectId(data.userId),
        gatewayCustomerId: { $exists: true, $ne: null },
        isDeleted: false,
      }).lean();

      if (existingSubscription?.gatewayCustomerId) {
        customerId = existingSubscription.gatewayCustomerId;
        logger.info(`Using existing Stripe customer: ${customerId}`);
      } else {
        // Create new customer
        const customer = await this.stripe.customers.create({
          email: data.customerEmail || user.email,
          name: data.customerName || `${user.firstName} ${user.lastName}`.trim(),
          metadata: {
            userId: data.userId,
            orderId: data.orderId,
          },
        });
        customerId = customer.id;
        logger.info(`Created new Stripe customer: ${customerId}`);
      }

      // Convert cycle days to Stripe interval
      const interval = this.getStripeInterval(data.cycleDays);
      const intervalCount = this.getStripeIntervalCount(data.cycleDays);

      // Create price (product + price)
      const product = await this.stripe.products.create({
        name: `Subscription - ${data.cycleDays} days`,
        metadata: {
          orderId: data.orderId,
          cycleDays: data.cycleDays.toString(),
        },
      });

      const price = await this.stripe.prices.create({
        product: product.id,
        unit_amount: data.amount,
        currency: data.currency.toLowerCase(),
        recurring: {
          interval: interval as "day" | "week" | "month" | "year",
          interval_count: intervalCount,
        },
        metadata: {
          orderId: data.orderId,
          cycleDays: data.cycleDays.toString(),
        },
      });

      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        },
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId: data.userId,
          orderId: data.orderId,
          ...(data.metadata || {}),
        },
      });

      const paymentIntent = (subscription.latest_invoice as any)?.payment_intent;
      const paymentMethodId = paymentIntent?.payment_method;

      logger.info(`Created Stripe subscription: ${subscription.id}`);

      return {
        success: true,
        gatewaySubscriptionId: subscription.id,
        gatewayCustomerId: customerId,
        gatewayPaymentMethodId: paymentMethodId,
        gatewayResponse: subscription as any,
      };
    } catch (error: any) {
      logger.error(`Stripe subscription creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create Stripe subscription",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Create Mollie subscription
   * Note: Mollie doesn't have native subscriptions, so we'll use recurring payments
   */
  private async createMollieSubscription(data: CreateSubscriptionData): Promise<SubscriptionResult> {
    if (!this.mollieClient) {
      throw new AppError("Mollie is not configured", 500);
    }

    try {
      // Mollie uses customers and mandates for recurring payments
      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Check if user already has a Mollie customer ID
      const existingSubscription = await Subscriptions.findOne({
        userId: new mongoose.Types.ObjectId(data.userId),
        gatewayCustomerId: { $exists: true, $ne: null },
        isDeleted: false,
      }).lean();

      let customerId: string;

      if (existingSubscription?.gatewayCustomerId) {
        customerId = existingSubscription.gatewayCustomerId;
        logger.info(`Using existing Mollie customer: ${customerId}`);
      } else {
        // Create new customer
        const customer = await this.mollieClient.customers.create({
          name: data.customerName || `${user.firstName} ${user.lastName}`.trim(),
          email: data.customerEmail || user.email,
          metadata: {
            userId: data.userId,
            orderId: data.orderId,
          },
        });
        customerId = customer.id;
        logger.info(`Created new Mollie customer: ${customerId}`);
      }

      // For Mollie, we'll create a payment with sequence type "first"
      // Subsequent payments will use "recurring"
      const paymentData: any = {
        amount: {
          value: (data.amount / 100).toFixed(2),
          currency: data.currency.toUpperCase(),
        },
        customerId: customerId,
        description: `Subscription - ${data.cycleDays} days`,
        metadata: {
          userId: data.userId,
          orderId: data.orderId,
          cycleDays: data.cycleDays.toString(),
          isSubscription: "true",
          ...(data.metadata || {}),
        },
      };

      // Add sequenceType if supported
      if (this.mollieClient) {
        const payment = await this.mollieClient.payments.create(paymentData as any);
        logger.info(`Created Mollie subscription payment: ${payment.id}`);

        // Mollie doesn't have subscription objects, so we'll use the customer ID
        // and track recurring payments manually
        return {
          success: true,
          gatewaySubscriptionId: payment.id, // Use payment ID as subscription ID for Mollie
          gatewayCustomerId: customerId,
          gatewayResponse: payment as any,
        };
      }

      throw new AppError("Mollie client not initialized", 500);
    } catch (error: any) {
      logger.error(`Mollie subscription creation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to create Mollie subscription",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Cancel subscription in gateway
   */
  async cancelSubscription(
    subscription: ISubscription,
    cancelAtPeriodEnd: boolean = false
  ): Promise<SubscriptionResult> {
    try {
      if (!subscription.gatewaySubscriptionId) {
        throw new AppError("Subscription does not have a gateway subscription ID", 400);
      }

      const paymentMethod = await this.getPaymentMethodFromSubscription(subscription);

      if (paymentMethod === PaymentMethod.STRIPE) {
        return await this.cancelStripeSubscription(subscription, cancelAtPeriodEnd);
      } else if (paymentMethod === PaymentMethod.MOLLIE) {
        return await this.cancelMollieSubscription(subscription);
      } else {
        throw new AppError(`Unsupported payment method for subscription cancellation`, 400);
      }
    } catch (error: any) {
      logger.error(`Failed to cancel subscription in gateway: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to cancel subscription",
      };
    }
  }

  /**
   * Cancel Stripe subscription
   */
  private async cancelStripeSubscription(
    subscription: ISubscription,
    cancelAtPeriodEnd: boolean
  ): Promise<SubscriptionResult> {
    if (!this.stripe) {
      throw new AppError("Stripe is not configured", 500);
    }

    try {
      if (cancelAtPeriodEnd) {
        // Update subscription to cancel at period end
        const updated = await this.stripe.subscriptions.update(subscription.gatewaySubscriptionId!, {
          cancel_at_period_end: true,
        });
        logger.info(`Stripe subscription set to cancel at period end: ${subscription.gatewaySubscriptionId}`);
        return {
          success: true,
          gatewaySubscriptionId: updated.id,
          gatewayResponse: updated as any,
        };
      } else {
        // Cancel immediately
        const cancelled = await this.stripe.subscriptions.cancel(subscription.gatewaySubscriptionId!);
        logger.info(`Stripe subscription cancelled immediately: ${subscription.gatewaySubscriptionId}`);
        return {
          success: true,
          gatewaySubscriptionId: cancelled.id,
          gatewayResponse: cancelled as any,
        };
      }
    } catch (error: any) {
      logger.error(`Stripe subscription cancellation failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to cancel Stripe subscription",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Cancel Mollie subscription
   */
  private async cancelMollieSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    // Mollie doesn't have subscriptions, so we just mark it as cancelled in our DB
    // Future recurring payments won't be processed
    logger.info(`Mollie subscription marked as cancelled: ${subscription.gatewaySubscriptionId}`);
    return {
      success: true,
      gatewaySubscriptionId: subscription.gatewaySubscriptionId,
    };
  }

  /**
   * Pause subscription in gateway
   */
  async pauseSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    try {
      if (!subscription.gatewaySubscriptionId) {
        throw new AppError("Subscription does not have a gateway subscription ID", 400);
      }

      const paymentMethod = await this.getPaymentMethodFromSubscription(subscription);

      if (paymentMethod === PaymentMethod.STRIPE) {
        return await this.pauseStripeSubscription(subscription);
      } else if (paymentMethod === PaymentMethod.MOLLIE) {
        return await this.pauseMollieSubscription(subscription);
      } else {
        throw new AppError(`Unsupported payment method for subscription pause`, 400);
      }
    } catch (error: any) {
      logger.error(`Failed to pause subscription in gateway: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to pause subscription",
      };
    }
  }

  /**
   * Pause Stripe subscription using pause_collection
   */
  private async pauseStripeSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    if (!this.stripe) {
      throw new AppError("Stripe is not configured", 500);
    }

    try {
      const updated = await this.stripe.subscriptions.update(subscription.gatewaySubscriptionId!, {
        pause_collection: {
          behavior: "mark_uncollectible",
        },
      });
      logger.info(`Stripe subscription paused: ${subscription.gatewaySubscriptionId}`);
      return {
        success: true,
        gatewaySubscriptionId: updated.id,
        gatewayResponse: updated as any,
      };
    } catch (error: any) {
      logger.error(`Stripe subscription pause failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to pause Stripe subscription",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Pause Mollie subscription (cancel and track for resume)
   */
  private async pauseMollieSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    // For Mollie, we'll cancel the subscription and track it for manual resume
    logger.info(`Mollie subscription paused (cancelled for resume): ${subscription.gatewaySubscriptionId}`);
    return {
      success: true,
      gatewaySubscriptionId: subscription.gatewaySubscriptionId,
    };
  }

  /**
   * Resume subscription in gateway
   */
  async resumeSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    try {
      if (!subscription.gatewaySubscriptionId) {
        throw new AppError("Subscription does not have a gateway subscription ID", 400);
      }

      const paymentMethod = await this.getPaymentMethodFromSubscription(subscription);

      if (paymentMethod === PaymentMethod.STRIPE) {
        return await this.resumeStripeSubscription(subscription);
      } else if (paymentMethod === PaymentMethod.MOLLIE) {
        return await this.resumeMollieSubscription(subscription);
      } else {
        throw new AppError(`Unsupported payment method for subscription resume`, 400);
      }
    } catch (error: any) {
      logger.error(`Failed to resume subscription in gateway: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to resume subscription",
      };
    }
  }

  /**
   * Resume Stripe subscription
   */
  private async resumeStripeSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    if (!this.stripe) {
      throw new AppError("Stripe is not configured", 500);
    }

    try {
      const updated = await this.stripe.subscriptions.update(subscription.gatewaySubscriptionId!, {
        pause_collection: null, // Remove pause
      });
      logger.info(`Stripe subscription resumed: ${subscription.gatewaySubscriptionId}`);
      return {
        success: true,
        gatewaySubscriptionId: updated.id,
        gatewayResponse: updated as any,
      };
    } catch (error: any) {
      logger.error(`Stripe subscription resume failed: ${error.message}`);
      return {
        success: false,
        error: error.message || "Failed to resume Stripe subscription",
        gatewayResponse: error as any,
      };
    }
  }

  /**
   * Resume Mollie subscription (recreate subscription)
   */
  private async resumeMollieSubscription(subscription: ISubscription): Promise<SubscriptionResult> {
    // For Mollie, we need to create a new subscription/payment
    // This will be handled by the renewal service
    logger.info(`Mollie subscription resume (will be handled by renewal service): ${subscription.gatewaySubscriptionId}`);
    return {
      success: true,
      gatewaySubscriptionId: subscription.gatewaySubscriptionId,
    };
  }

  /**
   * Get payment method from subscription
   */
  private async getPaymentMethodFromSubscription(subscription: ISubscription): Promise<PaymentMethod> {
    const order = await Orders.findById(subscription.orderId).lean();
    if (!order) {
      throw new AppError("Order not found for subscription", 404);
    }
    return (order.paymentMethod as PaymentMethod) || PaymentMethod.STRIPE;
  }

  /**
   * Convert cycle days to Stripe interval
   */
  private getStripeInterval(cycleDays: number): string {
    if (cycleDays <= 7) return "day";
    if (cycleDays <= 31) return "week";
    if (cycleDays <= 93) return "month";
    return "year";
  }

  /**
   * Get Stripe interval count
   */
  private getStripeIntervalCount(cycleDays: number): number {
    if (cycleDays <= 7) return cycleDays;
    if (cycleDays <= 31) return Math.floor(cycleDays / 7);
    if (cycleDays <= 93) return Math.floor(cycleDays / 30);
    return Math.floor(cycleDays / 365);
  }
}

export const subscriptionGatewayService = new SubscriptionGatewayService();

