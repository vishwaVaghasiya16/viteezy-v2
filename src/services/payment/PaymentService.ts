import {
  IPaymentGateway,
  PaymentIntentData,
  PaymentResult,
  RefundData,
  RefundResult,
  PaymentLineItem,
} from "./interfaces/IPaymentGateway";
import { StripeAdapter } from "./adapters/StripeAdapter";
import { MollieAdapter } from "./adapters/MollieAdapter";
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  MembershipStatus,
  OrderPlanType,
  ProductVariant,
  SubscriptionStatus,
  SubscriptionCycle,
} from "../../models/enums";
import { Payments } from "../../models/commerce/payments.model";
import { Orders } from "../../models/commerce/orders.model";
import { Subscriptions } from "../../models/commerce/subscriptions.model";
import { Memberships } from "../../models/commerce/memberships.model";
import { Coupons } from "../../models/commerce/coupons.model";
import { User } from "../../models/index.model";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import mongoose from "mongoose";
import { membershipService } from "../membershipService";
import { emailService } from "../emailService";
import { couponUsageHistoryService } from "../couponUsageHistoryService";
import { cartService } from "../cartService";
import { AddressSnapshotType } from "../../models/common.model";

/**
 * Unified Payment Service
 * Uses adapter pattern to support multiple payment gateways
 */
export class PaymentService {
  private gateways: Map<PaymentMethod, IPaymentGateway>;

