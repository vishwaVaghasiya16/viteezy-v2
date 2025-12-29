import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateQuery,
  validateParams,
  validateJoi,
} from "@/middleware/joiValidation";
import { adminUserController } from "@/controllers/adminUserController";
import {
  adminGetAllUsersQuerySchema,
  adminUserIdParamsSchema,
  adminUpdateUserStatusSchema,
} from "@/validation/adminUserValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/users
 * @desc Get all users with pagination and filters
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by name or email
 * @query {Boolean} [isActive] - Filter by active status (true/false)
 * @query {String} [userType] - Filter by user type: "new" or "recurring"
 */
router.get(
  "/",
  validateQuery(adminGetAllUsersQuerySchema),
  adminUserController.getAllUsers
);

/**
 * @route GET /api/v1/admin/users/stats
 * @desc Get user statistics
 * @access Admin
 */
router.get("/stats", adminUserController.getUserStats);

/**
 * @route GET /api/v1/admin/users/:id
 * @desc Get user by ID
 * @access Admin
 */
router.get(
  "/:id",
  validateParams(adminUserIdParamsSchema),
  adminUserController.getUserById
);

/**
 * @route PATCH /api/v1/admin/users/:id/status
 * @desc Toggle user active status (block/unblock or activate)
 * @access Admin
 * @body {Boolean} isActive - Active status (true to activate, false to block)
 */
router.patch(
  "/:id/status",
  validateParams(adminUserIdParamsSchema),
  validateJoi(adminUpdateUserStatusSchema),
  adminUserController.toggleUserStatus
);

/**
 * @route DELETE /api/v1/admin/users/:id
 * @desc Delete user (soft delete)
 * @access Admin
 */
router.delete(
  "/:id",
  validateParams(adminUserIdParamsSchema),
  adminUserController.deleteUser
);

export default router;
