import { Request, Response, NextFunction } from "express";
import { paymentService } from "../services/payment";
import { PaymentMethod } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

export class PaymentController {
  /**
   * Get available payment methods
   */
  static async getAvailableMethods(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const methods = paymentService.getAvailablePaymentMethods();

      res.status(200).json({
        success: true,
        data: {
          methods,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create payment
   */
  static async createPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        orderId,
        paymentMethod,
        amount,
        description,
        metadata,
        returnUrl,
      } = req.body;

      const result = await paymentService.createPayment({
        orderId,
        userId,
        paymentMethod: paymentMethod as PaymentMethod,
        amount,
        description,
        metadata,
        returnUrl,
      });

      res.status(201).json({
        success: true,
        message: "Payment created successfully",
        data: {
          payment: {
            id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
          },
          gateway: {
            redirectUrl: result.result.redirectUrl,
            clientSecret: result.result.clientSecret,
            gatewayTransactionId: result.result.gatewayTransactionId,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify payment
   */
  static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId, gatewayTransactionId } = req.body;

      const payment = await paymentService.verifyPayment(
        paymentId,
        gatewayTransactionId
      );

      res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        data: {
          payment: {
            id: payment._id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create payment intent for product checkout (order-based)
   */
  static async createPaymentIntent(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId, paymentMethod, returnUrl, cancelUrl } = req.body;

      const result = await paymentService.createPaymentIntentForOrder({
        orderId,
        userId,
        paymentMethod: paymentMethod as PaymentMethod,
        returnUrl,
        cancelUrl,
      });

      res.status(201).json({
        success: true,
        message: "Payment intent created successfully",
        data: {
          payment: {
            id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            id: result.order._id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            paymentStatus: result.order.paymentStatus,
            total: result.order.total,
          },
          gateway: {
            redirectUrl: result.result.redirectUrl,
            clientSecret: result.result.clientSecret,
            gatewayTransactionId: result.result.gatewayTransactionId,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify payment and update order status (Frontend Callback)
   */
  static async verifyPaymentCallback(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { paymentId, gatewayTransactionId } = req.body;

      const result = await paymentService.verifyPaymentAndUpdateOrder({
        paymentId,
        gatewayTransactionId,
      });

      // Verify payment belongs to user
      if (result.payment.userId.toString() !== userId) {
        throw new AppError("Payment does not belong to user", 403);
      }

      // Verify order belongs to user
      if (result.order.userId.toString() !== userId) {
        throw new AppError("Order does not belong to user", 403);
      }

      res.status(200).json({
        success: true,
        message: result.updated
          ? "Payment verified and order updated successfully"
          : "Payment verified successfully",
        data: {
          payment: {
            id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            id: result.order._id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            paymentStatus: result.order.paymentStatus,
            total: result.order.total,
          },
          updated: result.updated,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Process Stripe webhook
   */
  static async processStripeWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const signature = req.headers["stripe-signature"] as string;
      const payload = req.body;

      const payment = await paymentService.processWebhook(
        PaymentMethod.STRIPE,
        payload,
        signature
      );

      res.status(200).json({
        success: true,
        message: "Webhook processed successfully",
        data: {
          payment: {
            id: payment._id,
            status: payment.status,
          },
        },
      });
    } catch (error) {
      logger.error("Stripe webhook processing error:", error);
      // Still return 200 to prevent webhook retries
      res.status(200).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }

  /**
   * Process Mollie webhook
   */
  static async processMollieWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const payload = req.body;

      const payment = await paymentService.processWebhook(
        PaymentMethod.MOLLIE,
        payload
      );

      res.status(200).json({
        success: true,
        message: "Webhook processed successfully",
        data: {
          payment: {
            id: payment._id,
            status: payment.status,
          },
        },
      });
    } catch (error) {
      logger.error("Mollie webhook processing error:", error);
      // Still return 200 to prevent webhook retries
      res.status(200).json({
        success: false,
        message: "Webhook processing failed",
      });
    }
  }

  /**
   * Refund payment
   */
  static async refundPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { paymentId, amount, reason, metadata } = req.body;

      const payment = await paymentService.refundPayment({
        paymentId,
        amount,
        reason,
        metadata,
      });

      res.status(200).json({
        success: true,
        message: "Refund processed successfully",
        data: {
          payment: {
            id: payment._id,
            status: payment.status,
            refundAmount: payment.refundAmount,
            refundReason: payment.refundReason,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel payment
   */
  static async cancelPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { paymentId } = req.body;

      const payment = await paymentService.cancelPayment(paymentId);

      res.status(200).json({
        success: true,
        message: "Payment cancelled successfully",
        data: {
          payment: {
            id: payment._id,
            status: payment.status,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment by ID
   */
  static async getPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { paymentId } = req.params;

      const payment = await paymentService.getPayment(paymentId);

      res.status(200).json({
        success: true,
        data: {
          payment,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payments by order
   */
  static async getPaymentsByOrder(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { orderId } = req.params;

      const payments = await paymentService.getPaymentsByOrder(orderId);

      res.status(200).json({
        success: true,
        data: {
          payments,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payments by user
   */
  static async getPaymentsByUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const payments = await paymentService.getPaymentsByUser(userId);

      res.status(200).json({
        success: true,
        data: {
          payments,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
