import mongoose from "mongoose";
import { Subscriptions, ISubscription } from "@/models/commerce/subscriptions.model";
import { Payments } from "@/models/commerce/payments.model";
import { SubscriptionRenewalHistory } from "@/models/commerce/subscriptionRenewalHistory.model";
import { Orders } from "@/models/commerce/orders.model";
import { User } from "@/models/core";
import { SubscriptionStatus, PaymentStatus, PaymentMethod, OrderStatus, ProductVariant } from "@/models/enums";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { PaymentService } from "./payment/PaymentService";

interface RenewalResult {
  success: boolean;
  subscriptionId: string;
  renewalNumber: number;
  paymentId?: string;
  orderId?: string;
  error?: string;
}

export class SubscriptionAutoRenewalService {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  /**
   * Process auto-renewal for a single subscription
   * @param subscription - Subscription document to renew
   * @returns Renewal result
   */
  async processRenewal(subscription: ISubscription): Promise<RenewalResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(
        `Processing auto-renewal for subscription: ${subscription.subscriptionNumber} (ID: ${subscription._id})`
      );

      // Validate subscription is eligible for renewal
      if (!this.isEligibleForRenewal(subscription)) {
        throw new AppError(
          `Subscription ${subscription.subscriptionNumber} is not eligible for renewal`,
          400
        );
      }

      // Calculate new dates
      const cycleDays = subscription.cycleDays;
      const now = new Date();
      const newBillingDate = new Date(subscription.nextBillingDate);
      newBillingDate.setDate(newBillingDate.getDate() + cycleDays);

      const newDeliveryDate = new Date(subscription.nextDeliveryDate);
      newDeliveryDate.setDate(newDeliveryDate.getDate() + cycleDays);

      // Calculate renewal amount (sum of all items)
      const totalAmount = subscription.items.reduce(
        (sum, item) => sum + item.totalAmount,
        0
      );

      const currency = subscription.items[0]?.totalAmount
        ? "EUR" // Default currency, adjust based on your needs
        : "EUR";

      // Get user's payment method from original order or subscription metadata
      const originalOrder = await Orders.findById(subscription.orderId).lean();
      const paymentMethod =
        (originalOrder?.paymentMethod as PaymentMethod) || PaymentMethod.STRIPE;

      // Create payment for renewal
      const payment = await Payments.create(
        [
          {
            subscriptionId: subscription._id as mongoose.Types.ObjectId,
            userId: subscription.userId,
            paymentMethod: paymentMethod,
            status: PaymentStatus.PENDING,
            amount: {
              amount: totalAmount,
              currency: currency,
              taxRate: subscription.items[0]?.taxRate || 0,
            },
            currency: currency,
            isRenewalPayment: true,
            renewalCycleNumber: subscription.renewalCount + 1,
            metadata: {
              subscriptionNumber: subscription.subscriptionNumber,
              renewalNumber: subscription.renewalCount + 1,
              cycleDays: cycleDays,
            },
          },
        ],
        { session }
      ).then((docs) => docs[0] as any);

      logger.info(
        `Created renewal payment: ${payment._id} for subscription: ${subscription.subscriptionNumber}`
      );

      // Get original payment to retrieve gateway customer ID and payment method
      const originalPayment = await Payments.findOne({
        orderId: subscription.orderId,
        status: PaymentStatus.COMPLETED,
        isDeleted: false,
      }).lean();

      // Process payment via payment gateway (real-time payment for all subscriptions including test)
      let paymentResult: any = null;
      let paymentProcessed = false;

