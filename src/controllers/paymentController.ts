import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { paymentService } from "@/services/payment";
import { PaymentMethod } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

class PaymentController {
  /**
   * Get available payment methods
   */
  getAvailableMethods = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const methods = paymentService.getAvailablePaymentMethods();

      res.apiSuccess(
        {
          methods,
        },
        "Payment methods retrieved successfully"
      );
    }
  );

  /**
   * Create payment
   */
  createPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      res.apiCreated(
        {
          payment: {
            _id: result.payment._id,
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
        "Payment created successfully"
      );
    }
  );

  /**
   * Verify payment
   */
  verifyPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { paymentId, gatewayTransactionId } = req.body;

      const payment = await paymentService.verifyPayment(
        paymentId,
        gatewayTransactionId
      );

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            orderId: payment.orderId,
            status: payment.status,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
          },
        },
        "Payment verified successfully"
      );
    }
  );

  /**
   * Create payment intent for product checkout (order-based)
   */
  createPaymentIntent = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      res.apiCreated(
        {
          payment: {
            _id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            _id: result.order._id,
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
        "Payment intent created successfully"
      );
    }
  );

  /**
   * Verify payment and update order status (Frontend Callback)
   */
  verifyPaymentCallback = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      res.apiSuccess(
        {
          payment: {
            _id: result.payment._id,
            orderId: result.payment.orderId,
            status: result.payment.status,
            amount: result.payment.amount,
            paymentMethod: result.payment.paymentMethod,
            gatewayTransactionId: result.payment.gatewayTransactionId,
          },
          order: {
            _id: result.order._id,
            orderNumber: result.order.orderNumber,
            status: result.order.status,
            paymentStatus: result.order.paymentStatus,
            total: result.order.total,
          },
          updated: result.updated,
        },
        result.updated
          ? "Payment verified and order updated successfully"
          : "Payment verified successfully"
      );
    }
  );

  /**
   * Process Stripe webhook
   */
  processStripeWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      try {
        const signature = req.headers["stripe-signature"] as string;
        const payload = req.body;

        const payment = await paymentService.processWebhook(
          PaymentMethod.STRIPE,
          payload,
          signature
        );

        res.apiSuccess(
          {
            payment: {
              _id: payment._id,
              status: payment.status,
            },
          },
          "Webhook processed successfully"
        );
      } catch (error) {
        logger.error("Stripe webhook processing error:", error);
        // Still return 200 to prevent webhook retries
        res.status(200).json({
          success: false,
          message: "Webhook processing failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Process Mollie webhook
   */
  processMollieWebhook = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      try {
        const payload = req.body;

        const payment = await paymentService.processWebhook(
          PaymentMethod.MOLLIE,
          payload
        );

        res.apiSuccess(
          {
            payment: {
              _id: payment._id,
              status: payment.status,
            },
          },
          "Webhook processed successfully"
        );
      } catch (error) {
        logger.error("Mollie webhook processing error:", error);
        // Still return 200 to prevent webhook retries
        res.status(200).json({
          success: false,
          message: "Webhook processing failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  /**
   * Refund payment
   */
  refundPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { paymentId, amount, reason, metadata } = req.body;

      const payment = await paymentService.refundPayment({
        paymentId,
        amount,
        reason,
        metadata,
      });

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            status: payment.status,
            refundAmount: payment.refundAmount,
            refundReason: payment.refundReason,
          },
        },
        "Refund processed successfully"
      );
    }
  );

  /**
   * Cancel payment
   */
  cancelPayment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { paymentId } = req.body;

      const payment = await paymentService.cancelPayment(paymentId);

      res.apiSuccess(
        {
          payment: {
            _id: payment._id,
            status: payment.status,
          },
        },
        "Payment cancelled successfully"
      );
    }
  );

  /**
   * Get payment by ID
   */
  getPayment = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { paymentId } = req.params;

      const payment = await paymentService.getPayment(paymentId);

      res.apiSuccess(
        {
          payment,
        },
        "Payment retrieved successfully"
      );
    }
  );

  /**
   * Get payments by order
   */
  getPaymentsByOrder = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { orderId } = req.params;

      const payments = await paymentService.getPaymentsByOrder(orderId);

      res.apiSuccess(
        {
          payments,
        },
        "Payments retrieved successfully"
      );
    }
  );

  /**
   * Get payments by user
   */
  getPaymentsByUser = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const payments = await paymentService.getPaymentsByUser(userId);

      res.apiSuccess(
        {
          payments,
        },
        "Payments retrieved successfully"
      );
    }
  );
}

export const paymentController = new PaymentController();
