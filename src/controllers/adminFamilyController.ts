import { Request, Response } from "express";
import { User } from "../models/core";
import { asyncHandler } from "../utils";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

// Define AuthenticatedRequest interface since it's not exported
interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
  sessionId?: string;
}

/**
 * Admin Family Controller
 * Handles admin operations for family management
 */
class AdminFamilyController {
  /**
   * Get all families with pagination
   * @route GET /api/v1/admin/families
   * @access Admin
   */
  getAllFamilies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      try {
        // Build filter for main members (users without parentId)
        const filter = {
          isSubMember: false,
          isActive: true,
          isDeleted: { $ne: true }
        };

        // Get total count for pagination metadata
        const total = await User.countDocuments(filter);

        // Find main members with database-level pagination
        const mainMembers = await User.find(filter)
          .select('_id firstName lastName email memberId isActive createdAt')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();

        // Get sub-members for only the paginated main members
        const families = await Promise.all(
          mainMembers.map(async (mainMember) => {
            const subMembers = await User.find({ 
              parentId: mainMember._id,
              isActive: true,
              isDeleted: { $ne: true }
            })
            .select('_id firstName lastName email relationshipToParent isActive')
            .lean();

            return {
              mainMember,
              subMembers,
              subMemberCount: subMembers.length
            };
          })
        );

        res.apiSuccess({
          families,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }, "Families retrieved successfully");

      } catch (error) {
        logger.error("Failed to get families", {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        throw new AppError("Failed to retrieve families", 500);
      }
    }
  );

  /**
   * Remove sub-member from family (Admin)
   * @route DELETE /api/v1/admin/families/:mainMemberId/sub-members/:subMemberId
   * @access Admin
   */
  removeSubMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { mainMemberId, subMemberId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(mainMemberId) || 
          !mongoose.Types.ObjectId.isValid(subMemberId)) {
        throw new AppError("Invalid user IDs", 400);
      }

