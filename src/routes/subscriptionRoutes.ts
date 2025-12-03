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

export default router;
