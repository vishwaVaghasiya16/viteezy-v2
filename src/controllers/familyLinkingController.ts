/**
 * @fileoverview Family Linking Controller
 * @description Controller for family management endpoints
 * @module controllers/familyLinkingController
 */

import { Request, Response, NextFunction } from "express";
import { familyLinkingService } from "../services/familyLinkingService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
  sessionId?: string;
}

// ============================================================================
// CONTROLLER METHODS
// ============================================================================

/**
 * Link current user to a family using member ID
 * @route POST /family/link
 * @access Private
 */
export const linkByMemberId = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { memberId, relationshipToParent } = req.body;
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Family linking request", {
      action: "linkByMemberId",
      memberId,
      currentUserId,
      relationshipToParent,
    });

    await familyLinkingService.linkByMemberId(
      memberId,
      currentUserId,
      relationshipToParent
    );

    res.status(200).json({
      success: true,
      message: "Successfully linked to family",
      data: {
        memberId,
        relationshipToParent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Link family members by IDs (admin endpoint)
 * @route POST /admin/family/link
 * @access Admin
 */
export const linkFamilyMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mainMemberId, subMemberId, relationshipToParent } = req.body;

    logger.info("Admin family linking request", {
      action: "linkFamilyMembers",
      mainMemberId,
      subMemberId,
      relationshipToParent,
    });

    await familyLinkingService.linkFamilyMember(
      mainMemberId,
      subMemberId,
      relationshipToParent
    );

    res.status(200).json({
      success: true,
      message: "Successfully linked family members",
      data: {
        mainMemberId,
        subMemberId,
        relationshipToParent,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlink family members
 * @route DELETE /admin/family/unlink
 * @access Admin
 */
export const unlinkFamilyMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mainMemberId, subMemberId } = req.body;

    logger.info("Family unlinking request", {
      action: "unlinkFamilyMembers",
      mainMemberId,
      subMemberId,
    });

    await familyLinkingService.unlinkFamilyMember(mainMemberId, subMemberId);

    res.status(200).json({
      success: true,
      message: "Successfully unlinked family members",
      data: {
        mainMemberId,
        subMemberId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get family members for a main member
 * @route GET /family/members/:mainMemberId
 * @access Private
 */
export const getFamilyMembers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mainMemberId } = req.params;
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Get family members request", {
      action: "getFamilyMembers",
      mainMemberId,
      currentUserId,
    });

    // Users can only view their own family members
    if (currentUserId !== mainMemberId) {
      throw new AppError("Access denied", 403, true, "ACCESS_DENIED");
    }

    const familyMembers = await familyLinkingService.getFamilyMembers(mainMemberId);

    res.status(200).json({
      success: true,
      message: "Family members retrieved successfully",
      data: familyMembers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get family information for current user
 * @route GET /family/info
 * @access Private
 */
export const getFamilyInfo = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Get family info request", {
      action: "getFamilyInfo",
      currentUserId,
    });

    const familyInfo = await familyLinkingService.getFamilyInfo(currentUserId);

    res.status(200).json({
      success: true,
      message: "Family information retrieved successfully",
      data: familyInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's family details
 * @route GET /family/me
 * @access Private
 */
export const getMyFamilyDetails = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Getting user family details", {
      action: "getMyFamilyDetails",
      currentUserId,
    });

    const familyDetails = await familyLinkingService.getFamilyDetails(currentUserId);

    res.status(200).json({
      success: true,
      data: familyDetails,
      message: "Family details retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to get user family details", {
      action: "getMyFamilyDetails",
      currentUserId: req.user?.id || req.userId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Get sub-members for a main member
 * @route GET /family/sub-members
 * @access Private
 */
export const getMySubMembers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("Getting sub-members", {
      action: "getMySubMembers",
      currentUserId,
    });

    const subMembers = await familyLinkingService.getSubMembers(currentUserId);

    res.status(200).json({
      success: true,
      data: subMembers,
      message: "Sub-members retrieved successfully",
    });
  } catch (error) {
    logger.error("Failed to get sub-members", {
      action: "getMySubMembers",
      currentUserId: req.user?.id || req.userId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Allow sub-member to leave family
 * @route POST /family/leave
 * @access Private
 */
export const leaveFamily = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.userId;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    logger.info("User leaving family", {
      action: "leaveFamily",
      currentUserId,
    });

    await familyLinkingService.leaveFamily(currentUserId);

    res.status(200).json({
      success: true,
      message: "Left family successfully",
    });
  } catch (error) {
    logger.error("Failed to leave family", {
      action: "leaveFamily",
      currentUserId: req.user?.id || req.userId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Allow main member to remove sub-member
 * @route DELETE /family/remove/:subMemberId
 * @access Private
 */
export const removeSubMember = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?.id || req.userId;
    const { subMemberId } = req.params;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    if (!subMemberId) {
      throw new AppError("Sub-member ID is required", 400, true, "MISSING_PARAMETERS");
    }

    logger.info("Main member removing sub-member", {
      action: "removeSubMember",
      currentUserId,
      subMemberId,
    });

    await familyLinkingService.removeSubMember(currentUserId, subMemberId);

    res.status(200).json({
      success: true,
      message: "Sub-member removed successfully",
    });
  } catch (error) {
    logger.error("Failed to remove sub-member", {
      action: "removeSubMember",
      currentUserId: req.user?.id || req.userId,
      subMemberId: req.params.subMemberId,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Get family members for admin (admin endpoint)
 * @route GET /admin/family/members/:mainMemberId
 * @access Admin
 */
export const getAdminFamilyMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { mainMemberId } = req.params;

    logger.info("Admin get family members request", {
      action: "getAdminFamilyMembers",
      mainMemberId,
    });

    const familyMembers = await familyLinkingService.getFamilyMembers(mainMemberId);

    res.status(200).json({
      success: true,
      message: "Family members retrieved successfully",
      data: familyMembers,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get family information for admin (admin endpoint)
 * @route GET /admin/family/info/:userId
 * @access Admin
 */
export const getAdminFamilyInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    logger.info("Admin get family info request", {
      action: "getAdminFamilyInfo",
      userId,
    });

    const familyInfo = await familyLinkingService.getFamilyInfo(userId);

    res.status(200).json({
      success: true,
      message: "Family information retrieved successfully",
      data: familyInfo,
    });
  } catch (error) {
    next(error);
  }
};
