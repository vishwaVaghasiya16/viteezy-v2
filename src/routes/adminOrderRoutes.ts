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

export default router;

