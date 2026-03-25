/**
 * @fileoverview Family Validation Middleware
 * @description Express middleware for family management validation
 * @module middleware/familyValidation
 */

import { Request, Response, NextFunction } from "express";
import { familyValidationService } from "../services/familyValidationService";
import { AppError } from "../utils/AppError";

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Middleware to validate family linking before API execution
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateFamilyLinking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mainMemberId, subMemberId } = req.body;
    
    if (!mainMemberId || !subMemberId) {
      throw new AppError("mainMemberId and subMemberId are required", 400, true, "MISSING_PARAMETERS");
    }
    
    await familyValidationService.validateFamilyLinking(mainMemberId, subMemberId);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate checkout context before order creation
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateCheckoutContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = (req as any).user?._id || (req as any).userId;
    
    if (!userId) {
      throw new AppError("User authentication required", 401, true, "AUTHENTICATION_REQUIRED");
    }
    
    // Get target member ID from request body or params
    const targetMemberId = req.body.targetMemberId || req.params.memberId || userId.toString();
    
    await familyValidationService.validateCheckoutContext(userId.toString(), targetMemberId);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate membership application
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateMembershipApplication = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get user ID from authenticated request
    const userId = (req as any).user?._id || (req as any).userId;
    
    if (!userId) {
      throw new AppError("User authentication required", 401, true, "AUTHENTICATION_REQUIRED");
    }
    
    // Get target member ID from request body or params
    const targetMemberId = req.body.targetMemberId || req.params.memberId || userId.toString();
    
    await familyValidationService.validateMembershipApplication(userId.toString(), targetMemberId);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to validate admin actions on family members
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateAdminAction = (actionType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Verify admin permissions
      const user = (req as any).user;
      
      if (!user || (user.role !== "Admin" && user.role !== "ADMIN")) {
        throw new AppError("Admin permissions required", 403, true, "INSUFFICIENT_PERMISSIONS");
      }
      
      // Validate admin action
      await familyValidationService.validateAdminAction(actionType, {
        ...req.body,
        ...req.params,
      });
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to validate address inheritance for sub-members
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const validateAddressInheritance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { subMemberId, address, useMainMemberAddress } = req.body;
    
    if (!subMemberId) {
      throw new AppError("subMemberId is required", 400, true, "MISSING_PARAMETERS");
    }
    
    await familyValidationService.validateAddressInheritanceContext(
      subMemberId,
      address,
      useMainMemberAddress
    );
    
    next();
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract family validation context from request
 * @param req - Express request object
 * @returns Family validation context
 */
export const extractFamilyContext = (req: Request) => {
  const user = (req as any).user;
  const userId = user?._id || (req as any).userId;
  
  return {
    userId: userId?.toString(),
    userRole: user?.role,
    isSubMember: user?.isSubMember,
    parentMemberId: user?.parentMemberId?.toString(),
  };
};

/**
 * Check if user can perform family-related actions
 * @param req - Express request object
 * @returns boolean indicating if user can perform family actions
 */
export const canUserPerformFamilyActions = (req: Request): boolean => {
  const context = extractFamilyContext(req);
  
  // Admins can always perform family actions
  if (context.userRole === "Admin" || context.userRole === "ADMIN") {
    return true;
  }
  
  // Main members can perform family actions
  if (!context.isSubMember) {
    return true;
  }
  
  // Sub-members have limited permissions
  return false;
};
