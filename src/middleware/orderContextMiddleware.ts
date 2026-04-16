/**
 * @fileoverview Order Context Middleware
 * @description Middleware for validating order permissions and attaching context
 * @module middleware/orderContextMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { orderPermissionService } from "../services/orderPermissionService";
import { logger } from "../utils/logger";

// ============================================================================
// INTERFACES
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
  orderContext?: {
    orderedBy: string;
    orderedFor: string;
    relationshipType: "SELF" | "FAMILY";
  };
  order?: any; // For existing orders (used in extractOrderContext)
}

// ============================================================================
// ORDER CONTEXT VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to validate order permissions and attach context to request
 * This should be used before order creation endpoints
 */
export const validateOrderContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // Get orderedFor from request body (optional - defaults to self)
    let orderedFor = req.body.orderedFor;

    // If orderedFor is not provided, default to self
    if (!orderedFor) {
      orderedFor = currentUserId;
    }

    // Validate order permission
    const permissionResult = await orderPermissionService.validateOrderPermission(
      currentUserId,
      orderedFor
    );

    if (!permissionResult.allowed) {
      throw new AppError(
        permissionResult.reason || "Order permission denied",
        403,
        true,
        "ORDER_PERMISSION_DENIED"
      );
    }

    // Build and attach order context
    const orderContext = await orderPermissionService.buildOrderContext(
      currentUserId,
      orderedFor
    );

    // Attach context to request for downstream use
    req.orderContext = orderContext;

    // Update request body with context fields for order creation
    req.body.orderedBy = orderContext.orderedBy;
    req.body.orderedFor = orderContext.orderedFor;
    req.body.relationshipType = orderContext.relationshipType;

    logger.info("Order context validated and attached", {
      orderedBy: orderContext.orderedBy,
      orderedFor: orderContext.orderedFor,
      relationshipType: orderContext.relationshipType,
    });

    next();

  } catch (error) {
    logger.error("Order context validation failed", {
      currentUserId: req.user?._id,
      orderedFor: req.body.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to validate orderedFor parameter for family orders
 * This is a stricter validation for endpoints that explicitly require orderedFor
 */
export const validateFamilyOrderContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const orderedFor = req.body.orderedFor;

    if (!orderedFor) {
      throw new AppError("orderedFor is required for family orders", 400, true, "ORDERED_FOR_REQUIRED");
    }

    // Validate that this is indeed a family order (not self)
    if (orderedFor === currentUserId) {
      throw new AppError("Family order must be for a different user", 400, true, "INVALID_FAMILY_ORDER");
    }

    // Validate order permission
    const permissionResult = await orderPermissionService.validateOrderPermission(
      currentUserId,
      orderedFor
    );

    if (!permissionResult.allowed) {
      throw new AppError(
        permissionResult.reason || "Family order permission denied",
        403,
        true,
        "FAMILY_ORDER_PERMISSION_DENIED"
      );
    }

    // Build and attach order context
    const orderContext = await orderPermissionService.buildOrderContext(
      currentUserId,
      orderedFor
    );

    // Attach context to request for downstream use
    req.orderContext = orderContext;

    // Update request body with context fields for order creation
    req.body.orderedBy = orderContext.orderedBy;
    req.body.orderedFor = orderContext.orderedFor;
    req.body.relationshipType = orderContext.relationshipType;

    logger.info("Family order context validated and attached", {
      orderedBy: orderContext.orderedBy,
      orderedFor: orderContext.orderedFor,
      relationshipType: orderContext.relationshipType,
    });

    next();

  } catch (error) {
    logger.error("Family order context validation failed", {
      currentUserId: req.user?._id,
      orderedFor: req.body.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to extract order context from existing order (for updates/retrieval)
 */
export const extractOrderContext = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // If order is already attached to request (from previous middleware)
    if (req.order && req.order.orderedBy && req.order.orderedFor) {
      req.orderContext = {
        orderedBy: req.order.orderedBy.toString(),
        orderedFor: req.order.orderedFor.toString(),
        relationshipType: req.order.relationshipType || "SELF",
      };

      logger.info("Order context extracted from existing order", {
        orderedBy: req.orderContext.orderedBy,
        orderedFor: req.orderContext.orderedFor,
        relationshipType: req.orderContext.relationshipType,
      });
    }

    next();

  } catch (error) {
    logger.error("Order context extraction failed", {
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};
