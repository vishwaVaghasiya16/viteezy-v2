import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateJoi,
  validateQuery,
  validateParams,
} from "@/middleware/joiValidation";
import {
  getOrderHistoryQuerySchema,
  getOrderDetailsParamsSchema,
  createOrderSchema,
} from "@/validation/orderValidation";
import { orderController } from "@/controllers/orderController";

const router = Router();

/**
 * All order routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/orders
 * @desc    Create a new order record prior to payment
 * @access  Private
 */
router.post("/", validateJoi(createOrderSchema), orderController.createOrder);

/**
 * @route   GET /api/orders
 * @desc    Get order history for authenticated user (Paginated)
 * @access  Private
 * @query   status, paymentStatus, startDate, endDate, page, limit
 */
router.get(
  "/",
  validateQuery(getOrderHistoryQuerySchema),
  orderController.getOrderHistory
);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get order details by ID
 * @access  Private
 * @params  orderId
 */
router.get(
  "/:orderId",
  validateParams(getOrderDetailsParamsSchema),
  orderController.getOrderDetails
);

export default router;
