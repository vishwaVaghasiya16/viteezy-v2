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
import { validateOrderContext } from "@/middleware/orderContextMiddleware";
import { validateManualAddress, resolveShippingAddress } from "@/middleware/addressResolutionMiddleware";

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
 * @body    orderedFor - Target user ID for family orders (optional, defaults to self)
 * @body    manualAddress - Manual address for checkout (optional, highest priority)
 * @body    shippingAddressId - Specific address ID (optional, defaults to user's default)
 * @body    sachets - { planDurationDays: 30|60|90|180, isOneTime: boolean } (required if cart has SACHETS items)
 * @body    standUpPouch - { capsuleCount?: 30|60 (optional, fallback), itemQuantities: [{ productId: string, quantity: number, capsuleCount?: 30|60, planDays?: 30|60 }] } (required if cart has STAND_UP_POUCH items)
 * @body    billingAddressId - Billing address ID (optional)
 * @body    pricing - { sachets?: {...}, standUpPouch?: {...}, overall: {...} } (required; stored in DB)
 * @note    Plan selection works similar to checkout page summary API
 * @note    STAND_UP_POUCH: Each product in itemQuantities can have its own capsuleCount/planDays. If not provided per product, falls back to top-level capsuleCount/planDays or defaults to 30.
 * @note    Legacy fields (variantType, planDurationDays, isOneTime, capsuleCount) are still supported for backward compatibility
 * @note    Family orders: Main members can place orders for linked sub-members by providing orderedFor field
 * @note    Address inheritance: Sub-members automatically inherit main member's default address if they don't have one
 * @note    Manual address: Manual address provided during checkout takes highest priority
 */
router.post("/", 
  validateOrderContext, 
  validateManualAddress, 
  resolveShippingAddress, 
  validateJoi(createOrderSchema), 
  orderController.createOrder
);

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
