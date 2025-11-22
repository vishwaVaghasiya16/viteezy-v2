import { Router } from "express";
import { adminUserController } from "@/controllers/adminUserController";
import { authenticate, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import {
  adminGetAllUsersQuerySchema,
  adminUserIdParamsSchema,
  adminUpdateUserStatusSchema,
} from "@/validation/adminUserValidation";

const router = Router();

/**
 * Get paginated list of users (Admin/Moderator only)
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "moderator"),
  validateQuery(adminGetAllUsersQuerySchema),
  adminUserController.getAllUsers
);

/**
 * Get aggregate statistics for users (Admin only)
 */
router.get(
  "/stats",
  authenticate,
  authorize("admin"),
  adminUserController.getUserStats
);

/**
 * Get a single user by ID (Admin/Moderator only)
 */
router.get(
  "/:id",
  authenticate,
  authorize("admin", "moderator"),
  validateParams(adminUserIdParamsSchema),
  adminUserController.getUserById
);

/**
 * Update a user's active status (Admin only)
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  validateParams(adminUserIdParamsSchema),
  validateJoi(adminUpdateUserStatusSchema),
  adminUserController.updateUserStatus
);

/**
 * Delete a user (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  validateParams(adminUserIdParamsSchema),
  adminUserController.deleteUser
);

export default router;
