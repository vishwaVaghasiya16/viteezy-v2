import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateJoi,
  validateQuery,
  validateParams,
} from "@/middleware/joiValidation";
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
  getSubscriptionDetailsParamsSchema,
  getSubscriptionsQuerySchema,
  getSubscriptionTransactionHistoryQuerySchema,
  pauseSubscriptionSchema,
  addProductsToSubscriptionSchema,
  removeProductsFromSubscriptionSchema,
  changeSubscriptionShippingAddressSchema,
} from "@/validation/subscriptionValidation";
import { subscriptionController } from "@/controllers/subscriptionController";

const router = Router();

/**
 * All subscription routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/subscriptions
 * @desc    Create subscription after checkout
 * @access  Private
 */
router.post(
  "/",
  validateJoi(createSubscriptionSchema),
  subscriptionController.createSubscription
);

/**
 * @route   GET /api/subscriptions
 * @desc    Get user's subscriptions (Paginated)
 * @access  Private
 * @query   status, page, limit
 */
router.get(
  "/",
  validateQuery(getSubscriptionsQuerySchema),
  subscriptionController.getSubscriptions
);

/**
 * @route   GET /api/subscriptions/:subscriptionId
 * @desc    Get subscription details by ID
 * @access  Private
 * @params  subscriptionId
 */
router.get(
  "/:subscriptionId",
  validateParams(getSubscriptionDetailsParamsSchema),
  subscriptionController.getSubscriptionDetails
);

/**
 * @route   GET /api/subscriptions/:subscriptionId/transactions
 * @desc    Get transaction history for this subscription (Payments: initial + renewals)
 * @access  Private
 * @query   status (Pending|Processing|Completed|Failed|Cancelled|Refunded), page, limit
 */
router.get(
  "/:subscriptionId/transactions",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateQuery(getSubscriptionTransactionHistoryQuerySchema),
  subscriptionController.getSubscriptionTransactionHistory
);

/**
 * @route   PUT /api/subscriptions/:subscriptionId
 * @desc    Update subscription
 * @access  Private
 * @params  subscriptionId
 */
router.put(
  "/:subscriptionId",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateJoi(updateSubscriptionSchema),
  subscriptionController.updateSubscription
);

/**
 * @route   POST /api/subscriptions/:subscriptionId/pause
 * @desc    Pause subscription
 * @access  Private
 * @params  subscriptionId
 */
router.post(
  "/:subscriptionId/pause",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateJoi(pauseSubscriptionSchema),
  subscriptionController.pauseSubscription
);

/**
 * @route   POST /api/subscriptions/:subscriptionId/cancel
 * @desc    Cancel subscription
 * @access  Private
 * @params  subscriptionId
 */
router.post(
  "/:subscriptionId/cancel",
  validateParams(getSubscriptionDetailsParamsSchema),
  subscriptionController.cancelSubscription
);

/**
 * @route   GET /api/subscriptions/widget/overview
 * @desc    Widget data for user dashboard subscription section
 * @access  Private
 */
router.get("/widget/overview", subscriptionController.getSubscriptionWidget);

/**
 * @route   POST /api/subscriptions/:subscriptionId/products
 * @desc    Add products to active subscription
 * @access  Private
 * @params  subscriptionId
 * @body    productIds - Array of product IDs to add
 */
router.post(
  "/:subscriptionId/products",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateJoi(addProductsToSubscriptionSchema),
  subscriptionController.addProductsToSubscription
);

/**
 * @route   POST /api/subscriptions/:subscriptionId/products/remove
 * @desc    Remove products from active subscription
 * @access  Private
 * @params  subscriptionId
 * @body    productIds - Array of product IDs to remove
 */
router.post(
  "/:subscriptionId/products/remove",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateJoi(removeProductsFromSubscriptionSchema),
  subscriptionController.removeProductsFromSubscription
);

/**
 * @route   GET /api/subscriptions/:subscriptionId/addresses
 * @desc    Get all shipping addresses for a subscription
 * @access  Private
 * @params  subscriptionId
 */
router.get(
  "/:subscriptionId/addresses",
  validateParams(getSubscriptionDetailsParamsSchema),
  subscriptionController.getSubscriptionAddresses
);

/**
 * @route   POST /api/subscriptions/:subscriptionId/change-shipping-address
 * @desc    Change shipping address for a subscription (used for future renewals)
 * @access  Private
 * @params  subscriptionId
 * @body    shippingAddressId - New shipping address ID belonging to the user
 */
router.post(
  "/:subscriptionId/change-shipping-address",
  validateParams(getSubscriptionDetailsParamsSchema),
  validateJoi(changeSubscriptionShippingAddressSchema),
  subscriptionController.changeSubscriptionShippingAddress
);

export default router;
