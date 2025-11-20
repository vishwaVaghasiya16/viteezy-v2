import { Router } from "express";
import { adminUserController } from "@/controllers/adminUserController";
import { authenticate, authorize } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import {
  adminGetAllUsersValidation,
  adminGetUserByIdValidation,
  adminUpdateUserStatusValidation,
} from "@/validation/adminUserValidation";

const router = Router();

/**
 * Get paginated list of users (Admin/Moderator only)
 */
router.get(
  "/",
  authenticate,
  authorize("admin", "moderator"),
  adminGetAllUsersValidation,
  validateRequest,
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
  adminGetUserByIdValidation,
  validateRequest,
  adminUserController.getUserById
);

/**
 * Update a user's active status (Admin only)
 */
router.patch(
  "/:id/status",
  authenticate,
  authorize("admin"),
  adminUpdateUserStatusValidation,
  validateRequest,
  adminUserController.updateUserStatus
);

/**
 * Delete a user (Admin only)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("admin"),
  adminGetUserByIdValidation,
  validateRequest,
  adminUserController.deleteUser
);

export default router;
