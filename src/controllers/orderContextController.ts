/**
 * @fileoverview Order Context Controller
 * @description Controller for order permission and context endpoints
 * @module controllers/orderContextController
 */

import { Request, Response, NextFunction } from "express";
import { orderPermissionService } from "../services/orderPermissionService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { validate } from "../middleware/joiValidation";
import {
  validateOrderPermissionSchema,
  buildOrderContextSchema,
  getPermittedTargetsSchema,
} from "../validation/orderContextValidation";

// ============================================================================
// INTERFACES
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

// ============================================================================
// ORDER CONTEXT CONTROLLER
// ============================================================================

/**
 * Validate order permission between users
 * @route POST /order-context/validate-permission
 * @access Private
 */
export const validateOrderPermission = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const { orderedFor } = req.body;

    logger.info("Validating order permission", {
      action: "validateOrderPermission",
      currentUserId,
      orderedFor,
    });

    const permissionResult = await orderPermissionService.validateOrderPermission(
      currentUserId,
      orderedFor
    );

    res.status(200).json({
      success: true,
      data: permissionResult,
      message: permissionResult.allowed 
        ? "Order permission granted" 
        : "Order permission denied",
    });
  } catch (error) {
    logger.error("Failed to validate order permission", {
      action: "validateOrderPermission",
      currentUserId: req.user?._id,
      orderedFor: req.body.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Build order context for valid permissions
 * @route POST /order-context/build-context
 * @access Private
 */
export const buildOrderContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const { orderedFor } = req.body;

    logger.info("Building order context", {
      action: "buildOrderContext",
      currentUserId,
      orderedFor,
    });

    const orderContext = await orderPermissionService.buildOrderContext(
      currentUserId,
      orderedFor
    );

    res.status(200).json({
      success: true,
      data: orderContext,
      message: "Order context built successfully",
    });
  } catch (error) {
    logger.error("Failed to build order context", {
      action: "buildOrderContext",
      currentUserId: req.user?._id,
      orderedFor: req.body.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Get list of users the current user can place orders for
 * @route GET /order-context/permitted-targets
 * @access Private
 */
export const getPermittedOrderTargets = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Getting permitted order targets", {
      action: "getPermittedOrderTargets",
      currentUserId,
    });

    const permittedTargets = await orderPermissionService.getPermittedOrderTargets(
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: {
        permittedTargets,
        count: permittedTargets.length,
      },
      message: "Permitted order targets retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to get permitted order targets", {
      action: "getPermittedOrderTargets",
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Check if user can place order for specific user (quick check)
 * @route GET /order-context/can-order-for/:targetUserId
 * @access Private
 */
export const canOrderForUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const { targetUserId } = req.params;

    if (!targetUserId) {
      throw new AppError("Target user ID is required", 400, true, "TARGET_USER_ID_REQUIRED");
    }

    logger.info("Checking order permission for user", {
      action: "canOrderForUser",
      currentUserId,
      targetUserId,
    });

    const canOrder = await orderPermissionService.canOrderForUser(
      currentUserId,
      targetUserId
    );

    res.status(200).json({
      success: true,
      data: {
        canOrder,
        orderedBy: currentUserId,
        orderedFor: targetUserId,
      },
      message: canOrder 
        ? "User can place order for target" 
        : "User cannot place order for target",
    });
  } catch (error) {
    logger.error("Failed to check order permission for user", {
      action: "canOrderForUser",
      currentUserId: req.user?._id,
      targetUserId: req.params.targetUserId,
      error: (error as Error).message,
    });
    next(error);
  }
};