      try {
        // Check if main member exists
        const mainMember = await User.findOne({ 
          _id: mainMemberId,
          isDeleted: { $ne: true }
        });
        
        if (!mainMember) {
          throw new AppError("Main member not found or was deleted", 404);
        }
        
        if (mainMember.parentId) {
          throw new AppError("The provided mainMemberId actually belongs to a sub-member", 400);
        }

        // Check if sub-member exists
        const subMember = await User.findOne({ 
          _id: subMemberId,
          isDeleted: { $ne: true }
        });
        
        if (!subMember) {
          throw new AppError("Sub-member not found or was deleted", 404);
        }

        // Verify relationship
        if (!subMember.parentId || subMember.parentId.toString() !== mainMemberId) {
          throw new AppError(`User ${subMemberId} is not a sub-member of ${mainMemberId}. Current parent: ${subMember.parentId || 'None'}`, 400);
        }

        // Remove sub-member from family
        await User.findByIdAndUpdate(subMemberId, {
          $unset: { parentId: 1, relationshipToParent: 1 }
        });

        // Clear sub-member's cart context
        const { cartService } = await import("../services/cartService");
        await cartService.clearCart(subMemberId);

        logger.info("Admin removed sub-member from family", {
          adminId: req.user?._id,
          mainMemberId,
          subMemberId,
          action: "ADMIN_REMOVE_SUB_MEMBER"
        });

        res.apiSuccess(null, "Sub-member removed successfully");

      } catch (error) {
        logger.error("Failed to remove sub-member", {
          error: (error as Error).message,
          mainMemberId,
          subMemberId,
          adminId: req.user?._id
        });
        throw new AppError("Failed to remove sub-member", 500);
      }
    }
  );

  /**
   * Enforce max sub-member limit across all families
   * @route POST /api/v1/admin/families/enforce-limits
   * @access Admin
   */
  enforceMaxLimits = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { action } = req.body;
      
      if (action !== "ENFORCE_MAX_LIMIT") {
        throw new AppError("Invalid action", 400);
      }

      const MAX_SUB_MEMBERS = 1;
      let familiesChecked = 0;
      let violationsFound = 0;
      let actionsTaken = 0;

      try {
        // Find all main members (even inactive ones)
        const mainMembers = await User.find({ 
          isSubMember: false,
          isDeleted: { $ne: true }
        }).select('_id').lean();

        familiesChecked = mainMembers.length;

        // Check each family for limit violations
        for (const mainMember of mainMembers) {
          const subMemberCount = await User.countDocuments({ 
            parentId: mainMember._id,
            isDeleted: { $ne: true }
          });

          if (subMemberCount > MAX_SUB_MEMBERS) {
            violationsFound++;
            
            // Remove excess sub-members (remove the most recent ones)
            const excessSubMembers = await User.find({ 
              parentId: mainMember._id,
              isDeleted: { $ne: true }
            })
            .sort({ createdAt: -1 })
            .limit(subMemberCount - MAX_SUB_MEMBERS)
            .select('_id')
            .lean();

            for (const subMember of excessSubMembers) {
              await User.findByIdAndUpdate(subMember._id, {
                $unset: { parentId: 1, relationshipToParent: 1 }
              });
              
              // Clear cart
              const { cartService } = await import("../services/cartService");
              await cartService.clearCart(subMember._id.toString());
              
              actionsTaken++;
            }
          }
        }

        logger.info("Admin enforced max sub-member limits", {
          adminId: req.user?._id,
          familiesChecked,
          violationsFound,
          actionsTaken,
          maxLimit: MAX_SUB_MEMBERS
        });

        res.apiSuccess({
          familiesChecked,
          violationsFound,
          actionsTaken,
          maxLimit: MAX_SUB_MEMBERS
        }, "Max limit enforcement completed");

      } catch (error) {
        logger.error("Failed to enforce max limits", {
          error: (error as Error).message,
          adminId: req.user?._id
        });
        throw new AppError("Failed to enforce max limits", 500);
      }
    }
  );

  /**
   * Detach member from family (Admin)
   * @route POST /api/v1/admin/families/detach
   * @access Admin
   */
  detachMember = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { userId, reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid user ID", 400);
      }

      if (!reason || reason.trim().length === 0) {
        throw new AppError("Reason is required", 400);
      }

      try {
        // Find the user
        const user = await User.findById(userId);
        if (!user) {
          throw new AppError("User not found", 404);
        }

        let previousFamily = null;

        if (user.parentId) {
          // User is a sub-member
          previousFamily = {
            mainMemberId: user.parentId,
            relationship: "SUB_MEMBER"
          };

          // Remove from family
          await User.findByIdAndUpdate(userId, {
            $unset: { parentId: 1, relationshipToParent: 1 }
          });

        } else {
          // User is a main member, dissolve the entire family
          const subMembers = await User.find({ 
            parentId: userId,
            isActive: true,
            isDeleted: { $ne: true }
          }).select('_id').lean();

          // Remove all sub-members
          await User.updateMany(
            { parentId: userId },
            { $unset: { parentId: 1, relationshipToParent: 1 } }
          );

          // Clear all sub-members' carts
          const { cartService } = await import("../services/cartService");
          for (const subMember of subMembers) {
            await cartService.clearCart(subMember._id.toString());
          }

          previousFamily = {
            mainMemberId: userId,
            relationship: "MAIN_MEMBER",
            subMembersDissolved: subMembers.length
          };
        }

        // Clear user's cart
        const { cartService } = await import("../services/cartService");
        await cartService.clearCart(userId);

        logger.info("Admin detached member from family", {
          adminId: req.user?._id,
          userId,
          reason,
          previousFamily,
          action: "ADMIN_DETACH_MEMBER"
        });

        res.apiSuccess({
          userId,
          previousFamily,
          reason
        }, "Member detached successfully");

      } catch (error) {
        logger.error("Failed to detach member", {
          error: (error as Error).message,
          userId,
          adminId: req.user?._id
        });
        throw new AppError("Failed to detach member", 500);
      }
    }
  );
}

export const adminFamilyController = new AdminFamilyController();
