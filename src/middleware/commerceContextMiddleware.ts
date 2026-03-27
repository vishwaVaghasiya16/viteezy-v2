/**
 * @fileoverview Commerce Context Middleware
 * @description Middleware for managing profile-based commerce context
 * @module middleware/commerceContextMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { commerceContextService } from "../services/commerceContextService";
import { logger } from "../utils/logger";

// ============================================================================
// INTERFACES
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
  commerceContext?: {
    selectedProfileId: string;
    selectedBy: string;
    relationshipType: "SELF" | "FAMILY";
    isValid: boolean;
    createdAt: Date;
  };
}

// ============================================================================
// COMMERCE CONTEXT MIDDLEWARE
// ============================================================================

/**
 * Middleware to validate and set commerce context
 * This should be used for endpoints that need profile context
 */
export const validateCommerceContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // Get selectedProfileId from request body, query, or params
    let selectedProfileId = req.body.selectedProfileId || req.query.selectedProfileId || req.params.profileId;

    // If no profile ID provided, default to self
    if (!selectedProfileId) {
      selectedProfileId = currentUserId;
    }

    logger.info("Validating commerce context", {
      currentUserId,
      selectedProfileId,
      source: req.body.selectedProfileId ? 'body' : req.query.selectedProfileId ? 'query' : req.params.profileId ? 'params' : 'default',
    });

    // Validate commerce context
    const validation = await commerceContextService.validateContext(
      currentUserId,
      selectedProfileId
    );

    if (!validation.allowed) {
      throw new AppError(
        validation.reason || "Commerce context validation failed",
        403,
        true,
        "COMMERCE_CONTEXT_DENIED"
      );
    }

    if (!validation.context) {
      throw new AppError(
        "Commerce context not available",
        500,
        true,
        "COMMERCE_CONTEXT_UNAVAILABLE"
      );
    }

    // Attach context to request
    req.commerceContext = {
      selectedProfileId: validation.context.selectedProfileId,
      selectedBy: validation.context.selectedBy,
      relationshipType: validation.context.relationshipType || "SELF",
      isValid: validation.context.isValid,
      createdAt: validation.context.createdAt,
    };

    // Update request body with context information
    req.body.selectedProfileId = validation.context.selectedProfileId;
    req.body.selectedBy = validation.context.selectedBy;
    req.body.relationshipType = validation.context.relationshipType;

    logger.info("Commerce context validated and attached", {
      selectedBy: validation.context.selectedBy,
      selectedProfileId: validation.context.selectedProfileId,
      relationshipType: validation.context.relationshipType,
    });

    next();

  } catch (error) {
    logger.error("Commerce context validation failed", {
      currentUserId: req.user?._id,
      selectedProfileId: req.body.selectedProfileId || req.query.selectedProfileId || req.params.profileId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to ensure cart items belong to the same profile
 * This should be used for cart operations
 */
export const validateCartProfileConsistency = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // Get current commerce context
    const currentContext = await commerceContextService.getCurrentContext(currentUserId);

    if (!currentContext) {
      // No context set, this is allowed for new users
      logger.info("No commerce context found, allowing operation", {
        currentUserId,
      });
      next();
      return;
    }

    // For cart operations, we need to ensure consistency
    // This will be implemented in the cart service
    req.body.commerceContext = currentContext;

    logger.info("Cart profile consistency validated", {
      currentUserId,
      selectedProfileId: currentContext.selectedProfileId,
    });

    next();

  } catch (error) {
    logger.error("Cart profile consistency validation failed", {
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to set commerce context from request
 * This should be used when user explicitly switches profiles
 */
export const setCommerceContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const { selectedProfileId } = req.body;

    if (!selectedProfileId) {
      throw new AppError(
        "selectedProfileId is required",
        400,
        true,
        "SELECTED_PROFILE_ID_REQUIRED"
      );
    }

    logger.info("Setting commerce context", {
      currentUserId,
      selectedProfileId,
    });

    // Set commerce context
    const newContext = await commerceContextService.setCommerceContext(
      currentUserId,
      selectedProfileId
    );

    // Attach context to request
    req.commerceContext = {
      selectedProfileId: newContext.selectedProfileId,
      selectedBy: newContext.selectedBy,
      relationshipType: newContext.relationshipType || "SELF",
      isValid: newContext.isValid,
      createdAt: newContext.createdAt,
    };

    logger.info("Commerce context set successfully", {
      selectedBy: newContext.selectedBy,
      selectedProfileId: newContext.selectedProfileId,
      relationshipType: newContext.relationshipType,
    });

    next();

  } catch (error) {
    logger.error("Failed to set commerce context", {
      currentUserId: req.user?._id,
      selectedProfileId: req.body.selectedProfileId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to get current commerce context
 * This should be used for endpoints that need to know the current context
 */
export const getCurrentCommerceContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // Get current context
    const currentContext = await commerceContextService.getCurrentContext(currentUserId);

    if (currentContext) {
      req.commerceContext = {
        selectedProfileId: currentContext.selectedProfileId,
        selectedBy: currentContext.selectedBy,
        relationshipType: currentContext.relationshipType || "SELF",
        isValid: currentContext.isValid,
        createdAt: currentContext.createdAt,
      };
    }

    logger.info("Current commerce context retrieved", {
      currentUserId,
      hasContext: !!currentContext,
      selectedProfileId: currentContext?.selectedProfileId,
    });

    next();

  } catch (error) {
    logger.error("Failed to get current commerce context", {
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to clear commerce context
 * This should be used when user logs out or explicitly clears context
 */
export const clearCommerceContext = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Clearing commerce context", {
      currentUserId,
    });

    // Clear context
    await commerceContextService.clearCommerceContext(currentUserId);

    logger.info("Commerce context cleared successfully", {
      currentUserId,
    });

    next();

  } catch (error) {
    logger.error("Failed to clear commerce context", {
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};
