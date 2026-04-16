/**
 * @fileoverview Order Context Routes
 * @description API routes for order permission and context operations
 * @module routes/orderContextRoutes
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/joiValidation";
import {
  validateOrderPermissionSchema,
  buildOrderContextSchema,
  getPermittedTargetsSchema,
  canOrderForUserSchema,
} from "../validation/orderContextValidation";
import {
  validateOrderPermission,
  buildOrderContext,
  getPermittedOrderTargets,
  canOrderForUser,
} from "../controllers/orderContextController";

const router = Router();

// ============================================================================
// ORDER PERMISSION ROUTES
// ============================================================================

/**
 * @route POST /order-context/validate-permission
 * @desc Validate order permission between users
 * @access Private
 */
router.post(
  "/validate-permission",
  authenticate,
  validate(validateOrderPermissionSchema),
  validateOrderPermission
);

/**
 * @route POST /order-context/build-context
 * @desc Build order context for valid permissions
 * @access Private
 */
router.post(
  "/build-context",
  authenticate,
  validate(buildOrderContextSchema),
  buildOrderContext
);

/**
 * @route GET /order-context/permitted-targets
 * @desc Get list of users the current user can place orders for
 * @access Private
 */
router.get(
  "/permitted-targets",
  authenticate,
  validate(getPermittedTargetsSchema),
  getPermittedOrderTargets
);

/**
 * @route GET /order-context/can-order-for/:targetUserId
 * @desc Check if user can place order for specific user
 * @access Private
 */
router.get(
  "/can-order-for/:targetUserId",
  authenticate,
  validate(canOrderForUserSchema),
  canOrderForUser
);

export default router;
