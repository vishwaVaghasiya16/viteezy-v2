import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminOrderController } from "@/controllers/adminOrderController";
import {
  orderIdParamsSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
  updateTrackingNumberSchema,
  getAllOrdersQuerySchema,
  createManualOrderSchema,
  partialRefundSchema,
} from "@/validation/adminOrderValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/orders/stats
 * @desc Get order statistics with comparison to last month
 * @access Admin
 */
router.get("/stats", adminOrderController.getOrderStats);

/**
 * @route GET /api/v1/admin/orders
 * @desc Get all orders with pagination and filters
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by order number, customer name, or email
 * @query {String} [status] - Filter by order status
 * @query {String} [paymentStatus] - Filter by payment status
 * @query {String} [planType] - Filter by plan type (One-Time or Subscription)
 * @query {String} [startDate] - Filter orders from date (ISO date string)
 * @query {String} [endDate] - Filter orders to date (ISO date string)
 * @query {String} [customerId] - Filter by customer ID
 */
router.get(
  "/",
  validateQuery(getAllOrdersQuerySchema),
  adminOrderController.getAllOrders
);

/**
 * @route GET /api/v1/admin/orders/:id
 * @desc Get order by ID
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(orderIdParamsSchema),
  adminOrderController.getOrderById
);

/**
 * @route PATCH /api/v1/admin/orders/:id/status
 * @desc Update order status
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 * @body {String} status - Order status (Pending, Confirmed, Processing, Shipped, Delivered, Cancelled, Refunded)
 */
router.patch(
  "/:id/status",
  validateParams(orderIdParamsSchema),
  validateJoi(updateOrderStatusSchema),
  adminOrderController.updateOrderStatus
);

/**
 * @route PATCH /api/v1/admin/orders/:id/payment-status
 * @desc Update payment status
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 * @body {String} paymentStatus - Payment status (Pending, Processing, Completed, Failed, Cancelled, Refunded)
 */
router.patch(
  "/:id/payment-status",
  validateParams(orderIdParamsSchema),
  validateJoi(updatePaymentStatusSchema),
  adminOrderController.updatePaymentStatus
);

/**
 * @route PATCH /api/v1/admin/orders/:id/tracking
 * @desc Update tracking number
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 * @body {String} trackingNumber - Tracking number
 */
router.patch(
  "/:id/tracking",
  validateParams(orderIdParamsSchema),
  validateJoi(updateTrackingNumberSchema),
  adminOrderController.updateTrackingNumber
);

/**
 * @route DELETE /api/v1/admin/orders/:id
 * @desc Delete order (soft delete)
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 */
router.delete(
  "/:id",
  validateParams(orderIdParamsSchema),
  adminOrderController.deleteOrder
);

/**
 * @route POST /api/v1/admin/orders/manual
 * @desc Create manual order (Admin Panel)
 * @access Admin
 * @body {String} userId - User ID (MongoDB ObjectId)
 * @body {String} orderType - Order type: "already_paid" or "pending_payment"
 * @body {Array} items - Order items array
 * @body {String} shippingAddressId - Shipping address ID (MongoDB ObjectId)
 * @body {String} [billingAddressId] - Billing address ID (MongoDB ObjectId, optional)
 * @body {Number} subTotal - Subtotal amount
 * @body {Number} discountedPrice - Discounted price
 * @body {Number} grandTotal - Grand total amount
 * @body {String} [currency] - Currency code (default: "USD")
 * @body {String} [couponCode] - Coupon code (optional)
 * @body {String} [paymentMethod] - Payment method (optional)
 * @body {String} [notes] - Order notes (optional)
 * @body {String} planType - Plan type (One-Time, Subscription, Mixed)
 * @body {Boolean} isOneTime - Whether order is one-time purchase
 * @note For "already_paid": Order is created with payment status "Completed"
 * @note For "pending_payment": Order is created with payment status "Pending", cart is created, payment link is generated, and payment request email is sent to customer
 */
router.post(
  "/manual",
  validateJoi(createManualOrderSchema),
  adminOrderController.createManualOrder
);

/**
 * @route POST /api/v1/admin/orders/:id/partial-refund
 * @desc Process partial refund for specific products in an order
 * @access Admin
 * @param {String} id - Order ID (MongoDB ObjectId)
 * @body {Array<String>} productIds - Array of product IDs to refund
 * @body {Number} [refundAmount] - Refund amount (optional, will calculate automatically)
 * @body {String} [refundMethod] - Refund method: "manual" or "gateway" (default: "gateway")
 * @body {String} [reason] - Refund reason (optional)
 * @body {Object} [metadata] - Additional metadata (optional)
 */
router.post(
  "/:id/partial-refund",
  validateParams(orderIdParamsSchema),
  validateJoi(partialRefundSchema),
  adminOrderController.processPartialRefund
);

export default router;

