import { Router, Request, Response, NextFunction } from "express";
import { PaymentController } from "../controllers/paymentController";
import { authMiddleware } from "../middleware/auth";
import {
  validatePayment,
  validatePaymentParams,
  createPaymentSchema,
  verifyPaymentSchema,
  createPaymentIntentSchema,
  verifyPaymentCallbackSchema,
  refundPaymentSchema,
  cancelPaymentSchema,
  paymentIdParamsSchema,
  orderIdParamsSchema,
} from "../validation/paymentValidation";

const router = Router();

// IMPORTANT: Specific routes MUST come before parameterized routes (/:paymentId)
// Otherwise, Express will match /method to /:paymentId with paymentId = "method"

/**
 * @route   GET /api/v1/payments/methods
 * @route   GET /api/v1/payments/method (alias for backward compatibility)
 * @desc    Get available payment methods
 * @access  Public
 */
router.get("/methods", PaymentController.getAvailableMethods);
router.get("/method", PaymentController.getAvailableMethods); // Alias for singular

/**
 * @route   GET /api/v1/payments/user/me
 * @desc    Get payments by current user
 * @access  Private
 */
router.get("/user/me", authMiddleware, PaymentController.getPaymentsByUser);

/**
 * @route   GET /api/v1/payments/order/:orderId
 * @desc    Get payments by order ID
 * @access  Private
 */
router.get(
  "/order/:orderId",
  authMiddleware,
  validatePaymentParams(orderIdParamsSchema),
  PaymentController.getPaymentsByOrder
);

/**
 * @route   POST /api/v1/payments/create
 * @desc    Create a new payment
 * @access  Private
 */
router.post(
  "/create",
  authMiddleware,
  validatePayment(createPaymentSchema),
  PaymentController.createPayment
);

/**
 * @route   POST /api/v1/payments/verify
 * @desc    Verify payment status
 * @access  Private
 */
router.post(
  "/verify",
  authMiddleware,
  validatePayment(verifyPaymentSchema),
  PaymentController.verifyPayment
);

/**
 * @route   POST /api/v1/payments/intent
 * @desc    Create payment intent for product checkout (order-based)
 * @access  Private
 */
router.post(
  "/intent",
  authMiddleware,
  validatePayment(createPaymentIntentSchema),
  PaymentController.createPaymentIntent
);

/**
 * @route   POST /api/v1/payments/verify-callback
 * @desc    Verify payment and update order status (Frontend Callback)
 * @access  Private
 */
router.post(
  "/verify-callback",
  authMiddleware,
  validatePayment(verifyPaymentCallbackSchema),
  PaymentController.verifyPaymentCallback
);

/**
 * @route   POST /api/v1/payments/webhook/stripe
 * @desc    Process Stripe webhook
 * @access  Public (webhook endpoint)
 */
router.post("/webhook/stripe", PaymentController.processStripeWebhook);

/**
 * @route   POST /api/v1/payments/webhook/mollie
 * @desc    Process Mollie webhook
 * @access  Public (webhook endpoint)
 */
router.post("/webhook/mollie", PaymentController.processMollieWebhook);

/**
 * @route   POST /api/v1/payments/refund
 * @desc    Refund a payment
 * @access  Private
 */
router.post(
  "/refund",
  authMiddleware,
  validatePayment(refundPaymentSchema),
  PaymentController.refundPayment
);

/**
 * @route   POST /api/v1/payments/cancel
 * @desc    Cancel a payment
 * @access  Private
 */
router.post(
  "/cancel",
  authMiddleware,
  validatePayment(cancelPaymentSchema),
  PaymentController.cancelPayment
);

/**
 * @route   GET /api/v1/payments/:paymentId
 * @desc    Get payment by ID
 * @access  Private
 * @note    This must be the LAST GET route to avoid matching specific paths
 *          Reserved paths like "create", "verify", "intent", etc. will return 404
 */
router.get(
  "/:paymentId",
  authMiddleware,
  // Middleware to prevent reserved paths from being treated as payment IDs
  (req: Request, res: Response, next: NextFunction): void => {
    const reservedPaths = [
      "create",
      "verify",
      "intent",
      "verify-callback",
      "refund",
      "cancel",
      "methods",
      "method",
      "webhook",
      "order",
      "user",
    ];

    if (reservedPaths.includes(req.params.paymentId)) {
      res.status(404).json({
        success: false,
        message: "Route not found",
        errorType: "Not Found",
        error: `The route /api/v1/payments/${req.params.paymentId} does not exist for GET method`,
      });
      return;
    }

    next();
  },
  validatePaymentParams(paymentIdParamsSchema),
  PaymentController.getPayment
);

export default router;
