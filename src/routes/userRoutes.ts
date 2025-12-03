import { Router } from "express";
import { userController } from "@/controllers/userController";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { updateCurrentUserSchema } from "@/validation/userValidation";

const router = Router();

/**
 * Get current authenticated user profile
 */
router.get("/me", authenticate, userController.getCurrentUser);

/**
 * Update current authenticated user profile
 */
router.put(
  "/me",
  authenticate,
  validateJoi(updateCurrentUserSchema),
  userController.updateCurrentUser
);

/**
 * Get transaction history for the logged-in user with optional filters
 * Query params: page, limit, sort, order, status, paymentMethod, search
 */
router.get(
  "/me/transactions",
  authenticate,
  userController.getTransactionHistory
);

export default router;
