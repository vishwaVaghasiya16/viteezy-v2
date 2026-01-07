import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminSubscriptionPlanController } from "@/controllers/adminSubscriptionPlanController";
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
  subscriptionPlanIdParamsSchema,
  getAllSubscriptionPlansQuerySchema,
} from "@/validation/adminSubscriptionPlanValidation";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route   POST /api/v1/admin/subscription-plans
 * @desc    Create subscription plan (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  validateJoi(createSubscriptionPlanSchema),
  adminSubscriptionPlanController.createSubscriptionPlan
);

/**
 * @route   GET /api/v1/admin/subscription-plans
 * @desc    Get all subscription plans with pagination and filters (Admin only)
 * @access  Private (Admin)
 * @query   {Number} [page] - Page number (default: 1)
 * @query   {Number} [limit] - Items per page (default: 10)
 * @query   {String} [status] - Filter by status (ACTIVE/INACTIVE)
 * @query   {String} [search] - Search by title
 */
router.get(
  "/",
  validateQuery(getAllSubscriptionPlansQuerySchema),
  adminSubscriptionPlanController.getAllSubscriptionPlans
);

/**
 * @route   GET /api/v1/admin/subscription-plans/:id
 * @desc    Get subscription plan by ID (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  validateParams(subscriptionPlanIdParamsSchema),
  adminSubscriptionPlanController.getSubscriptionPlanById
);

/**
 * @route   PUT /api/v1/admin/subscription-plans/:id
 * @desc    Update subscription plan (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  validateParams(subscriptionPlanIdParamsSchema),
  validateJoi(updateSubscriptionPlanSchema),
  adminSubscriptionPlanController.updateSubscriptionPlan
);

/**
 * @route   DELETE /api/v1/admin/subscription-plans/:id
 * @desc    Delete subscription plan (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  validateParams(subscriptionPlanIdParamsSchema),
  adminSubscriptionPlanController.deleteSubscriptionPlan
);

export default router;
