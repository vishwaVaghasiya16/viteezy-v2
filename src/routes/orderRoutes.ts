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
 * @body    cartId - Cart ID (required)
 * @body    sachets - { planDurationDays: 30|60|90|180, isOneTime: boolean } (required if cart has SACHETS items)
 * @body    standUpPouch - { capsuleCount: 30|60 } (required if cart has STAND_UP_POUCH items)
 * @body    shippingAddressId - Shipping address ID (required)
 * @body    billingAddressId - Billing address ID (optional)
 * @body    pricing fields - subTotal, discountedPrice, grandTotal, etc. (required)
 * @note    Plan selection works similar to checkout page summary API
 * @note    Legacy fields (variantType, planDurationDays, isOneTime, capsuleCount) are still supported for backward compatibility
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