      try {
        // Process payment through gateway for all subscriptions (including test subscriptions)
        if (originalPayment?.gatewayTransactionId) {
          logger.info(
            `Processing renewal payment via ${paymentMethod} for subscription: ${subscription.subscriptionNumber}`
          );

          // For renewal payments, we need to charge the customer's saved payment method
          // This is a simplified implementation - in production, you should:
          // 1. Store customer ID and payment method ID when creating initial subscription
          // 2. Use Stripe Subscriptions or Mollie recurring payments for automatic renewals
          // 3. Or charge saved payment methods directly

          // For now, we'll create a payment intent/charge through the gateway
          // Note: This requires the customer to have a saved payment method
          // If not available, payment will be marked as PENDING and can be processed via webhook

          // Get payment gateway adapter
          // Note: We need to access the private getGateway method or create payment through PaymentService
          // For now, we'll use PaymentService.createPayment which handles gateway internally
          // This creates a payment intent that requires user confirmation
          // In production, you should use saved payment methods for automatic charging
          
          // Create payment through PaymentService (this will create payment intent via gateway)
          const user = await User.findById(subscription.userId).lean();
          if (!user) {
            throw new AppError("User not found for subscription renewal", 404);
          }

          // Create a renewal order first (required for PaymentService)
          const renewalOrderNumber = `REN-${subscription.subscriptionNumber}-${subscription.renewalCount + 1}`;
          const renewalOrder = await Orders.create(
            [
              {
                orderNumber: renewalOrderNumber,
                userId: subscription.userId,
                planType: subscription.planType,
                items: subscription.items.map((item) => ({
                  productId: item.productId,
                  name: item.name,
                  variantType: ProductVariant.SACHETS, // Subscriptions are only for SACHETS items
                  planDays: item.planDays,
                  capsuleCount: item.capsuleCount,
                  amount: item.amount,
                  discountedPrice: item.discountedPrice,
                  taxRate: item.taxRate,
                  totalAmount: item.totalAmount,
                  durationDays: item.durationDays,
                  savingsPercentage: item.savingsPercentage,
                  features: item.features || [],
                })),
                pricing: {
                  sachets: {
                    subTotal: subscription.items.reduce((sum, item) => sum + item.amount, 0),
                    discountedPrice: subscription.items.reduce(
                      (sum, item) => sum + item.discountedPrice,
                      0
                    ),
                    membershipDiscountAmount: 0,
                    subscriptionPlanDiscountAmount: 0,
                    taxAmount: subscription.items.reduce(
                      (sum, item) => sum + (item.totalAmount - item.discountedPrice) * (item.taxRate / 100),
                      0
                    ),
                    total: totalAmount,
                    currency: currency,
                  },
                  overall: {
                    subTotal: subscription.items.reduce((sum, item) => sum + item.amount, 0),
                    discountedPrice: subscription.items.reduce(
                      (sum, item) => sum + item.discountedPrice,
                      0
                    ),
                    couponDiscountAmount: 0,
                    membershipDiscountAmount: 0,
                    subscriptionPlanDiscountAmount: 0,
                    taxAmount: subscription.items.reduce(
                      (sum, item) => sum + (item.totalAmount - item.discountedPrice) * (item.taxRate / 100),
                      0
                    ),
                    grandTotal: totalAmount,
                    currency: currency,
                  },
                },
                shippingAddressId: originalOrder?.shippingAddressId || new mongoose.Types.ObjectId(),
                billingAddressId: originalOrder?.billingAddressId || new mongoose.Types.ObjectId(),
                paymentMethod: paymentMethod,
                paymentStatus: PaymentStatus.PENDING,
                status: OrderStatus.PENDING,
                metadata: {
                  isRenewalOrder: true,
                  subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
                  renewalNumber: subscription.renewalCount + 1,
                  originalOrderId: (subscription.orderId as mongoose.Types.ObjectId).toString(),
                },
              },
            ],
            { session }
          ).then((docs) => docs[0] as any);

          // Create payment through PaymentService
          const paymentServiceResult = await this.paymentService.createPayment({
            orderId: (renewalOrder._id as mongoose.Types.ObjectId).toString(),
            userId: (subscription.userId as mongoose.Types.ObjectId).toString(),
            paymentMethod: paymentMethod,
            amount: {
              value: totalAmount,
              currency: currency,
            },
            description: `Subscription renewal for ${subscription.subscriptionNumber}`,
            metadata: {
              subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
              subscriptionNumber: subscription.subscriptionNumber,
              renewalNumber: (subscription.renewalCount + 1).toString(),
              isRenewal: "true",
            },
          });

          // Update our payment record with gateway details from PaymentService
          payment.gatewayTransactionId = paymentServiceResult.result.gatewayTransactionId;
          payment.gatewaySessionId = paymentServiceResult.result.sessionId;
          payment.gatewayResponse = paymentServiceResult.result.gatewayResponse || {};
          payment.status = paymentServiceResult.result.status;
          payment.transactionId = paymentServiceResult.result.gatewayTransactionId;
          
          // Link payment to renewal order
          payment.orderId = renewalOrder._id as mongoose.Types.ObjectId;
          
          // Note: Payment will be PENDING until user confirms or webhook processes it
          // For automatic renewals, you need saved payment methods or Stripe Subscriptions
          if (paymentServiceResult.result.status === PaymentStatus.COMPLETED) {
            payment.processedAt = new Date();
            paymentProcessed = true;
          } else {
            logger.info(
              `Renewal payment created via gateway. Transaction ID: ${payment.gatewayTransactionId}. Status: ${payment.status}. ` +
              `Note: Payment requires user confirmation or webhook processing. For automatic renewals, use saved payment methods.`
            );
          }

          await payment.save({ session });
          
          paymentResult = paymentServiceResult.result;

          if (paymentResult.success) {
            logger.info(
              `Renewal payment processed via gateway. Transaction ID: ${payment.gatewayTransactionId}, Status: ${payment.status}`
            );
          } else {
            // Payment gateway failed
            payment.status = PaymentStatus.FAILED;
            payment.failureReason = paymentResult.error || "Payment gateway processing failed";
            await payment.save({ session });

            throw new AppError(
              `Payment gateway error: ${paymentResult.error || "Failed to process payment"}`,
              400
            );
          }
        } else {
          // No original payment found - cannot process renewal automatically
          logger.warn(
            `Cannot process renewal payment: No original payment found for subscription ${subscription.subscriptionNumber}`
          );
          payment.status = PaymentStatus.FAILED;
          payment.failureReason = "Original payment not found - cannot process renewal";
          await payment.save({ session });

          throw new AppError(
            "Cannot process renewal: Original payment not found",
            400
          );
        }
      } catch (paymentError: any) {
        // Payment processing failed
        logger.error(
          `Failed to process renewal payment via gateway: ${paymentError.message}`,
          {
            subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
            paymentId: payment._id,
            error: paymentError.message,
          }
        );

        // Update payment status
        payment.status = PaymentStatus.FAILED;
        payment.failureReason = paymentError.message || "Payment processing failed";
        await payment.save({ session });

        // Don't throw - we'll create renewal history with failed status
        paymentProcessed = false;
      }