  constructor() {
    this.gateways = new Map();

    // Initialize available gateways
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        this.gateways.set(PaymentMethod.STRIPE, new StripeAdapter());
        logger.info("Stripe payment gateway registered");
      }
    } catch (error) {
      logger.warn("Stripe gateway not available:", error);
    }

    try {
      if (process.env.MOLLIE_API_KEY) {
        this.gateways.set(PaymentMethod.MOLLIE, new MollieAdapter());
        logger.info("Mollie payment gateway registered");
      }
    } catch (error) {
      logger.warn("Mollie gateway not available:", error);
    }

    if (this.gateways.size === 0) {
      logger.warn("No payment gateways configured");
    }
  }

  /**
   * Get gateway for a specific payment method
   */
  private getGateway(paymentMethod: PaymentMethod): IPaymentGateway {
    const gateway = this.gateways.get(paymentMethod);
    if (!gateway) {
      throw new AppError(
        `Payment method ${paymentMethod} is not available or not configured`,
        400
      );
    }
    return gateway;
  }

  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods(countryCode?: string): PaymentMethod[] {
    const methods = Array.from(this.gateways.keys());
    if (!countryCode) {
      return methods;
    }

    if (!this.isNetherlands(countryCode)) {
      const stripeOnly = methods.filter(
        (method) => method === PaymentMethod.STRIPE
      );
      return stripeOnly.length > 0 ? stripeOnly : [];
    }

    return methods;
  }

  /**
   * Create payment intent and save to database (Order-based with full details)
   * This method is now aligned with createPaymentIntentForOrder for consistency
   */
  async createPayment(data: {
    orderId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    amount?: { value: number; currency: string }; // Optional, will use order amount if not provided
    description?: string;
    metadata?: Record<string, string>;
    returnUrl?: string;
    cancelUrl?: string;
    webhookUrl?: string;
  }): Promise<{
    payment: any;
    result: PaymentResult;
    order: any;
  }> {
    try {
      // Validate ObjectId formats
      if (!mongoose.Types.ObjectId.isValid(data.orderId)) {
        throw new AppError("Invalid order ID format", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(data.userId)) {
        throw new AppError("Invalid user ID format", 400);
      }

      // Get order details with populated addresses
      const order = await Orders.findById(data.orderId)
        .populate("shippingAddressId")
        .populate("billingAddressId");
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Verify order belongs to user
      if (order.userId.toString() !== data.userId) {
        throw new AppError("Order does not belong to user", 403);
      }

      const user = await User.findById(data.userId).select("name email");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Check if order is in a valid state for payment
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new AppError(
          `Order cannot be paid. Current status: ${order.status}`,
          400
        );
      }

      // Check if order already has a completed payment
      const existingPayment = await Payments.findOne({
        orderId: order._id,
        status: PaymentStatus.COMPLETED,
      });

      if (existingPayment) {
        throw new AppError("Order already has a completed payment", 400);
      }

      const orderCountry = this.getOrderCountry(order);
      this.ensurePaymentMethodAllowed(data.paymentMethod, orderCountry);

      // Get the appropriate gateway
      const gateway = this.getGateway(data.paymentMethod);

      // Get order ID
      const orderId = (order._id as mongoose.Types.ObjectId).toString();
      const lineItems = this.buildOrderCheckoutLineItems(order);
      const amountInMinorUnits = this.toMinorUnits(
        data.amount?.value || order.grandTotal
      );

      // Convert populated addresses to AddressSnapshotType format
      const shippingAddress = order.shippingAddressId
        ? this.convertAddressToSnapshot(order.shippingAddressId as any)
        : undefined;
      const billingAddress = order.billingAddressId
        ? this.convertAddressToSnapshot(order.billingAddressId as any)
        : shippingAddress;

      // Create payment intent data
      const paymentIntentData: PaymentIntentData = {
        amount: amountInMinorUnits,
        currency: data.amount?.currency || order.currency,
        orderId: orderId,
        userId: data.userId,
        description: data.description || `Order ${order.orderNumber}`,
        metadata: {
          orderNumber: order.orderNumber,
          orderId: orderId,
          ...(data.metadata || {}),
        },
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        webhookUrl:
          data.webhookUrl ||
          `${
            process.env.APP_BASE_URL || "http://localhost:8080"
          }/api/v1/payments/webhook/${data.paymentMethod}`,
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`.trim(),
        shippingCountry: orderCountry,
        shippingAddress,
        billingAddress,
        lineItems,
      };

      // Create payment intent via gateway
      const result = await gateway.createPaymentIntent(paymentIntentData);

      if (!result.success) {
        throw new AppError(
          result.error || "Failed to create payment intent",
          400
        );
      }

      // Save payment to database
      const payment = await Payments.create({
        orderId: order._id,
        userId: new mongoose.Types.ObjectId(data.userId),
        paymentMethod: data.paymentMethod,
        status: result.status,
        amount: {
          amount: data.amount?.value || order.grandTotal,
          currency: data.amount?.currency || order.currency,
          taxRate: order.subTotal > 0 ? order.taxAmount / order.subTotal : 0,
        },
        currency: data.amount?.currency || order.currency,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewaySessionId: result.sessionId,
        gatewayResponse: result.gatewayResponse,
      });

      // Get payment ID
      const paymentId = (payment._id as mongoose.Types.ObjectId).toString();

      // Update order payment status
      order.paymentStatus = result.status;
      order.paymentMethod = data.paymentMethod;
      order.paymentId = paymentId;
      if (result.sessionId) {
        order.metadata = {
          ...(order.metadata || {}),
          paymentSessionId: result.sessionId,
        };
      }
      await order.save();

      logger.info(
        `Payment created for order ${order.orderNumber}: ${paymentId} via ${data.paymentMethod}`
      );

      // ========== DEVELOPMENT/TEST MODE: Immediate Subscription Check ==========
      // In development, optionally create subscription immediately for testing
      // In production, subscription is created via webhook after payment completion
      if (process.env.AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT === "true") {
        console.log(
          "🟡 [DEV MODE] Attempting immediate subscription creation for testing..."
        );
        try {
          const freshOrder = await Orders.findById(order._id)
            .select(
              "orderNumber userId status planType isOneTime variantType selectedPlanDays items createdAt"
            )
            .lean();

          if (freshOrder) {
            const paymentData = payment.toObject ? payment.toObject() : payment;
            const subscription = await this.createSubscriptionFromOrder(
              freshOrder,
              paymentData
            );

            if (subscription) {
              console.log(
                "✅ [DEV MODE] Subscription created immediately:",
                subscription.subscriptionNumber
              );
              logger.info(
                `[DEV MODE] Subscription ${subscription.subscriptionNumber} created immediately for testing`
              );
            } else {
              console.log(
                "ℹ️ [DEV MODE] Order not eligible for subscription or already exists"
              );
            }
          }
        } catch (subError: any) {
          console.error(
            "⚠️ [DEV MODE] Immediate subscription creation failed:",
            subError.message
          );
          logger.warn(
            `[DEV MODE] Immediate subscription creation failed: ${subError.message}`
          );
          // Don't throw error - this is just for testing convenience
        }
      }

      return {
        payment,
        result,
        order,
      };
    } catch (error: any) {
      logger.error("Payment creation failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to create payment", 500);
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(
    paymentId: string,
    gatewayTransactionId: string
  ): Promise<any> {
    try {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        throw new AppError("Invalid payment ID format", 400);
      }

      const payment = await Payments.findById(paymentId);
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }

      const gateway = this.getGateway(payment.paymentMethod);
      const result = await gateway.verifyPayment(gatewayTransactionId);

      // Update payment status
      payment.status = result.status;
      payment.gatewayResponse =
        result.gatewayResponse || payment.gatewayResponse;
      if (result.error) {
        payment.failureReason = result.error;
      }
      await payment.save();

      return payment;
    } catch (error: any) {
      logger.error("Payment verification failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to verify payment", 500);
    }
  }

  /**
   * Process webhook from payment gateway
   */
  async processWebhook(
    paymentMethod: PaymentMethod,
    payload: any,
    signature?: string,
    rawBody?: Buffer | string
  ): Promise<any> {
    console.log(
      "🟢 [PAYMENT SERVICE] ========== Processing Webhook =========="
    );
    console.log("🟢 [PAYMENT SERVICE] Payment Method:", paymentMethod);
    console.log("🟢 [PAYMENT SERVICE] Event Type:", payload?.type);

    try {
      console.log("🟢 [PAYMENT SERVICE] Step 1: Getting gateway adapter");
      const gateway = this.getGateway(paymentMethod);

      console.log(
        "🟢 [PAYMENT SERVICE] Step 2: Processing webhook via gateway"
      );
      const result = await gateway.processWebhook(payload, signature, rawBody);

      console.log("🟢 [PAYMENT SERVICE] Step 3: Gateway processing complete");
      console.log("🟢 [PAYMENT SERVICE] - Success:", result.success);
      console.log("🟢 [PAYMENT SERVICE] - Status:", result.status);
      console.log(
        "🟢 [PAYMENT SERVICE] - Gateway Transaction ID:",
        result.gatewayTransactionId
      );
      console.log("🟢 [PAYMENT SERVICE] - Session ID:", result.sessionId);

      // For unhandled events or events that don't need payment updates,
      // we should acknowledge them but not throw errors
      if (!result.gatewayTransactionId && !result.sessionId) {
        // Check if this is an unhandled event that we're just acknowledging
        if (
          result.error &&
          (result.error.includes("Unhandled event type") ||
            result.error.includes("Test webhook") ||
            result.error.includes("Payment ID not found"))
        ) {
          console.log(
            "ℹ️ [PAYMENT SERVICE] - Test webhook or unhandled event acknowledged, no payment update needed"
          );
          // Return a dummy payment object to satisfy the return type
          // This prevents errors but doesn't update any payment
          return {
            _id: "unhandled_event",
            status: PaymentStatus.PENDING,
            orderId: null,
            userId: null,
            paymentMethod: paymentMethod,
          } as any;
        }

        console.error(
          "❌ [PAYMENT SERVICE] ERROR: No gateway transaction or session ID found"
        );
        throw new AppError(
          "Gateway transaction reference not found in webhook",
          400
        );
      }

      // Find payment by gateway transaction ID or session ID
      console.log(
        "🟢 [PAYMENT SERVICE] Step 4: Searching for payment in database"
      );
      let payment = result.gatewayTransactionId
        ? await Payments.findOne({
            gatewayTransactionId: result.gatewayTransactionId,
            paymentMethod: paymentMethod,
          })
        : null;

      if (!payment && result.sessionId) {
        console.log(
          "🟢 [PAYMENT SERVICE] - Payment not found by transaction ID, searching by session ID"
        );
        payment = await Payments.findOne({
          gatewaySessionId: result.sessionId,
          paymentMethod: paymentMethod,
        });
      }

      if (!payment) {
        console.error(
          "❌ [PAYMENT SERVICE] ERROR: Payment not found in database"
        );
        console.error(
          "❌ [PAYMENT SERVICE] - Transaction ID:",
          result.gatewayTransactionId
        );
        console.error("❌ [PAYMENT SERVICE] - Session ID:", result.sessionId);
        logger.warn(
          `Payment not found for gateway transaction: ${result.gatewayTransactionId}`
        );
        throw new AppError("Payment not found", 404);
      }

      console.log("✅ [PAYMENT SERVICE] Step 5: Payment found");
      console.log("✅ [PAYMENT SERVICE] - Payment ID:", payment._id);
      console.log("✅ [PAYMENT SERVICE] - Current Status:", payment.status);
      console.log("✅ [PAYMENT SERVICE] - New Status:", result.status);

      if (
        result.gatewayTransactionId &&
        payment.gatewayTransactionId !== result.gatewayTransactionId
      ) {
        payment.gatewayTransactionId = result.gatewayTransactionId;
      }
      if (result.sessionId && payment.gatewaySessionId !== result.sessionId) {
        payment.gatewaySessionId = result.sessionId;
      }

      // Check if status changed
      const statusChanged = payment.status !== result.status;
      const previousStatus = payment.status;

      console.log("🟢 [PAYMENT SERVICE] Step 6: Updating payment status");
      console.log("🟢 [PAYMENT SERVICE] - Status Changed:", statusChanged);
      console.log("🟢 [PAYMENT SERVICE] - Previous Status:", previousStatus);

      // Prevent downgrading from COMPLETED to PENDING
      // If payment is already COMPLETED, only allow updates to REFUNDED or keep it COMPLETED
      if (
        payment.status === PaymentStatus.COMPLETED &&
        result.status === PaymentStatus.PENDING
      ) {
        console.log(
          "⚠️ [PAYMENT SERVICE] - Payment already COMPLETED, ignoring PENDING status from webhook"
        );
        console.log(
          "ℹ️ [PAYMENT SERVICE] - Keeping payment status as COMPLETED"
        );
        // Don't update status, just acknowledge the webhook
        return payment;
      }

      // Update payment status
      payment.status = result.status;
      payment.gatewayResponse =
        result.gatewayResponse || payment.gatewayResponse;
      if (result.status === PaymentStatus.COMPLETED) {
        payment.processedAt = new Date();
        console.log("✅ [PAYMENT SERVICE] - Payment marked as COMPLETED");
      }
      if (result.error) {
        payment.failureReason = result.error;
        console.error("❌ [PAYMENT SERVICE] - Failure Reason:", result.error);
      }
      await payment.save();
      console.log("✅ [PAYMENT SERVICE] Step 7: Payment saved to database");

      // ========== WEBHOOK FLOW: Update Order & Create Subscription ==========
      // Update order status if payment is completed
      if (
        result.status === PaymentStatus.COMPLETED &&
        statusChanged &&
        previousStatus !== PaymentStatus.COMPLETED
      ) {
        console.log(
          "🟢 [PAYMENT SERVICE] Step 8: Payment completed, updating order"
        );
        const order = await Orders.findById(payment.orderId)
          .populate("shippingAddressId")
          .populate("billingAddressId");
        if (order) {
          console.log("✅ [PAYMENT SERVICE] - Order found:", order.orderNumber);

          // Update order status to COMPLETED and CONFIRMED
          order.paymentStatus = PaymentStatus.COMPLETED;
          order.status = OrderStatus.CONFIRMED;
          order.paymentId = (payment._id as mongoose.Types.ObjectId).toString();
          await order.save();

          console.log(
            "✅ [PAYMENT SERVICE] - Order status updated to CONFIRMED"
          );
          logger.info(
            `Order ${order.orderNumber} confirmed via webhook after payment completion`
          );

          // Clear user's cart after successful payment
          try {
            const userId = (order.userId as mongoose.Types.ObjectId).toString();
            console.log(
              "🛒 [PAYMENT SERVICE] Step 8.0.1: Clearing cart for user",
              userId
            );
            console.log(
              "🛒 [PAYMENT SERVICE] - Order ID:",
              order._id,
              "Order Number:",
              order.orderNumber
            );
            
            const clearResult = await cartService.clearCart(userId);
            console.log(
              "✅ [PAYMENT SERVICE] - Cart cleared successfully after payment:",
              clearResult.message
            );
            logger.info(
              `Cart cleared for user ${userId} after successful payment for order ${order.orderNumber}`,
              {
                userId,
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentId: payment._id,
                clearResult,
              }
            );
          } catch (cartError: any) {
            // Log error but don't fail the entire webhook processing
            console.error(
              "❌ [PAYMENT SERVICE] - Failed to clear cart:",
              cartError.message
            );
            console.error(
              "❌ [PAYMENT SERVICE] - Cart error stack:",
              cartError.stack
            );
            logger.error(
              `Failed to clear cart after payment: ${cartError.message}`,
              {
                userId: (order.userId as mongoose.Types.ObjectId).toString(),
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentId: payment._id,
                error: cartError.message,
                stack: cartError.stack,
              }
            );
          }

          // Track coupon usage if a coupon was applied
          if (order.couponCode && order.couponDiscountAmount > 0) {
            console.log("🟢 [PAYMENT SERVICE] Step 8.1: Tracking coupon usage");
            try {
              // Check if it's a referral code first
              const { User } = await import("@/models/core");
              const referrer = await User.findOne({
                referralCode: order.couponCode.toUpperCase(),
                isDeleted: false,
              });

              if (referrer) {
                // It's a referral code, update referral status
                console.log(
                  "🟢 [PAYMENT SERVICE] Step 8.1.1: Updating referral status"
                );
                const { referralService } = await import("@/services/referralService");
                await referralService.updateReferralStatusToPaid(
                  (order._id as mongoose.Types.ObjectId).toString(),
                  (payment._id as mongoose.Types.ObjectId).toString()
                );
                console.log(
                  "✅ [PAYMENT SERVICE] - Referral status updated to PAID"
                );
              } else {
                // It's a regular coupon, track coupon usage
                const coupon = await Coupons.findOne({
                  code: order.couponCode.toUpperCase(),
                });
                if (coupon) {
                  await couponUsageHistoryService.trackCouponUsage({
                    couponId: coupon._id as mongoose.Types.ObjectId,
                    userId: order.userId as mongoose.Types.ObjectId,
                    orderId: order._id as mongoose.Types.ObjectId,
                    discountAmount: {
                      amount: order.couponDiscountAmount,
                      currency: order.currency,
                      taxRate: 0,
                    },
                    couponCode: order.couponCode,
                    orderNumber: order.orderNumber,
                  });
                  console.log(
                    "✅ [PAYMENT SERVICE] - Coupon usage tracked successfully"
                  );
                } else {
                  console.warn(
                    `⚠️ [PAYMENT SERVICE] - Coupon not found: ${order.couponCode}`
                  );
                }
              }
            } catch (couponError: any) {
              // Log error but don't fail the entire webhook processing
              console.error(
                "❌ [PAYMENT SERVICE] - Failed to track coupon/referral usage:",
                couponError.message
              );
              logger.error("Failed to track coupon/referral usage:", couponError);
            }
          }

          console.log(
            "🟢 [PAYMENT SERVICE] Step 9: Sending order confirmation email"
          );
          await this.handleOrderConfirmation(order, payment);
          console.log("✅ [PAYMENT SERVICE] - Order confirmation email sent");

          // Check if this user (referrer) has any PAID referrals and mark them as COMPLETED
          // This happens when Customer 1's recurring payment is processed
          try {
            const { referralService } = await import("@/services/referralService");
            await referralService.updateReferralStatusToCompleted(
              (order.userId as mongoose.Types.ObjectId).toString(),
              (order._id as mongoose.Types.ObjectId).toString()
            );
          } catch (referralError: any) {
            // Log error but don't fail the entire webhook processing
            console.error(
              "❌ [PAYMENT SERVICE] - Failed to update referral status to COMPLETED:",
              referralError.message
            );
            logger.error("Failed to update referral status to COMPLETED:", referralError);
          }

          // ========== SUBSCRIPTION CREATION LOGIC ==========
          // Auto-create subscription if order is eligible
          // Conditions:
          // 1. Order must be a subscription order (isOneTime = false OR planType = SUBSCRIPTION)
          // 2. Order must be for SACHETS variant
          // 3. Order must have valid selectedPlanDays (30, 60, 90, or 180)
          // 4. No duplicate subscription should exist for this order
          console.log(
            "🟢 [PAYMENT SERVICE] Step 10: Checking for subscription auto-creation"
          );

          // Refresh order from database to ensure we have latest data with all fields
          const freshOrder = await Orders.findById(order._id)
            .select(
              "orderNumber userId status planType isOneTime variantType selectedPlanDays items createdAt"
            )
            .lean();

          if (freshOrder) {
            // Convert payment to plain object if it's a mongoose document
            const paymentData = payment.toObject ? payment.toObject() : payment;
            console.log(
              "🟢 [PAYMENT SERVICE] - Calling createSubscriptionFromOrder..."
            );

            // Call the reusable subscription creation function
            const subscription = await this.createSubscriptionFromOrder(
              freshOrder,
              paymentData
            );

            if (subscription) {
              console.log(
                "✅ [PAYMENT SERVICE] - Subscription created:",
                subscription.subscriptionNumber
              );
            } else {
              console.log(
                "ℹ️ [PAYMENT SERVICE] - Subscription not created (order not eligible or already exists)"
              );
            }
          } else {
            console.warn(
              "⚠️ [PAYMENT SERVICE] - Could not fetch fresh order for subscription creation"
            );
            logger.warn(
              `Could not fetch fresh order ${order._id} for subscription creation`
            );
          }
        } else {
          console.warn("⚠️ [PAYMENT SERVICE] - Order not found for payment");
        }
      } else {
        console.log(
          "ℹ️ [PAYMENT SERVICE] - Order update skipped (payment not completed or status unchanged)"
        );
      }

      // Update membership status if applicable
      if (
        payment.membershipId &&
        statusChanged &&
        previousStatus !== PaymentStatus.COMPLETED
      ) {
        console.log("🟢 [PAYMENT SERVICE] Step 10: Updating membership status");
        if (result.status === PaymentStatus.COMPLETED) {
          console.log("✅ [PAYMENT SERVICE] - Activating membership");
          await membershipService.activateMembership(
            payment.membershipId.toString(),
            payment._id as mongoose.Types.ObjectId
          );
          console.log("✅ [PAYMENT SERVICE] - Membership activated");
          logger.info(
            `Membership ${payment.membershipId} activated after payment completion`
          );
        } else if (
          result.status === PaymentStatus.FAILED ||
          result.status === PaymentStatus.CANCELLED
        ) {
          console.log("❌ [PAYMENT SERVICE] - Cancelling membership");
          await Memberships.findByIdAndUpdate(payment.membershipId, {
            status: MembershipStatus.CANCELLED,
            cancelledAt: new Date(),
          });
          console.log("✅ [PAYMENT SERVICE] - Membership cancelled");
        }
      }

      console.log(
        "✅ [PAYMENT SERVICE] ========== Webhook Processing Complete =========="
      );
      console.log("✅ [PAYMENT SERVICE] Final Payment Status:", payment.status);
      logger.info(
        `Payment ${payment._id} updated via webhook: ${result.status}`
      );

      return payment;
    } catch (error: any) {
      console.error("❌ [PAYMENT SERVICE] ========== ERROR ==========");
      console.error("❌ [PAYMENT SERVICE] Error:", error.message);
      console.error("❌ [PAYMENT SERVICE] Stack:", error.stack);
      console.error("❌ [PAYMENT SERVICE] ===========================");
      logger.error("Webhook processing failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to process webhook", 500);
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(data: {
    paymentId: string;
    amount?: number;
    reason?: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    try {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(data.paymentId)) {
        throw new AppError("Invalid payment ID format", 400);
      }

      const payment = await Payments.findById(data.paymentId);
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new AppError("Only completed payments can be refunded", 400);
      }

      const gateway = this.getGateway(payment.paymentMethod);

      const refundData: RefundData = {
        paymentId: payment.gatewayTransactionId || "",
        amount: data.amount ? Math.round(data.amount * 100) : undefined, // Convert to cents
        reason: data.reason,
        metadata: data.metadata,
      };

      const result = await gateway.refundPayment(refundData);

      if (!result.success) {
        throw new AppError(result.error || "Failed to process refund", 400);
      }

      // Update payment with refund information
      payment.status = PaymentStatus.REFUNDED;
      payment.refundAmount = {
        amount: result.amount / 100, // Convert back from cents
        currency: payment.amount.currency,
        taxRate: payment.amount.taxRate || 0,
      };
      payment.refundReason = data.reason;
      payment.refundedAt = new Date();
      payment.gatewayResponse = {
        ...payment.gatewayResponse,
        refund: result.gatewayResponse,
      };
      await payment.save();

      logger.info(`Payment ${payment._id} refunded: ${result.amount / 100}`);

      return payment;
    } catch (error: any) {
      logger.error("Refund failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to process refund", 500);
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string): Promise<any> {
    try {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(paymentId)) {
        throw new AppError("Invalid payment ID format", 400);
      }

      const payment = await Payments.findById(paymentId);
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }

      if (
        payment.status === PaymentStatus.COMPLETED ||
        payment.status === PaymentStatus.REFUNDED
      ) {
        throw new AppError("Cannot cancel completed or refunded payment", 400);
      }

      const gateway = this.getGateway(payment.paymentMethod);
      const result = await gateway.cancelPayment(
        payment.gatewayTransactionId || ""
      );

      if (!result.success) {
        throw new AppError(result.error || "Failed to cancel payment", 400);
      }

      // Update payment status
      payment.status = PaymentStatus.CANCELLED;
      payment.gatewayResponse =
        result.gatewayResponse || payment.gatewayResponse;
      await payment.save();

      logger.info(`Payment ${payment._id} cancelled`);

      return payment;
    } catch (error: any) {
      logger.error("Payment cancellation failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to cancel payment", 500);
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<any> {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      throw new AppError("Invalid payment ID format", 400);
    }

    const payment = await Payments.findById(paymentId)
      .populate("orderId")
      .populate("userId", "name email");
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }
    return payment;
  }

  /**
   * Get payment by gateway transaction ID
   */
  async getPaymentByGatewayTransactionId(
    gatewayTransactionId: string,
    paymentMethod: PaymentMethod
  ): Promise<any> {
    if (!gatewayTransactionId) {
      throw new AppError("Gateway transaction ID is required", 400);
    }

    const payment = await Payments.findOne({
      gatewayTransactionId,
      paymentMethod,
    })
      .populate("orderId")
      .populate("membershipId")
      .populate("userId", "name email");

    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return payment;
  }

  /**
   * Get payments by order ID
   */
  async getPaymentsByOrder(orderId: string): Promise<any[]> {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw new AppError("Invalid order ID format", 400);
    }

    // Check if order exists
    const order = await Orders.findById(orderId);
    if (!order) {
      throw new AppError("Order not found", 404);
    }

    const payments = await Payments.find({
      orderId: new mongoose.Types.ObjectId(orderId),
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    return payments;
  }

  /**
   * Get payments by user ID
   */
  async getPaymentsByUser(userId: string): Promise<any[]> {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new AppError("Invalid user ID format", 400);
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const payments = await Payments.find({
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate("orderId")
      .sort({ createdAt: -1 });

    return payments;
  }

  /**
   * Create payment intent for product checkout (order-based)
   */
  async createPaymentIntentForOrder(data: {
    orderId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    returnUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    payment: any;
    result: PaymentResult;
    order: any;
  }> {
    try {
      // Validate ObjectId formats
      if (!mongoose.Types.ObjectId.isValid(data.orderId)) {
        throw new AppError("Invalid order ID format", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(data.userId)) {
        throw new AppError("Invalid user ID format", 400);
      }

      // Get order details with populated addresses
      const order = await Orders.findById(data.orderId)
        .populate("shippingAddressId")
        .populate("billingAddressId");
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Verify order belongs to user
      if (order.userId.toString() !== data.userId) {
        throw new AppError("Order does not belong to user", 403);
      }

      const user = await User.findById(data.userId).select("name email");
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Check if order is in a valid state for payment
      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.CONFIRMED
      ) {
        throw new AppError(
          `Order cannot be paid. Current status: ${order.status}`,
          400
        );
      }

      // Check if order already has a completed payment
      const existingPayment = await Payments.findOne({
        orderId: order._id,
        status: PaymentStatus.COMPLETED,
      });

      if (existingPayment) {
        throw new AppError("Order already has a completed payment", 400);
      }

      const orderCountry = this.getOrderCountry(order);
      this.ensurePaymentMethodAllowed(data.paymentMethod, orderCountry);

      // Get the appropriate gateway
      const gateway = this.getGateway(data.paymentMethod);

      // Get order ID
      const orderId = (order._id as mongoose.Types.ObjectId).toString();
      const lineItems = this.buildOrderCheckoutLineItems(order);
      const amountInMinorUnits = this.toMinorUnits(order.grandTotal);

      // Convert populated addresses to AddressSnapshotType format
      const shippingAddress = order.shippingAddressId
        ? this.convertAddressToSnapshot(order.shippingAddressId as any)
        : undefined;
      const billingAddress = order.billingAddressId
        ? this.convertAddressToSnapshot(order.billingAddressId as any)
        : shippingAddress;

      // Create payment intent data
      const paymentIntentData: PaymentIntentData = {
        amount: amountInMinorUnits,
        currency: order.currency,
        orderId: orderId,
        userId: data.userId,
        description: `Order ${order.orderNumber}`,
        metadata: {
          orderNumber: order.orderNumber,
          orderId: orderId,
        },
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        webhookUrl: `${
          process.env.APP_BASE_URL || "http://localhost:8080"
        }/api/v1/payments/webhook/${data.paymentMethod}`,
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`.trim(),
        shippingCountry: orderCountry,
        shippingAddress,
        billingAddress,
        lineItems,
      };

      // Create payment intent via gateway
      const result = await gateway.createPaymentIntent(paymentIntentData);

      if (!result.success) {
        throw new AppError(
          result.error || "Failed to create payment intent",
          400
        );
      }

      // Save payment to database
      const payment = await Payments.create({
        orderId: order._id,
        userId: new mongoose.Types.ObjectId(data.userId),
        paymentMethod: data.paymentMethod,
        status: result.status,
        amount: {
          amount: order.grandTotal,
          currency: order.currency,
          taxRate: order.subTotal > 0 ? order.taxAmount / order.subTotal : 0,
        },
        currency: order.currency,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewaySessionId: result.sessionId,
        gatewayResponse: result.gatewayResponse,
      });

      // Get payment ID
      const paymentId = (payment._id as mongoose.Types.ObjectId).toString();

      // Update order payment status
      order.paymentStatus = result.status;
      order.paymentMethod = data.paymentMethod;
      order.paymentId = paymentId;
      if (result.sessionId) {
        order.metadata = {
          ...(order.metadata || {}),
          paymentSessionId: result.sessionId,
        };
      }
      await order.save();

      logger.info(
        `Payment intent created for order ${order.orderNumber}: ${paymentId} via ${data.paymentMethod}`
      );

      // ========== DEVELOPMENT/TEST MODE: Immediate Subscription Check ==========
      // In development, optionally create subscription immediately for testing
      // In production, subscription is created via webhook after payment completion
      if (
        process.env.NODE_ENV === "development" &&
        process.env.AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT === "true"
      ) {
        console.log(
          "🟡 [DEV MODE] Attempting immediate subscription creation for testing..."
        );
        try {
          const freshOrder = await Orders.findById(order._id)
            .select(
              "orderNumber userId status planType isOneTime variantType selectedPlanDays items createdAt"
            )
            .lean();

          if (freshOrder) {
            const paymentData = payment.toObject ? payment.toObject() : payment;
            const subscription = await this.createSubscriptionFromOrder(
              freshOrder,
              paymentData
            );

            if (subscription) {
              console.log(
                "✅ [DEV MODE] Subscription created immediately:",
                subscription.subscriptionNumber
              );
              logger.info(
                `[DEV MODE] Subscription ${subscription.subscriptionNumber} created immediately for testing`
              );
            } else {
              console.log(
                "ℹ️ [DEV MODE] Order not eligible for subscription or already exists"
              );
            }
          }
        } catch (subError: any) {
          console.error(
            "⚠️ [DEV MODE] Immediate subscription creation failed:",
            subError.message
          );
          logger.warn(
            `[DEV MODE] Immediate subscription creation failed: ${subError.message}`
          );
          // Don't throw error - this is just for testing convenience
        }
      }

      return {
        payment,
        result,
        order,
      };
    } catch (error: any) {
      logger.error("Payment intent creation for order failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to create payment intent", 500);
    }
  }

  /**
   * Verify payment and update order status (for frontend callback)
   */
  async verifyPaymentAndUpdateOrder(data: {
    paymentId: string;
    gatewayTransactionId?: string;
  }): Promise<{
    payment: any;
    order: any;
    updated: boolean;
  }> {
    try {
      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(data.paymentId)) {
        throw new AppError("Invalid payment ID format", 400);
      }

      // Get payment with populated order and addresses
      const payment = await Payments.findById(data.paymentId).populate({
        path: "orderId",
        populate: [{ path: "shippingAddressId" }, { path: "billingAddressId" }],
      });
      if (!payment) {
        throw new AppError("Payment not found", 404);
      }

      const order = payment.orderId as any;
      if (!order) {
        throw new AppError("Order not found for this payment", 404);
      }

      // Get gateway
      const gateway = this.getGateway(payment.paymentMethod);

      // Verify payment with gateway
      const gatewayTransactionId =
        data.gatewayTransactionId || payment.gatewayTransactionId || "";
      const result = await gateway.verifyPayment(gatewayTransactionId);

      // Check if status changed
      const statusChanged = payment.status !== result.status;
      const wasCompleted = payment.status === PaymentStatus.COMPLETED;

      // Update payment status
      payment.status = result.status;
      payment.gatewayResponse =
        result.gatewayResponse || payment.gatewayResponse;
      if (result.error) {
        payment.failureReason = result.error;
      }
      if (result.status === PaymentStatus.COMPLETED) {
        payment.processedAt = new Date();
      }
      await payment.save();

      // Update order status based on payment status
      let orderUpdated = false;

      // Update order if payment status changed OR if payment is completed but order paymentStatus is not
      const shouldUpdateOrder =
        statusChanged ||
        (result.status === PaymentStatus.COMPLETED &&
          order.paymentStatus !== PaymentStatus.COMPLETED);

      if (shouldUpdateOrder) {
        const previousOrderPaymentStatus = order.paymentStatus;
        order.paymentStatus = result.status;
        order.paymentId = (payment._id as mongoose.Types.ObjectId).toString();

        // Update order status based on payment status
        if (result.status === PaymentStatus.COMPLETED) {
          if (order.status !== OrderStatus.CONFIRMED) {
            order.status = OrderStatus.CONFIRMED;
            orderUpdated = true;
            logger.info(
              `Order ${order.orderNumber} confirmed after payment completion`
            );
            await this.handleOrderConfirmation(order, payment);

            // ========== SUBSCRIPTION CREATION LOGIC ==========
            // Auto-create subscription if order is eligible
            // Refresh order from database to ensure we have latest data with all fields
            const freshOrder = await Orders.findById(order._id)
              .select(
                "orderNumber userId status planType isOneTime variantType selectedPlanDays items createdAt"
              )
              .lean();
            if (freshOrder) {
              // Convert payment to plain object if it's a mongoose document
              const paymentData = payment.toObject
                ? payment.toObject()
                : payment;
              console.log(
                "🟢 [PAYMENT SERVICE] - Calling createSubscriptionFromOrder..."
              );

              // Call the reusable subscription creation function
              const subscription = await this.createSubscriptionFromOrder(
                freshOrder,
                paymentData
              );

              if (subscription) {
                console.log(
                  "✅ [PAYMENT SERVICE] - Subscription created:",
                  subscription.subscriptionNumber
                );
              }
            } else {
              logger.warn(
                `Could not fetch fresh order ${order._id} for subscription creation`
              );
            }
          } else if (previousOrderPaymentStatus !== PaymentStatus.COMPLETED) {
            // Order status already confirmed, but paymentStatus was not updated
            orderUpdated = true;
            logger.info(
              `Order ${order.orderNumber} paymentStatus updated to COMPLETED`
            );

            // ========== SUBSCRIPTION CREATION LOGIC ==========
            // Auto-create subscription if order is eligible (even if order was already confirmed)
            const freshOrder = await Orders.findById(order._id)
              .select(
                "orderNumber userId status planType isOneTime variantType selectedPlanDays items createdAt"
              )
              .lean();
            if (freshOrder) {
              // Convert payment to plain object if it's a mongoose document
              const paymentData = payment.toObject
                ? payment.toObject()
                : payment;
              console.log(
                "🟢 [PAYMENT SERVICE] - Calling createSubscriptionFromOrder (already confirmed)..."
              );

              // Call the reusable subscription creation function
              const subscription = await this.createSubscriptionFromOrder(
                freshOrder,
                paymentData
              );

              if (subscription) {
                console.log(
                  "✅ [PAYMENT SERVICE] - Subscription created:",
                  subscription.subscriptionNumber
                );
              }
            } else {
              logger.warn(
                `Could not fetch fresh order ${order._id} for subscription creation`
              );
            }
          }
        } else if (result.status === PaymentStatus.FAILED) {
          // Keep order as pending if payment failed
          orderUpdated = true;
          logger.info(`Order ${order.orderNumber} payment failed`);
        } else if (result.status === PaymentStatus.CANCELLED) {
          // Keep order as pending if payment cancelled
          orderUpdated = true;
          logger.info(`Order ${order.orderNumber} payment cancelled`);
        }

        if (
          orderUpdated ||
          previousOrderPaymentStatus !== order.paymentStatus
        ) {
          await order.save();
          console.log(
            `✅ [PAYMENT SERVICE] - Order ${order.orderNumber} paymentStatus updated to ${order.paymentStatus}`
          );
        }
      }

      return {
        payment,
        order,
        updated: orderUpdated && statusChanged,
      };
    } catch (error: any) {
      logger.error("Payment verification and order update failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(
            error.message || "Failed to verify payment and update order",
            500
          );
    }
  }

  /**
   * Create payment intent for membership purchase
   */
  async createMembershipPaymentIntent(data: {
    membershipId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    amount: { value: number; currency: string };
    description?: string;
    metadata?: Record<string, string>;
    returnUrl?: string;
    cancelUrl?: string;
    webhookUrl?: string;
    customerEmail?: string;
  }): Promise<{
    payment: any;
    result: PaymentResult;
  }> {
    try {
      if (!mongoose.Types.ObjectId.isValid(data.membershipId)) {
        throw new AppError("Invalid membership ID format", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(data.userId)) {
        throw new AppError("Invalid user ID format", 400);
      }

      const membership = await Memberships.findById(data.membershipId);
      if (!membership) {
        throw new AppError("Membership not found", 404);
      }

      if (membership.status !== MembershipStatus.PENDING) {
        throw new AppError(
          "Membership payment can only be initiated for pending memberships",
          400
        );
      }

      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      const gateway = this.getGateway(data.paymentMethod);

      // Generate webhook URL if not provided
      // For local development, use a placeholder that Mollie can validate
      // In production, this should be a publicly accessible URL
      const webhookUrl =
        data.webhookUrl ||
        (process.env.NODE_ENV === "production"
          ? `${
              process.env.APP_BASE_URL || "https://20973d5116e5.ngrok-free.app"
            }/api/v1/payments/webhook/${data.paymentMethod}`
          : undefined); // Skip webhook in development for localhost

      const paymentIntentData: PaymentIntentData = {
        amount: Math.round(data.amount.value * 100),
        currency: data.amount.currency,
        orderId: data.membershipId,
        userId: data.userId,
        description: data.description,
        metadata: {
          ...data.metadata,
          membershipId: data.membershipId,
        },
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        webhookUrl,
        customerEmail: data.customerEmail || user.email,
      };

      const result = await gateway.createPaymentIntent(paymentIntentData);

      if (!result.success) {
        throw new AppError(
          result.error || "Failed to create membership payment intent",
          400
        );
      }

      const payment = await Payments.create({
        membershipId: new mongoose.Types.ObjectId(data.membershipId),
        userId: new mongoose.Types.ObjectId(data.userId),
        paymentMethod: data.paymentMethod,
        status: result.status,
        amount: {
          amount: data.amount.value,
          currency: data.amount.currency,
          taxRate: 0,
        },
        currency: data.amount.currency,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewaySessionId: result.sessionId,
        gatewayResponse: result.gatewayResponse,
      });

      membership.paymentMethod = data.paymentMethod;
      membership.paymentId = payment._id as mongoose.Types.ObjectId;
      await membership.save();

      logger.info(
        `Membership payment created: ${payment._id} via ${data.paymentMethod}`
      );

      return {
        payment,
        result,
      };
    } catch (error: any) {
      logger.error("Membership payment creation failed:", error);
      throw error instanceof AppError
        ? error
        : new AppError(
            error.message || "Failed to create membership payment",
            500
          );
    }
  }

  private isNetherlands(countryCode?: string): boolean {
    return (countryCode || "").toUpperCase() === "NL";
  }

  private getOrderCountry(order: any): string | undefined {
    // Get country from populated address or metadata
    const shippingAddr = order?.shippingAddressId as any;
    const billingAddr = order?.billingAddressId as any;
    const country =
      shippingAddr?.country ||
      billingAddr?.country ||
      order?.metadata?.shippingCountry;
    return country ? country.toUpperCase() : undefined;
  }

  /**
   * Convert populated address document to AddressSnapshotType format
   */
  private convertAddressToSnapshot(address: any): AddressSnapshotType {
    if (!address) {
      return {};
    }

    // Build line1 from streetName, houseNumber, and houseNumberAddition
    const line1Parts = [
      address.streetName,
      address.houseNumber,
      address.houseNumberAddition,
    ].filter(Boolean);

    return {
      name:
        `${address.firstName || ""} ${address.lastName || ""}`.trim() ||
        undefined,
      phone: address.phone || undefined,
      line1: line1Parts.join(" ") || address.address || undefined,
      line2: undefined, // No longer used
      city: address.city || undefined,
      state: undefined, // No longer used
      zip: address.postalCode || undefined,
      country: address.country || undefined,
    };
  }

  private ensurePaymentMethodAllowed(
    paymentMethod: PaymentMethod,
    countryCode?: string
  ): void {
    console.log(
      "🟢 [PAYMENT SERVICE] ========== Ensure Payment Method Allowed =========="
    );
    console.log("🟢 [PAYMENT SERVICE] Payment Method:", paymentMethod);
    console.log("🟢 [PAYMENT SERVICE] Country Code:", countryCode);

    if (
      paymentMethod === PaymentMethod.MOLLIE &&
      countryCode &&
      !this.isNetherlands(countryCode)
    ) {
      throw new AppError(
        "Mollie payments are only available for customers in the Netherlands",
        400
      );
    }
  }

  private buildOrderCheckoutLineItems(order: any): PaymentLineItem[] {
    const currency = order?.currency || "EUR";
    return [
      {
        name: `Order ${order?.orderNumber || ""}`.trim(),
        amount: this.toMinorUnits(order?.grandTotal || 0),
        currency,
        quantity: 1,
        description: `${order?.items?.length || 0} item(s)`,
      },
    ];
  }

  private toMinorUnits(amount: number): number {
    return Math.round(amount * 100);
  }

  private async handleOrderConfirmation(
    order: any,
    payment: any
  ): Promise<void> {
    console.log("📧 [EMAIL] ========== Order Confirmation Email ==========");
    console.log("📧 [EMAIL] Order Number:", order?.orderNumber);
    console.log("📧 [EMAIL] Order ID:", order?._id);

    try {
      if (!order?.userId) {
        console.warn("⚠️ [EMAIL] - No userId found in order, skipping email");
        return;
      }

      const metadata = order.metadata || {};
      if (metadata.orderConfirmationEmailSentAt) {
        console.log("ℹ️ [EMAIL] - Confirmation email already sent, skipping");
        return;
      }

      console.log("📧 [EMAIL] Step 1: Fetching user details");
      const user = await User.findById(order.userId).select(
        "firstName lastName email"
      );
      if (!user?.email) {
        console.warn("⚠️ [EMAIL] - User email not found, skipping email");
        return;
      }

      console.log("✅ [EMAIL] - User found:", user.email);

      console.log("📧 [EMAIL] Step 2: Preparing email data");
      const items = Array.isArray(order.items)
        ? order.items.map((item: any) => ({
            name: item.name || "Item",
            quantity: 1, // Quantity removed from order items
            unitAmount: item.amount || item.totalAmount || 0,
            currency: order.currency || "EUR",
          }))
        : [];

      console.log("📧 [EMAIL] - Items count:", items.length);
      console.log("📧 [EMAIL] - Total amount:", order.grandTotal);

      console.log("📧 [EMAIL] Step 3: Sending order confirmation email");

      // Convert populated address to snapshot format for email
      const shippingAddressSnapshot = order.shippingAddressId
        ? this.convertAddressToSnapshot(order.shippingAddressId as any)
        : undefined;

      const fullName = `${user.firstName} ${user.lastName}`.trim();
      const emailSent = await emailService.sendOrderConfirmationEmail({
        to: user.email,
        userName: fullName,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        paymentMethod: payment?.paymentMethod,
        subtotal: {
          amount: order.subTotal,
          currency: order.currency,
        },
        tax: {
          amount: order.taxAmount,
          currency: order.currency,
        },
        shipping: {
          amount: 0, // Shipping not stored separately in new model
          currency: order.currency,
        },
        discount: {
          amount: order.subTotal - order.discountedPrice,
          currency: order.currency,
        },
        total: {
          amount: order.grandTotal,
          currency: order.currency,
        },
        items,
        shippingAddress: shippingAddressSnapshot,
      });

      if (emailSent) {
        console.log("✅ [EMAIL] - Email sent successfully");
        order.metadata = {
          ...metadata,
          orderConfirmationEmailSentAt: new Date(),
        };
        await order.save();
        console.log("✅ [EMAIL] - Order metadata updated");
      } else {
        console.error("❌ [EMAIL] - Email sending failed");
      }

      console.log("✅ [EMAIL] ============================================");
    } catch (error) {
      console.error("❌ [EMAIL] ========== ERROR ==========");
      console.error(
        "❌ [EMAIL] Error:",
        error instanceof Error ? error.message : "Unknown error"
      );
      console.error("❌ [EMAIL] ===========================");
      logger.error("Order confirmation email dispatch failed:", error);
    }
  }

  /**
   * Create subscription from order (Reusable function)
   * This is the main subscription creation logic that can be called from multiple places
   *
   * @param order - Order document or plain object
   * @param payment - Payment document or plain object
   * @returns Created subscription or null if not eligible
   */
  async createSubscriptionFromOrder(
    order: any,
    payment: any
  ): Promise<any | null> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      console.log(
        "🟢 [SUBSCRIPTION] ========== Create Subscription From Order =========="
      );
      console.log("🟢 [SUBSCRIPTION] Order Number:", order?.orderNumber);
      console.log("🟢 [SUBSCRIPTION] Order ID:", order?._id);
      console.log("🟢 [SUBSCRIPTION] Payment ID:", payment?._id);

      // ========== STEP 1: Validate Order Eligibility ==========
      console.log("🟢 [SUBSCRIPTION] Step 1: Validating order eligibility...");

      // Check if order is eligible for subscription creation
      // Only create subscription if:
      // 1. isOneTime is false (subscription order) OR planType is SUBSCRIPTION
      // 2. variantType is SACHETS
      // 3. selectedPlanDays is valid (30, 60, 90, or 180)

      console.log("🟢 [SUBSCRIPTION] - isOneTime:", order?.isOneTime);
      console.log("🟢 [SUBSCRIPTION] - planType:", order?.planType);
      console.log("🟢 [SUBSCRIPTION] - variantType:", order?.variantType);
      console.log(
        "🟢 [SUBSCRIPTION] - selectedPlanDays:",
        order?.selectedPlanDays
      );

      // Check isOneTime - must be explicitly false OR planType must be SUBSCRIPTION
      const isSubscriptionOrder =
        order.isOneTime === false ||
        order.planType === OrderPlanType.SUBSCRIPTION;

      if (!isSubscriptionOrder) {
        console.log(
          `⚠️ [SUBSCRIPTION] - Order is one-time purchase. isOneTime: ${order.isOneTime}, planType: ${order.planType}`
        );
        logger.info(
          `Order ${order.orderNumber} is one-time purchase, skipping subscription creation`
        );
        await session.abortTransaction();
        return null;
      }

      // Check variantType - must be SACHETS
      if (!order.variantType || order.variantType !== ProductVariant.SACHETS) {
        console.log(
          `⚠️ [SUBSCRIPTION] - variantType is ${order.variantType}, subscription only available for SACHETS`
        );
        logger.info(
          `Order ${order.orderNumber} variantType is ${order.variantType}, subscription only available for SACHETS`
        );
        await session.abortTransaction();
        return null;
      }

      console.log("✅ [SUBSCRIPTION] - Order is eligible for subscription");

      // ========== STEP 2: Check for Duplicate Subscription ==========
      console.log(
        "🟢 [SUBSCRIPTION] Step 2: Checking for duplicate subscription..."
      );

      const existingSubscription = await Subscriptions.findOne({
        orderId: order._id,
        isDeleted: false,
      })
        .session(session)
        .lean();

      if (existingSubscription) {
        console.log(
          "⚠️ [SUBSCRIPTION] - Subscription already exists, skipping creation"
        );
        console.log(
          "⚠️ [SUBSCRIPTION] - Existing Subscription ID:",
          existingSubscription._id
        );
        logger.info(
          `Subscription already exists for order ${order.orderNumber}, skipping creation`
        );
        await session.abortTransaction();
        return null;
      }

      console.log("✅ [SUBSCRIPTION] - No duplicate found, proceeding...");

      // ========== STEP 3: Validate Plan Duration ==========
      console.log("🟢 [SUBSCRIPTION] Step 3: Validating plan duration...");

      const cycleDays = order.selectedPlanDays;
      console.log("🟢 [SUBSCRIPTION] - cycleDays from order:", cycleDays);

      if (!cycleDays || ![30, 60, 90, 180].includes(cycleDays)) {
        console.log(
          `⚠️ [SUBSCRIPTION] - Invalid cycleDays: ${cycleDays}, must be 30, 60, 90, or 180`
        );
        logger.warn(
          `Order ${order.orderNumber} has invalid cycleDays: ${cycleDays}, skipping subscription creation`
        );
        await session.abortTransaction();
        return null;
      }

      console.log("✅ [SUBSCRIPTION] - Valid cycleDays:", cycleDays);

      // ========== STEP 4: Calculate Subscription Dates ==========
      console.log(
        "🟢 [SUBSCRIPTION] Step 4: Calculating subscription dates..."
      );

      const now = new Date();

      // subscriptionStartDate = current date (payment completion date)
      const subscriptionStartDate = now;

      // subscriptionEndDate = subscriptionStartDate + cycleDays
      // Calculate end date based on the cycle days
      const subscriptionEndDate = new Date(now);
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + cycleDays);

      // lastBilledDate = subscriptionStartDate (payment just completed)
      const lastBilledDate = now;

      // initialDeliveryDate = subscriptionStartDate + 1 day (next day delivery)
      const initialDeliveryDate = new Date(now);
      initialDeliveryDate.setDate(initialDeliveryDate.getDate() + 1);

      // nextDeliveryDate = subscriptionStartDate + cycleDays
      const nextDeliveryDate = new Date(now);
      nextDeliveryDate.setDate(nextDeliveryDate.getDate() + cycleDays);

      // nextBillingDate = subscriptionStartDate + cycleDays
      const nextBillingDate = new Date(now);
      nextBillingDate.setDate(nextBillingDate.getDate() + cycleDays);

      console.log("✅ [SUBSCRIPTION] - Dates calculated:");
      console.log(
        "   - subscriptionStartDate:",
        subscriptionStartDate.toISOString()
      );
      console.log(
        "   - subscriptionEndDate:",
        subscriptionEndDate.toISOString()
      );
      console.log("   - lastBilledDate:", lastBilledDate.toISOString());
      console.log(
        "   - initialDeliveryDate:",
        initialDeliveryDate.toISOString()
      );
      console.log("   - nextDeliveryDate:", nextDeliveryDate.toISOString());
      console.log("   - nextBillingDate:", nextBillingDate.toISOString());

      // ========== STEP 5: Map Order Items to Subscription Items ==========
      console.log("🟢 [SUBSCRIPTION] Step 5: Mapping order items...");

      const subscriptionItems = order.items.map((item: any) => ({
        productId: new mongoose.Types.ObjectId(item.productId),
        name: item.name,
        planDays: item.planDays,
        capsuleCount: item.capsuleCount,
        amount: item.amount,
        discountedPrice: item.discountedPrice,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
        durationDays: item.durationDays,
        savingsPercentage: item.savingsPercentage,
        features: item.features || [],
      }));

      console.log(
        "✅ [SUBSCRIPTION] - Items mapped:",
        subscriptionItems.length
      );

      // ========== STEP 6: Create Subscription ==========
      console.log(
        "🟢 [SUBSCRIPTION] Step 6: Creating subscription in database..."
      );

      const subscription = await Subscriptions.create(
        [
          {
            userId: order.userId,
            orderId: order._id,
            planType: OrderPlanType.SUBSCRIPTION,
            cycleDays: cycleDays as SubscriptionCycle,
            subscriptionStartDate,
            subscriptionEndDate,
            items: subscriptionItems,
            initialDeliveryDate,
            nextDeliveryDate,
            nextBillingDate,
            lastBilledDate,
            status: SubscriptionStatus.ACTIVE,
            metadata: {
              autoCreated: true,
              createdFromPayment: payment._id
                ? payment._id.toString()
                : payment.id || payment._id,
              orderNumber: order.orderNumber,
              createdAt: now.toISOString(),
            },
          },
        ],
        { session }
      );

      console.log("✅ [SUBSCRIPTION] - Subscription created successfully!");
      console.log(
        "✅ [SUBSCRIPTION] - Subscription Number:",
        subscription[0].subscriptionNumber
      );
      console.log("✅ [SUBSCRIPTION] - Subscription ID:", subscription[0]._id);
      console.log("✅ [SUBSCRIPTION] - Status:", subscription[0].status);

      // ========== STEP 7: Commit Transaction ==========
      await session.commitTransaction();
      console.log("✅ [SUBSCRIPTION] - Transaction committed");

      logger.info(
        `✅ Subscription ${subscription[0].subscriptionNumber} created for order ${order.orderNumber}`
      );

      console.log(
        "✅ [SUBSCRIPTION] ============================================"
      );

      return subscription[0];
    } catch (error: any) {
      // Rollback transaction on error
      await session.abortTransaction();

      console.error("❌ [SUBSCRIPTION] ========== ERROR ==========");
      console.error("❌ [SUBSCRIPTION] Error:", error.message);
      console.error("❌ [SUBSCRIPTION] Stack:", error.stack);
      console.error("❌ [SUBSCRIPTION] ===========================");

      logger.error(
        `Failed to create subscription for order ${order.orderNumber}:`,
        error
      );

      // Don't throw error - subscription creation failure shouldn't break payment flow
      return null;
    } finally {
      session.endSession();
    }
  }

  /**
   * Auto-create subscription for subscription orders after payment completion
   * This is a wrapper around createSubscriptionFromOrder for backward compatibility
   */
  private async autoCreateSubscription(
    order: any,
    payment: any
  ): Promise<void> {
    await this.createSubscriptionFromOrder(order, payment);
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
