import { Router } from "express";
import { userController } from "@/controllers/userController";
import { authenticate } from "@/middleware/auth";
import { validateRequest } from "@/middleware/validation";
import {
  getCurrentUserValidation,
  updateCurrentUserValidation,
} from "@/validation/userValidation";

const router = Router();

/**
 * Get current authenticated user profile
 */
router.get(
  "/me",
  authenticate,
  getCurrentUserValidation,
  validateRequest,
  userController.getCurrentUser
);

/**
 * Update current authenticated user profile
 */
router.put(
  "/me",
  authenticate,
  updateCurrentUserValidation,
  validateRequest,
  userController.updateCurrentUser
);

export default router;