      // Only proceed with subscription update if payment was successful
      if (!paymentProcessed && payment.status !== PaymentStatus.COMPLETED) {
        throw new AppError(
          `Renewal payment failed: ${payment.failureReason || "Payment not completed"}`,
          400
        );
      }

      // Get renewal order from payment if it was created during payment processing
      let renewalOrder: any = null;
      if (payment.orderId) {
        renewalOrder = await Orders.findById(payment.orderId).lean();
        if (renewalOrder) {
          logger.info(`Using existing renewal order: ${renewalOrder.orderNumber}`);
        }
      }

      // Create renewal order if it wasn't created during payment processing
      if (!renewalOrder) {
        try {
          const orderNumber = `REN-${subscription.subscriptionNumber}-${subscription.renewalCount + 1}`;
          renewalOrder = await Orders.create(
            [
              {
                orderNumber: orderNumber,
                userId: subscription.userId,
                planType: subscription.planType,
                items: subscription.items.map((item) => ({
                  productId: item.productId,
                  name: item.name,
                  variantType: ProductVariant.SACHETS, // Subscriptions are only for SACHETS items
                  planDays: item.planDays,
                  capsuleCount: item.capsuleCount,
                  amount: item.amount,
                  discountedPrice: item.discountedPrice,
                  taxRate: item.taxRate,
                  totalAmount: item.totalAmount,
                  durationDays: item.durationDays,
                  savingsPercentage: item.savingsPercentage,
                  features: item.features || [],
                })),
                subTotal: subscription.items.reduce((sum, item) => sum + item.amount, 0),
                discountedPrice: subscription.items.reduce(
                  (sum, item) => sum + item.discountedPrice,
                  0
                ),
                taxAmount: subscription.items.reduce(
                  (sum, item) => sum + (item.totalAmount - item.discountedPrice) * (item.taxRate / 100),
                  0
                ),
                grandTotal: totalAmount,
                currency: currency,
                shippingAddressId: originalOrder?.shippingAddressId,
                billingAddressId: originalOrder?.billingAddressId,
                paymentMethod: paymentMethod,
                paymentStatus: PaymentStatus.COMPLETED,
                paymentId: (payment._id as mongoose.Types.ObjectId).toString(),
                metadata: {
                  isRenewalOrder: true,
                  subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
                  renewalNumber: subscription.renewalCount + 1,
                  originalOrderId: (subscription.orderId as mongoose.Types.ObjectId).toString(),
                },
              },
            ],
            { session }
          ).then((docs) => docs[0] as any);

          // Link payment to renewal order if not already linked
          if (!payment.orderId) {
            payment.orderId = renewalOrder._id as mongoose.Types.ObjectId;
            await payment.save({ session });
          }

          if (renewalOrder) {
            logger.info(`Created renewal order: ${renewalOrder.orderNumber}`);
          }
        } catch (orderError: any) {
          logger.warn(
            `Failed to create renewal order for subscription ${subscription.subscriptionNumber}: ${orderError.message}`
          );
          // Continue without order - payment and renewal history are more important
        }
      }

