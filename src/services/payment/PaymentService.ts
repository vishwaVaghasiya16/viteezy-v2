import {
  IPaymentGateway,
  PaymentIntentData,
  PaymentResult,
  RefundData,
  RefundResult,
} from "./interfaces/IPaymentGateway";
import { StripeAdapter } from "./adapters/StripeAdapter";
import { MollieAdapter } from "./adapters/MollieAdapter";
import { PaymentMethod, PaymentStatus, OrderStatus } from "../../models/enums";
import { Payments } from "../../models/commerce/payments.model";
import { Orders } from "../../models/commerce/orders.model";
import { User } from "../../models/index.model";
import { logger } from "../../utils/logger";
import { AppError } from "../../utils/AppError";
import mongoose from "mongoose";

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
  getAvailablePaymentMethods(): PaymentMethod[] {
    return Array.from(this.gateways.keys());
  }

  /**
   * Create payment intent and save to database
   */
  async createPayment(data: {
    orderId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    amount: { value: number; currency: string };
    description?: string;
    metadata?: Record<string, string>;
    returnUrl?: string;
    webhookUrl?: string;
  }): Promise<{
    payment: any;
    result: PaymentResult;
  }> {
    try {
      // Validate ObjectId formats
      if (!mongoose.Types.ObjectId.isValid(data.orderId)) {
        throw new AppError("Invalid order ID format", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(data.userId)) {
        throw new AppError("Invalid user ID format", 400);
      }

      // Check if order exists
      const order = await Orders.findById(data.orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Check if user exists
      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Get the appropriate gateway
      const gateway = this.getGateway(data.paymentMethod);

      // Create payment intent data
      const paymentIntentData: PaymentIntentData = {
        amount: Math.round(data.amount.value * 100), // Convert to cents
        currency: data.amount.currency,
        orderId: data.orderId,
        userId: data.userId,
        description: data.description,
        metadata: data.metadata,
        returnUrl: data.returnUrl,
        webhookUrl: data.webhookUrl,
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
        orderId: new mongoose.Types.ObjectId(data.orderId),
        userId: new mongoose.Types.ObjectId(data.userId),
        paymentMethod: data.paymentMethod,
        status: result.status,
        amount: {
          amount: data.amount.value,
          currency: data.amount.currency,
          taxRate: 0, // Default tax rate, can be passed in metadata if needed
        },
        currency: data.amount.currency,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewayResponse: result.gatewayResponse,
      });

      logger.info(`Payment created: ${payment._id} via ${data.paymentMethod}`);

      return {
        payment,
        result,
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
    signature?: string
  ): Promise<any> {
    try {
      const gateway = this.getGateway(paymentMethod);
      const result = await gateway.processWebhook(payload, signature);

      if (!result.gatewayTransactionId) {
        throw new AppError("Gateway transaction ID not found in webhook", 400);
      }

      // Find payment by gateway transaction ID
      const payment = await Payments.findOne({
        gatewayTransactionId: result.gatewayTransactionId,
        paymentMethod: paymentMethod,
      });

      if (!payment) {
        logger.warn(
          `Payment not found for gateway transaction: ${result.gatewayTransactionId}`
        );
        throw new AppError("Payment not found", 404);
      }

      // Check if status changed
      const statusChanged = payment.status !== result.status;
      const previousStatus = payment.status;

      // Update payment status
      payment.status = result.status;
      payment.gatewayResponse =
        result.gatewayResponse || payment.gatewayResponse;
      if (result.status === PaymentStatus.COMPLETED) {
        payment.processedAt = new Date();
      }
      if (result.error) {
        payment.failureReason = result.error;
      }
      await payment.save();

      // Update order status if payment is completed
      if (
        result.status === PaymentStatus.COMPLETED &&
        statusChanged &&
        previousStatus !== PaymentStatus.COMPLETED
      ) {
        const order = await Orders.findById(payment.orderId);
        if (order) {
          order.paymentStatus = PaymentStatus.COMPLETED;
          order.status = OrderStatus.CONFIRMED;
          order.paymentId = (payment._id as mongoose.Types.ObjectId).toString();
          await order.save();
          logger.info(
            `Order ${order.orderNumber} confirmed via webhook after payment completion`
          );
        }
      }

      logger.info(
        `Payment ${payment._id} updated via webhook: ${result.status}`
      );

      return payment;
    } catch (error: any) {
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

      // Get order details
      const order = await Orders.findById(data.orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Verify order belongs to user
      if (order.userId.toString() !== data.userId) {
        throw new AppError("Order does not belong to user", 403);
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

      // Get the appropriate gateway
      const gateway = this.getGateway(data.paymentMethod);

      // Get order ID
      const orderId = (order._id as mongoose.Types.ObjectId).toString();

      // Create payment intent data
      const paymentIntentData: PaymentIntentData = {
        amount: Math.round(order.total.amount * 100), // Convert to cents
        currency: order.total.currency,
        orderId: orderId,
        userId: data.userId,
        description: `Order ${order.orderNumber}`,
        metadata: {
          orderNumber: order.orderNumber,
          orderId: orderId,
        },
        returnUrl: data.returnUrl,
        webhookUrl: `${
          process.env.APP_BASE_URL || "http://localhost:8080"
        }/api/v1/payments/webhook/${data.paymentMethod}`,
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
          amount: order.total.amount,
          currency: order.total.currency,
          taxRate: order.tax.amount / order.subtotal.amount || 0,
        },
        currency: order.total.currency,
        gatewayTransactionId: result.gatewayTransactionId,
        gatewayResponse: result.gatewayResponse,
      });

      // Get payment ID
      const paymentId = (payment._id as mongoose.Types.ObjectId).toString();

      // Update order payment status
      order.paymentStatus = result.status;
      order.paymentMethod = data.paymentMethod;
      order.paymentId = paymentId;
      await order.save();

      logger.info(
        `Payment intent created for order ${order.orderNumber}: ${paymentId} via ${data.paymentMethod}`
      );

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

      // Get payment
      const payment = await Payments.findById(data.paymentId).populate(
        "orderId"
      );
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
      if (statusChanged && !wasCompleted) {
        order.paymentStatus = result.status;
        order.paymentId = (payment._id as mongoose.Types.ObjectId).toString();

        // Update order status based on payment status
        if (result.status === PaymentStatus.COMPLETED) {
          order.status = OrderStatus.CONFIRMED;
          orderUpdated = true;
          logger.info(
            `Order ${order.orderNumber} confirmed after payment completion`
          );
        } else if (result.status === PaymentStatus.FAILED) {
          // Keep order as pending if payment failed
          orderUpdated = true;
          logger.info(`Order ${order.orderNumber} payment failed`);
        } else if (result.status === PaymentStatus.CANCELLED) {
          // Keep order as pending if payment cancelled
          orderUpdated = true;
          logger.info(`Order ${order.orderNumber} payment cancelled`);
        }

        await order.save();
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
}

// Export singleton instance
export const paymentService = new PaymentService();
