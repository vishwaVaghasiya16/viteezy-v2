import { Router } from "express";
import { adminMembershipPlanController } from "@/controllers/adminMembershipPlanController";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import {
  createMembershipPlanSchema,
  updateMembershipPlanSchema,
  membershipPlanIdParamsSchema,
  getAllMembershipPlansQuerySchema,
} from "@/validation/adminMembershipPlanValidation";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route   POST /api/v1/admin/membership-plans
 * @desc    Create membership plan (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  validateJoi(createMembershipPlanSchema),
  adminMembershipPlanController.createMembershipPlan
);

/**
 * @route   GET /api/v1/admin/membership-plans
 * @desc    Get all membership plans (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/",
  validateQuery(getAllMembershipPlansQuerySchema),
  adminMembershipPlanController.getAllMembershipPlans
);

/**
 * @route   GET /api/v1/admin/membership-plans/:id
 * @desc    Get membership plan by ID (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  validateParams(membershipPlanIdParamsSchema),
  adminMembershipPlanController.getMembershipPlanById
);

/**
 * @route   PUT /api/v1/admin/membership-plans/:id
 * @desc    Update membership plan (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  validateParams(membershipPlanIdParamsSchema),
  validateJoi(updateMembershipPlanSchema),
  adminMembershipPlanController.updateMembershipPlan
);

/**
 * @route   DELETE /api/v1/admin/membership-plans/:id
 * @desc    Delete membership plan (Admin only) - Soft delete
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  validateParams(membershipPlanIdParamsSchema),
  adminMembershipPlanController.deleteMembershipPlan
);

export default router;