      // Update subscription
      subscription.lastBilledDate = subscription.nextBillingDate;
      subscription.nextBillingDate = newBillingDate;
      subscription.nextDeliveryDate = newDeliveryDate;
      subscription.renewalCount = subscription.renewalCount + 1;
      subscription.lastDeliveredDate = subscription.nextDeliveryDate;
      await subscription.save({ session });

      // Create renewal history record
      const renewalHistory = await SubscriptionRenewalHistory.create(
        [
          {
            subscriptionId: subscription._id as mongoose.Types.ObjectId,
            userId: subscription.userId,
            renewalNumber: subscription.renewalCount,
            previousBillingDate: subscription.lastBilledDate || subscription.nextBillingDate,
            newBillingDate: newBillingDate,
            previousDeliveryDate: subscription.nextDeliveryDate as Date,
            newDeliveryDate: newDeliveryDate,
            paymentId: payment._id as mongoose.Types.ObjectId,
            orderId: renewalOrder?._id,
            amount: {
              amount: totalAmount,
              currency: currency,
              taxRate: subscription.items[0]?.taxRate || 0,
            },
            status: PaymentStatus.COMPLETED,
            renewalDate: now,
            metadata: {
              cycleDays: cycleDays,
            },
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      logger.info(
        `Successfully renewed subscription: ${subscription.subscriptionNumber} (Renewal #${subscription.renewalCount})`
      );

      return {
        success: true,
        subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
        renewalNumber: subscription.renewalCount,
        paymentId: (payment._id as mongoose.Types.ObjectId).toString(),
        orderId: renewalOrder?._id ? (renewalOrder._id as mongoose.Types.ObjectId).toString() : undefined,
      };
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();

      logger.error(
        `Failed to process renewal for subscription ${subscription.subscriptionNumber}: ${error.message}`,
        {
          subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
          error: error.message,
          stack: error.stack,
        }
      );

      // Create failed renewal history record
      try {
        await SubscriptionRenewalHistory.create({
          subscriptionId: subscription._id as mongoose.Types.ObjectId,
          userId: subscription.userId,
          renewalNumber: subscription.renewalCount + 1,
          previousBillingDate: subscription.nextBillingDate,
          newBillingDate: subscription.nextBillingDate, // No change on failure
          previousDeliveryDate: subscription.nextDeliveryDate,
          newDeliveryDate: subscription.nextDeliveryDate, // No change on failure
          paymentId: new mongoose.Types.ObjectId(), // Dummy ID for failed payment
          amount: {
            amount: subscription.items.reduce((sum, item) => sum + item.totalAmount, 0),
            currency: "EUR",
            taxRate: 0,
          },
          status: PaymentStatus.FAILED,
          renewalDate: new Date(),
          failureReason: error.message,
          retryCount: 1,
          nextRetryDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Retry in 24 hours
        });
      } catch (historyError: any) {
        logger.error(
          `Failed to create renewal history for failed renewal: ${historyError.message}`
        );
      }

      return {
        success: false,
        subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
        renewalNumber: subscription.renewalCount + 1,
        error: error.message,
      };
    }
  }

  /**
   * Check if subscription is eligible for auto-renewal
   */
  private isEligibleForRenewal(subscription: ISubscription): boolean {
    // Must be active
    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      return false;
    }

    // Must have auto-renewal enabled
    if (!subscription.isAutoRenew) {
      return false;
    }

    // Must not be cancelled
    if (subscription.cancelledAt) {
      return false;
    }

    // If paused, only allow renewal when pausedUntil is in the past
    if (subscription.status === (SubscriptionStatus.PAUSED as SubscriptionStatus)) {
      if (subscription.pausedUntil && subscription.pausedUntil > new Date()) {
        return false; // Still paused
      }
    }

    // Next billing date must be today or in the past
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nextBilling = new Date(subscription.nextBillingDate);
    nextBilling.setHours(0, 0, 0, 0);

    if (nextBilling > now) {
      return false; // Not yet due
    }

    return true;
  }

