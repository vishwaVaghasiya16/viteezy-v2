import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import {
  getOrderHistoryValidation,
  getOrderDetailsValidation,
} from "@/validation/orderValidation";
import { orderController } from "@/controllers/orderController";

const router = Router();

/**
 * All order routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/orders
 * @desc    Get order history for authenticated user (Paginated)
 * @access  Private
 * @query   status, paymentStatus, startDate, endDate, page, limit
 */
router.get(
  "/",
  getOrderHistoryValidation,
  validateRequest,
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
  getOrderDetailsValidation,
  validateRequest,
  orderController.getOrderDetails
);

export default router;
