import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminSubscriptionController } from "@/controllers/adminSubscriptionController";
import {
  subscriptionIdParamsSchema,
  getAllSubscriptionsQuerySchema,
  cancelSubscriptionSchema,
  pauseSubscriptionSchema,
} from "@/validation/adminSubscriptionValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/subscriptions
 * @desc Get all subscriptions with pagination and filters
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by subscription number, user firstName, lastName, product name, or subscription ID
 * @query {String} [status] - Filter by subscription status
 * @query {String} [startDate] - Filter subscriptions from date (ISO date string)
 * @query {String} [endDate] - Filter subscriptions to date (ISO date string)
 * @query {String} [userId] - Filter by user ID
 */
router.get(
  "/",
  validateQuery(getAllSubscriptionsQuerySchema),
  adminSubscriptionController.getAllSubscriptions
);

/**
 * @route GET /api/v1/admin/subscriptions/:id
 * @desc Get subscription detail by ID with payment/transaction logs
 * @access Admin
 * @param {String} id - Subscription ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(subscriptionIdParamsSchema),
  adminSubscriptionController.getSubscriptionById
);

/**
 * @route POST /api/v1/admin/subscriptions/:id/cancel
 * @desc Cancel subscription by admin
 * @access Admin
 * @param {String} id - Subscription ID (MongoDB ObjectId)
 * @body {Boolean} cancelAtEndDate - Cancel at end date (toggle)
 * @body {Boolean} cancelImmediately - Cancel immediately (toggle)
 * @body {String} cancellationReason - Cancellation reason (required)
 */
router.post(
  "/:id/cancel",
  validateParams(subscriptionIdParamsSchema),
  validateJoi(cancelSubscriptionSchema),
  adminSubscriptionController.cancelSubscription
);

/**
 * @route POST /api/v1/admin/subscriptions/:id/pause
 * @desc Pause subscription by admin
 * @access Admin
 * @param {String} id - Subscription ID (MongoDB ObjectId)
 */
router.post(
  "/:id/pause",
  validateParams(subscriptionIdParamsSchema),
  validateJoi(pauseSubscriptionSchema),
  adminSubscriptionController.pauseSubscription
);

export default router;

