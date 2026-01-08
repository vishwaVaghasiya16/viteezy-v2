import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateParams, validateQuery } from "@/middleware/joiValidation";
import { adminSubscriptionController } from "@/controllers/adminSubscriptionController";
import {
  subscriptionIdParamsSchema,
  getAllSubscriptionsQuerySchema,
} from "@/validation/adminSubscriptionValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/subscriptions
 * @desc Get all subscriptions with pagination and search
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by user firstName, lastName, or product name
 * @query {String} [status] - Filter by subscription status
 */
router.get(
  "/",
  validateQuery(getAllSubscriptionsQuerySchema),
  adminSubscriptionController.getAllSubscriptions
);

/**
 * @route GET /api/v1/admin/subscriptions/:id
 * @desc Get subscription details with transaction logs, renewal history, and plan details
 * @access Admin
 * @param {String} id - Subscription ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(subscriptionIdParamsSchema),
  adminSubscriptionController.getSubscriptionById
);

export default router;
