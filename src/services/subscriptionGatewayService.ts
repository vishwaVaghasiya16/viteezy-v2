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

interface OrderItem {
  productId: string;
  name: string;
  planDays?: number;
  capsuleCount?: number;
  amount: number; // Original amount per unit
  discountedPrice: number; // Discounted price per unit
  taxRate: number; // Tax rate per unit
  totalAmount: number; // Total amount for this item
  durationDays?: number;
  savingsPercentage?: number;
  features?: string[];
}

interface CreateSubscriptionData {
  userId: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number; // Total amount in smallest currency unit
  currency: string;
  cycleDays: number; // 30, 60, 90, or 180
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, string>;
  paymentIntentId?: string; // Payment intent ID from completed payment
  orderItems?: OrderItem[]; // Sachets items from order for creating individual products
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
    console.log("🔵 [STRIPE API] ========== Stripe Subscription Creation ==========");
    console.log("🔵 [STRIPE API] Starting Stripe API calls...");
    
    if (!this.stripe) {
      console.error("❌ [STRIPE API] - Stripe is not configured");
      throw new AppError("Stripe is not configured", 500);
    }

    try {
      console.log("🔵 [STRIPE API] Step 1: Fetching user from database...");
      // Get or create customer
      const user = await User.findById(data.userId);
      if (!user) {
        console.error("❌ [STRIPE API] - User not found for userId:", data.userId);
        throw new AppError("User not found", 404);
      }
      console.log("✅ [STRIPE API] - User found:", user.email);

      let customerId: string;
      let defaultPaymentMethodId: string | undefined;

      console.log("🔵 [STRIPE API] Step 2: Checking for existing Stripe customer...");
      // Check if user already has a Stripe customer ID
      const existingSubscription = await Subscriptions.findOne({
        userId: new mongoose.Types.ObjectId(data.userId),
        gatewayCustomerId: { $exists: true, $ne: null },
        isDeleted: false,
      }).lean();

      if (existingSubscription?.gatewayCustomerId) {
        customerId = existingSubscription.gatewayCustomerId;
        console.log("✅ [STRIPE API] - Using existing Stripe customer");
        console.log("   - Customer ID:", customerId);
        logger.info(`Using existing Stripe customer: ${customerId}`);
      } else {
        console.log("🔵 [STRIPE API] - No existing customer found, creating new Stripe customer...");
        console.log("   - Customer Email:", data.customerEmail || user.email);
        console.log("   - Customer Name:", data.customerName || `${user.firstName} ${user.lastName}`.trim());
        
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
        console.log("✅ [STRIPE API] - New Stripe customer created successfully!");
        console.log("   - Customer ID:", customerId);
        console.log("   - Customer Email:", customer.email);
        logger.info(`Created new Stripe customer: ${customerId}`);
      }

      // Step 2.5: Get payment method from completed payment intent
      if (data.paymentIntentId) {
        console.log("🔵 [STRIPE API] Step 2.5: Retrieving payment method from completed payment...");
        console.log("   - Payment Intent ID:", data.paymentIntentId);
        
        try {
          const paymentIntent = await this.stripe.paymentIntents.retrieve(data.paymentIntentId, {
            expand: ['payment_method'],
          });
          
          console.log("✅ [STRIPE API] - Payment intent retrieved");
          console.log("   - Payment Intent ID:", paymentIntent.id);
          console.log("   - Payment Intent Status:", paymentIntent.status);
          
          // Get payment method from payment intent
          const paymentMethod = typeof paymentIntent.payment_method === 'string' 
            ? paymentIntent.payment_method 
            : paymentIntent.payment_method?.id;
          
          if (paymentMethod) {
            console.log("   - Payment Method ID:", paymentMethod);
            
            // Attach payment method to customer
            console.log("🔵 [STRIPE API] - Attaching payment method to customer...");
            await this.stripe.paymentMethods.attach(paymentMethod, {
              customer: customerId,
            });
            console.log("✅ [STRIPE API] - Payment method attached to customer");
            
            // Set as default payment method for customer
            console.log("🔵 [STRIPE API] - Setting payment method as default for customer...");
            await this.stripe.customers.update(customerId, {
              invoice_settings: {
                default_payment_method: paymentMethod,
              },
            });
            console.log("✅ [STRIPE API] - Payment method set as default for customer");
            
            defaultPaymentMethodId = paymentMethod;
          } else {
            console.warn("⚠️ [STRIPE API] - No payment method found in payment intent");
          }
        } catch (pmError: any) {
          console.error("⚠️ [STRIPE API] - Error retrieving payment method:", pmError.message);
          console.error("   - This is not critical, subscription will be created but may be incomplete");
          // Don't fail - we'll create subscription anyway
        }
      } else {
        console.log("ℹ️ [STRIPE API] - No payment intent ID provided, subscription may be incomplete");
      }

      console.log("🔵 [STRIPE API] Step 3: Converting cycle days to Stripe interval...");
      // Convert cycle days to Stripe interval
      const interval = this.getStripeInterval(data.cycleDays);
      const intervalCount = this.getStripeIntervalCount(data.cycleDays);
      console.log("   - Cycle Days:", data.cycleDays);
      console.log("   - Subscription Plan:", this.getStripePlanDescription(data.cycleDays));
      console.log("   - Stripe Interval:", interval);
      console.log("   - Interval Count:", intervalCount);
      console.log("   - Stripe Recurring:", `${intervalCount} ${interval}(s)`);

      // Step 4: Create individual products and prices for each sachets item
      const subscriptionItems: Array<{ price: string }> = [];
      
      if (data.orderItems && data.orderItems.length > 0) {
        console.log("🔵 [STRIPE API] Step 4: Creating individual products for each sachets item...");
        console.log("   - Number of items:", data.orderItems.length);
        
        for (let i = 0; i < data.orderItems.length; i++) {
          const item = data.orderItems[i];
          console.log(`\n   📦 Creating product ${i + 1}/${data.orderItems.length}:`);
          console.log("      - Product Name:", item.name);
          console.log("      - Product ID:", item.productId);
          console.log("      - Amount per unit:", item.discountedPrice, data.currency);
          console.log("      - Total Amount:", item.totalAmount, data.currency);
          
          // Create product in Stripe catalog
          const product = await this.stripe.products.create({
            name: `${item.name} - ${data.cycleDays} Days Subscription`,
            description: `Subscription plan for ${item.name} - ${this.getStripePlanDescription(data.cycleDays)}`,
            metadata: {
              orderId: data.orderId,
              productId: item.productId,
              cycleDays: data.cycleDays.toString(),
              planDays: item.planDays?.toString() || data.cycleDays.toString(),
              userId: data.userId,
            },
          });
          console.log("      ✅ Product created:", product.id);
          
          // Create price for this product
          // Use discountedPrice per unit (in cents)
          const itemAmountInCents = Math.round(item.discountedPrice * 100);
          console.log("      - Creating price:", itemAmountInCents, "cents");
          
          const price = await this.stripe.prices.create({
            product: product.id,
            unit_amount: itemAmountInCents,
            currency: data.currency.toLowerCase(),
            recurring: {
              interval: interval as "day" | "week" | "month" | "year",
              interval_count: intervalCount,
            },
            metadata: {
              orderId: data.orderId,
              productId: item.productId,
              cycleDays: data.cycleDays.toString(),
              planDays: item.planDays?.toString() || data.cycleDays.toString(),
              itemName: item.name,
              userId: data.userId,
            },
          });
          console.log("      ✅ Price created:", price.id);
          console.log("      - Price Amount:", price.unit_amount, price.currency);
          console.log("      - Recurring:", price.recurring ? "Yes" : "No");
          
          // Add to subscription items
          subscriptionItems.push({ price: price.id });
        }
        
        console.log(`\n✅ [STRIPE API] - Created ${subscriptionItems.length} products and prices in Stripe catalog`);
      } else {
        // Fallback: Create single product if no items provided
        console.log("🔵 [STRIPE API] Step 4: Creating single Stripe product (no items provided)...");
        console.log("   - Product Name: Subscription -", data.cycleDays, "days");
        
        const product = await this.stripe.products.create({
          name: `Subscription - ${data.cycleDays} days`,
          description: `Subscription plan - ${this.getStripePlanDescription(data.cycleDays)}`,
          metadata: {
            orderId: data.orderId,
            cycleDays: data.cycleDays.toString(),
            userId: data.userId,
          },
        });
        console.log("✅ [STRIPE API] - Stripe product created successfully!");
        console.log("   - Product ID:", product.id);
        console.log("   - Product Name:", product.name);

        console.log("🔵 [STRIPE API] Step 5: Creating Stripe price...");
        console.log("   - Amount:", data.amount, "cents");
        console.log("   - Currency:", data.currency);
        console.log("   - Recurring Interval:", interval);
        console.log("   - Interval Count:", intervalCount);
        
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
            userId: data.userId,
          },
        });
        console.log("✅ [STRIPE API] - Stripe price created successfully!");
        console.log("   - Price ID:", price.id);
        console.log("   - Price Amount:", price.unit_amount, price.currency);
        console.log("   - Recurring:", price.recurring ? "Yes" : "No");
        if (price.recurring) {
          console.log("   - Recurring Interval:", price.recurring.interval);
          console.log("   - Recurring Interval Count:", price.recurring.interval_count);
        }
        
        subscriptionItems.push({ price: price.id });
      }

      console.log("\n🔵 [STRIPE API] Step 6: Creating Stripe subscription with items...");
      console.log("   - Customer ID:", customerId);
      console.log("   - Number of subscription items:", subscriptionItems.length);
      subscriptionItems.forEach((item, index) => {
        console.log(`   - Item ${index + 1}: Price ID ${item.price}`);
      });
      console.log("   - Default Payment Method ID:", defaultPaymentMethodId || "N/A");
      
      // Build subscription creation parameters
      const subscriptionParams: any = {
        customer: customerId,
        items: subscriptionItems, // Multiple items, one for each product
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          userId: data.userId,
          orderId: data.orderId,
          cycleDays: data.cycleDays.toString(),
          itemCount: subscriptionItems.length.toString(),
          ...(data.metadata || {}),
        },
      };

      // If we have a payment method, use it to make subscription active immediately
      if (defaultPaymentMethodId) {
        console.log("   - Payment Behavior: default_incomplete (will be paid immediately)");
        console.log("   - Collection Method: charge_automatically");
        subscriptionParams.payment_behavior = "default_incomplete";
        subscriptionParams.default_payment_method = defaultPaymentMethodId;
        subscriptionParams.collection_method = "charge_automatically";
        subscriptionParams.payment_settings = {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        };
      } else {
        console.log("   - Payment Behavior: default_incomplete (no payment method available)");
        subscriptionParams.payment_behavior = "default_incomplete";
        subscriptionParams.collection_method = "charge_automatically";
        subscriptionParams.payment_settings = {
          payment_method_types: ["card"],
          save_default_payment_method: "on_subscription",
        };
      }
      
      console.log("   - Auto-Renew: Enabled (recurring price)");
      console.log("   - Metadata:", JSON.stringify(subscriptionParams.metadata, null, 2));
      
      // Create subscription
      const subscription = await this.stripe.subscriptions.create(subscriptionParams);

      // If we have a payment method and subscription is incomplete, pay the invoice
      if (defaultPaymentMethodId && (subscription.status === 'incomplete' || subscription.status === 'incomplete_expired')) {
        console.log("🔵 [STRIPE API] Step 7: Paying invoice to activate subscription...");
        const invoice = subscription.latest_invoice;
        let invoiceId: string | undefined;
        let invoiceObject: any;
        
        // Get invoice ID and retrieve full invoice object
        if (typeof invoice === 'string') {
          invoiceId = invoice;
        } else if (invoice && typeof invoice === 'object') {
          invoiceId = (invoice as any).id;
          invoiceObject = invoice;
        }
        
        if (invoiceId) {
          try {
            console.log("   - Invoice ID:", invoiceId);
            
            // Retrieve the full invoice object if we don't have it
            if (!invoiceObject) {
              invoiceObject = await this.stripe.invoices.retrieve(invoiceId, {
                expand: ['payment_intent'],
              });
            }
            
            console.log("   - Invoice Status:", invoiceObject.status);
            console.log("   - Invoice Amount Due:", invoiceObject.amount_due);
            
            // Finalize invoice if it's a draft
            if (invoiceObject.status === 'draft') {
              console.log("🔵 [STRIPE API] - Finalizing draft invoice...");
              invoiceObject = await this.stripe.invoices.finalizeInvoice(invoiceId);
              console.log("✅ [STRIPE API] - Invoice finalized");
              console.log("   - New Invoice Status:", invoiceObject.status);
            }
            
            // Pay the invoice using the payment method
            if (invoiceObject.status === 'open' || invoiceObject.status === 'draft') {
              console.log("🔵 [STRIPE API] - Paying invoice with payment method...");
              const paidInvoice = await this.stripe.invoices.pay(invoiceId, {
                payment_method: defaultPaymentMethodId,
                off_session: true, // Important: indicates customer is not present
              });
              console.log("✅ [STRIPE API] - Invoice paid successfully!");
              console.log("   - Invoice Status:", paidInvoice.status);
              const paidInvoiceData = paidInvoice as any;
              console.log("   - Invoice Paid:", paidInvoiceData.paid ? "Yes" : "No");
              
              // Wait a moment for Stripe to process
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Retrieve updated subscription
              const updatedSubscription = await this.stripe.subscriptions.retrieve(subscription.id, {
                expand: ['latest_invoice.payment_intent'],
              });
              console.log("✅ [STRIPE API] - Subscription status after payment:", updatedSubscription.status);
              
              // Update subscription variable with the updated one
              Object.assign(subscription, updatedSubscription);
              
              // If still incomplete, try updating subscription directly
              if (updatedSubscription.status === 'incomplete') {
                console.log("⚠️ [STRIPE API] - Subscription still incomplete, attempting to update...");
                try {
                  // Try to update subscription to set payment method and retry payment
                  const retrySubscription = await this.stripe.subscriptions.update(subscription.id, {
                    default_payment_method: defaultPaymentMethodId,
                  });
                  console.log("✅ [STRIPE API] - Subscription updated with payment method");
                  console.log("   - Updated Status:", retrySubscription.status);
                  Object.assign(subscription, retrySubscription);
                } catch (updateError: any) {
                  console.error("⚠️ [STRIPE API] - Error updating subscription:", updateError.message);
                }
              }
            } else if (invoiceObject.status === 'paid') {
              console.log("✅ [STRIPE API] - Invoice already paid");
              // Retrieve updated subscription
              const updatedSubscription = await this.stripe.subscriptions.retrieve(subscription.id);
              console.log("✅ [STRIPE API] - Subscription status:", updatedSubscription.status);
              Object.assign(subscription, updatedSubscription);
            } else {
              console.warn("⚠️ [STRIPE API] - Invoice status is:", invoiceObject.status, "- cannot pay");
            }
          } catch (payError: any) {
            console.error("❌ [STRIPE API] - Error paying invoice:", payError.message);
            console.error("   - Error Type:", payError.type || "N/A");
            console.error("   - Error Code:", payError.code || "N/A");
            if (payError.decline_code) {
              console.error("   - Decline Code:", payError.decline_code);
            }
            console.error("   - Subscription will remain incomplete, but can be paid later");
            // Don't fail - subscription is created, just incomplete
          }
        } else {
          console.warn("⚠️ [STRIPE API] - No invoice ID found in subscription");
        }
      } else if (!defaultPaymentMethodId) {
        console.warn("⚠️ [STRIPE API] - No payment method available, subscription will be incomplete");
      }

      console.log("✅ [STRIPE API] - Stripe subscription created successfully!");
      console.log("   - Subscription ID:", subscription.id);
      console.log("   - Subscription Status:", subscription.status);
      console.log("   - Customer ID:", typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as any)?.id || "N/A");
      const subData = subscription as any;
      if (subData.current_period_start) {
        console.log("   - Current Period Start:", new Date(subData.current_period_start * 1000).toISOString());
      }
      if (subData.current_period_end) {
        console.log("   - Current Period End:", new Date(subData.current_period_end * 1000).toISOString());
      }
      console.log("   - Cancel At Period End:", subData.cancel_at_period_end ? "Yes" : "No (Auto-renew enabled)");
      if (subData.collection_method) {
        console.log("   - Collection Method:", subData.collection_method);
      }
      if (subData.billing_cycle_anchor) {
        console.log("   - Billing Cycle Anchor:", new Date(subData.billing_cycle_anchor * 1000).toISOString());
      }

      const paymentIntent = (subscription.latest_invoice as any)?.payment_intent;
      const paymentMethodId = paymentIntent?.payment_method;
      
      if (paymentMethodId) {
        console.log("   - Payment Method ID:", paymentMethodId);
      }
      if (paymentIntent) {
        console.log("   - Payment Intent ID:", paymentIntent.id);
        console.log("   - Payment Intent Status:", paymentIntent.status);
      }

      console.log("✅ [STRIPE API] ============================================");

      logger.info(`Created Stripe subscription: ${subscription.id}`);

      return {
        success: true,
        gatewaySubscriptionId: subscription.id,
        gatewayCustomerId: customerId,
        gatewayPaymentMethodId: paymentMethodId,
        gatewayResponse: subscription as any,
      };
    } catch (error: any) {
      console.error("❌ [STRIPE API] - Stripe subscription creation failed!");
      console.error("   - Error Message:", error.message);
      console.error("   - Error Type:", error.type || "N/A");
      console.error("   - Error Code:", error.code || "N/A");
      if (error.stack) {
        console.error("   - Error Stack:", error.stack);
      }
      console.error("❌ [STRIPE API] ============================================");
      
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
        description: `Subscription - ${data.cycleDays} days (${this.getMollieDescription(data.cycleDays)})`,
        metadata: {
          userId: data.userId,
          orderId: data.orderId,
          cycleDays: data.cycleDays.toString(),
          isSubscription: "true",
          subscriptionCycle: this.getMollieDescription(data.cycleDays),
          ...(data.metadata || {}),
        },
      };

      // Add sequenceType if supported
      if (this.mollieClient) {
        console.log("🔵 [MOLLIE API] - Creating payment in Mollie...");
        const payment = await this.mollieClient.payments.create(paymentData as any);
        console.log("✅ [MOLLIE API] - Mollie payment created successfully!");
        console.log("   - Payment ID:", payment.id);
        console.log("   - Payment Status:", payment.status);
        console.log("   - Payment Amount:", payment.amount.value, payment.amount.currency);
        logger.info(`Created Mollie subscription payment: ${payment.id} for ${data.cycleDays} days cycle`);

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
   * Supports: 30, 60, 90, 180 days
   * All are converted to monthly intervals for consistency
   */
  private getStripeInterval(cycleDays: number): string {
    // For subscription plans: 30, 60, 90, 180 days
    // All are converted to "month" interval for Stripe
    if (cycleDays === 30 || cycleDays === 60 || cycleDays === 90 || cycleDays === 180) {
      return "month";
    }
    
    // Fallback for other values (shouldn't happen for valid subscriptions)
    if (cycleDays <= 7) return "day";
    if (cycleDays <= 31) return "week";
    if (cycleDays <= 93) return "month";
    return "year";
  }

  /**
   * Get Stripe interval count
   * Converts cycle days to number of months for Stripe recurring interval
   * Supports: 30, 60, 90, 180 days
   */
  private getStripeIntervalCount(cycleDays: number): number {
    // For subscription plans: 30, 60, 90, 180 days
    // Convert to months: 30 days = 1 month, 60 = 2, 90 = 3, 180 = 6
    if (cycleDays === 30) return 1;   // 1 month (30 days)
    if (cycleDays === 60) return 2;   // 2 months (60 days)
    if (cycleDays === 90) return 3;   // 3 months (90 days)
    if (cycleDays === 180) return 6;  // 6 months (180 days)
    
    // Fallback for other values (shouldn't happen for valid subscriptions)
    if (cycleDays <= 7) return cycleDays;
    if (cycleDays <= 31) return Math.floor(cycleDays / 7);
    if (cycleDays <= 93) return Math.floor(cycleDays / 30);
    return Math.floor(cycleDays / 365);
  }

  /**
   * Get Stripe plan description
   * Returns human-readable description for Stripe subscription
   */
  private getStripePlanDescription(cycleDays: number): string {
    if (cycleDays === 30) return "30 Days (1 Month)";
    if (cycleDays === 60) return "60 Days (2 Months)";
    if (cycleDays === 90) return "90 Days (3 Months)";
    if (cycleDays === 180) return "180 Days (6 Months)";
    return `${cycleDays} Days`;
  }

  /**
   * Get Mollie subscription description
   * Returns human-readable description for Mollie payment metadata
   */
  private getMollieDescription(cycleDays: number): string {
    if (cycleDays === 30) return "30 Days (1 Month)";
    if (cycleDays === 60) return "60 Days (2 Months)";
    if (cycleDays === 90) return "90 Days (3 Months)";
    if (cycleDays === 180) return "180 Days (6 Months)";
    return `${cycleDays} Days`;
  }
}

export const subscriptionGatewayService = new SubscriptionGatewayService();