  /**
   * Process all subscriptions due for renewal
   * @param limit - Maximum number of subscriptions to process (default: 100)
   * @returns Results summary
   */
  async processDueRenewals(limit: number = 100): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: RenewalResult[];
  }> {
    logger.info("Starting batch auto-renewal processing");

    // Find all subscriptions due for renewal
    const now = new Date();
    const dueSubscriptions = await Subscriptions.find({
      status: SubscriptionStatus.ACTIVE,
      isAutoRenew: true,
      cancelledAt: { $exists: false },
      nextBillingDate: { $lte: now },
      isDeleted: false,
      // Handle paused subscriptions - only process if pausedUntil is in the past or doesn't exist
      $or: [
        { pausedAt: { $exists: false } },
        { pausedUntil: { $lte: now } },
        { pausedUntil: { $exists: false } },
      ],
    })
      .limit(limit)
      .lean();

    logger.info(`Found ${dueSubscriptions.length} subscriptions due for renewal`);

    const results: RenewalResult[] = [];
    let successful = 0;
    let failed = 0;

    // Process each subscription
    for (const sub of dueSubscriptions) {
      const subscription = await Subscriptions.findById(sub._id);
      if (!subscription) continue;

      const result = await this.processRenewal(subscription);
      results.push(result);

      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    logger.info(
      `Batch renewal processing completed: ${successful} successful, ${failed} failed out of ${dueSubscriptions.length} processed`
    );

    return {
      processed: dueSubscriptions.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Get renewal history for a subscription
   */
  async getRenewalHistory(
    subscriptionId: string,
    limit: number = 50
  ): Promise<any[]> {
    return await SubscriptionRenewalHistory.find({
      subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
      isDeleted: false,
    })
      .populate("paymentId", "status amount currency transactionId")
      .populate("orderId", "orderNumber status")
      .sort({ renewalDate: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get transaction history for a subscription (all payments related to subscription)
   */
  async getTransactionHistory(
    subscriptionId: string,
    limit: number = 50
  ): Promise<any[]> {
    return await Payments.find({
      subscriptionId: new mongoose.Types.ObjectId(subscriptionId),
      isDeleted: false,
    })
      .populate("orderId", "orderNumber status")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

export const subscriptionAutoRenewalService = new SubscriptionAutoRenewalService();

