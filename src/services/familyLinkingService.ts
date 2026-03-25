/**
 * @fileoverview Family Linking Service
 * @description Service for managing family member relationships
 * @module services/familyLinkingService
 */

import { AppError } from "../utils/AppError";
import { User } from "../models/core";
import { FamilyMapping } from "../models/core/familyMapping.model";
import { UserRole } from "../models/enums";
import { familyValidationService } from "./familyValidationService";
import { logger } from "../utils/logger";
import { isValidMemberIdFormat, findUserByMemberId } from "../utils/memberIdGenerator";
import mongoose from "mongoose";
import {
  handleDuplicateKeyGracefully,
  createTransactionContext,
  logTransactionEvent,
  validateSession,
  safeAbortTransaction,
  safeCommitTransaction,
  enhanceErrorInfo
} from "../utils/familyLinkingSafety";
import {
  emitFamilyMemberLinked,
  emitFamilyMemberRemoved,
  emitFamilyMemberLeft,
} from "../utils/familyEvents";
import {
  getCachedFamilyDetails,
  setCachedFamilyDetails,
  getCachedSubMembers,
  setCachedSubMembers,
  getCachedUserRole,
  setCachedUserRole,
  invalidateUserCache,
  invalidateFamilyCache,
  FAMILY_CACHE_KEYS,
} from "../utils/familyCache";

// ============================================================================
// FAMILY LINKING SERVICE
// ============================================================================

class FamilyLinkingService {
  /**
   * Link a family member to a main member (Transaction-Safe)
   * @param mainMemberId - Main member ID
   * @param subMemberId - Sub-member ID
   * @param relationshipToParent - Relationship type (optional)
   * @throws AppError if linking fails
   */
  async linkFamilyMember(
    mainMemberId: string,
    subMemberId: string,
    relationshipToParent?: string
  ): Promise<void> {
    const context = createTransactionContext("linkFamilyMember", {
      mainMemberId,
      subMemberId,
      relationshipToParent,
    });

    logger.info("Family linking started", context);

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      validateSession(session);
      logTransactionEvent('started', context);

      // Step 1: Validate using existing validation layer
      await familyValidationService.validateFamilyLinking(mainMemberId, subMemberId);

      // Step 2: Check if mapping already exists (idempotency check)
      const existingMapping = await FamilyMapping.findOne({
        mainMemberId,
        subMemberId,
      }).session(session).lean();

      if (existingMapping) {
        logger.info("Idempotent request: Family mapping already exists", context);
        await safeAbortTransaction(session, context, "Idempotent request - mapping already exists");
        session.endSession();
        return; // Idempotent - no error, just return
      }

      // Step 3: Create family mapping within transaction
      await FamilyMapping.create([{
        mainMemberId,
        subMemberId,
        relationshipToParent,
        isActive: true, // Explicitly set as active
      }], { session });

      // Step 4: Update user roles and family fields within transaction
      await Promise.all([
        // Update main member
        User.findByIdAndUpdate(
          mainMemberId,
          {
            role: UserRole.MAIN_MEMBER,
            isSubMember: false,
            parentMemberId: null,
          },
          { new: true, session }
        ),
        // Update sub-member
        User.findByIdAndUpdate(
          subMemberId,
          {
            role: UserRole.SUB_MEMBER,
            isSubMember: true,
            parentMemberId: mainMemberId,
            relationshipToParent,
          },
          { new: true, session }
        ),
      ]);

      // Commit transaction
      await safeCommitTransaction(session, context);
      logger.info("Family linking completed successfully", context);

      // Emit events after successful transaction
      await emitFamilyMemberLinked({
        mainMemberId,
        subMemberId,
        relationshipToParent,
        actionBy: mainMemberId,
        timestamp: new Date(),
      });

      // Invalidate cache
      invalidateUserCache(mainMemberId);
      invalidateUserCache(subMemberId);

    } catch (error) {
      // Handle duplicate key errors gracefully (concurrency safety)
      if (handleDuplicateKeyGracefully(error, context)) {
        await safeAbortTransaction(session, context, "Duplicate key handled gracefully");
        session.endSession();
        return; // Idempotent - don't throw error for duplicates
      }

      // Rollback transaction on any error
      await safeAbortTransaction(session, context, "Error occurred during linking");
      
      // Enhanced error logging
      const enhancedError = enhanceErrorInfo(error, context);
      logger.error("Family linking failed", enhancedError);
      
      session.endSession();
      throw error;
    } finally {
      // Always end session
      session.endSession();
    }
  }

  /**
   * Link a family member using member ID
   * @param memberId - Main member's member ID (e.g., MEM-A9XK72QD)
   * @param currentUserId - Current user ID (becoming sub-member)
   * @param relationshipToParent - Relationship type (optional)
   * @throws AppError if linking fails
   */
  async linkByMemberId(
    memberId: string,
    currentUserId: string,
    relationshipToParent?: string
  ): Promise<void> {
    const context = createTransactionContext("linkByMemberId", {
      memberId,
      currentUserId,
      relationshipToParent,
    });

    logger.info("Family linking by member ID started", context);

    try {
      // Step 1: Validate member ID format
      if (!isValidMemberIdFormat(memberId)) {
        logger.error("Invalid member ID format", context);
        throw new AppError(
          "Invalid member ID format",
          400,
          true,
          "INVALID_MEMBER_ID_FORMAT"
        );
      }

      // Step 2: Find main member by member ID
      const mainMember = await findUserByMemberId(memberId);
      
      if (!mainMember) {
        logger.error("Main member not found", context);
        throw new AppError(
          "Member ID not found",
          404,
          true,
          "MAIN_MEMBER_NOT_FOUND"
        );
      }

      // Step 3: Link family members
      await this.linkFamilyMember(
        mainMember._id.toString(),
        currentUserId,
        relationshipToParent
      );

      logger.info("Family linking by member ID completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Family linking by member ID failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected family linking by member ID error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  /**
   * Unlink a family member (Transaction-Safe)
   * @param mainMemberId - Main member ID
   * @param subMemberId - Sub-member ID
   * @throws AppError if unlinking fails
   */
  async unlinkFamilyMember(mainMemberId: string, subMemberId: string): Promise<void> {
    const context = createTransactionContext("unlinkFamilyMember", {
      mainMemberId,
      subMemberId,
    });

    logger.info("Family unlinking started", context);

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      validateSession(session);
      logTransactionEvent('started', context);

      // Step 1: Find and delete family mapping within transaction
      const mapping = await FamilyMapping.findOneAndDelete({
        mainMemberId,
        subMemberId,
      }).session(session);

      if (!mapping) {
        logger.error("Family mapping not found", context);
        await safeAbortTransaction(session, context, "Family mapping not found");
        session.endSession();
        throw new AppError(
          "Family relationship not found",
          404,
          true,
          "FAMILY_MAPPING_NOT_FOUND"
        );
      }

      // Step 2: Update sub-member to independent within transaction
      await User.findByIdAndUpdate(
        subMemberId,
        {
          role: UserRole.INDEPENDENT,
          isSubMember: false,
          parentMemberId: null,
          relationshipToParent: null,
        },
        { new: true, session }
      );

      // Step 3: Check if main member still has sub-members within transaction
      const remainingSubMembers = await FamilyMapping.countDocuments({
        mainMemberId,
      }).session(session);

      if (remainingSubMembers === 0) {
        // No more sub-members, convert main member to independent
        await User.findByIdAndUpdate(
          mainMemberId,
          {
            role: UserRole.INDEPENDENT,
          },
          { new: true, session }
        );
      }

      // Commit transaction
      await safeCommitTransaction(session, context);
      logger.info("Family unlinking completed successfully", context);

    } catch (error) {
      // Rollback transaction on any error
      await safeAbortTransaction(session, context, "Error occurred during unlinking");
      
      // Enhanced error logging
      const enhancedError = enhanceErrorInfo(error, context);
      logger.error("Family unlinking failed", enhancedError);
      
      session.endSession();
      throw error;
    } finally {
      // Always end session
      session.endSession();
    }
  }

  /**
   * Get family members for a main member
   * @param mainMemberId - Main member ID
   * @returns Array of sub-members
   */
  async getFamilyMembers(mainMemberId: string): Promise<any[]> {
    const context = createTransactionContext("getFamilyMembers", {
      mainMemberId,
    });

    logger.info("Getting family members", context);

    try {
      const familyMappings = await FamilyMapping.find({
        mainMemberId,
      })
        .populate("subMemberId", "firstName lastName email memberId isSubMember role")
        .lean();

      logger.info("Family members retrieved successfully", { ...context, count: familyMappings.length });
      return familyMappings;
    } catch (error) {
      logger.error("Failed to get family members", { ...context, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get family information for a user
   * @param userId - User ID
   * @returns Family information
   */
  async getFamilyInfo(userId: string): Promise<any> {
    const context = createTransactionContext("getFamilyInfo", { userId });

    logger.info("Getting family information", context);

    try {
      // Check if user is a sub-member
      const user = await User.findById(userId).select("isSubMember parentMemberId").lean();
      
      if (!user) {
        throw new AppError("User not found", 404, true, "USER_NOT_FOUND");
      }

      if (user.isSubMember && user.parentMemberId) {
        // User is a sub-member, get main member info
        const mainMember = await User.findById(user.parentMemberId)
          .select("firstName lastName email memberId role")
          .lean();

        const siblings = await FamilyMapping.find({
          mainMemberId: user.parentMemberId,
          subMemberId: { $ne: userId },
        })
          .populate("subMemberId", "firstName lastName email memberId role")
          .lean();

        return {
          role: "SUB_MEMBER",
          mainMember,
          siblings,
        };
      } else {
        // Check if user is a main member
        const subMembers = await FamilyMapping.find({
          mainMemberId: userId,
        })
          .populate("subMemberId", "firstName lastName email memberId role")
          .lean();

        if (subMembers.length > 0) {
          return {
            role: "MAIN_MEMBER",
            subMembers,
            mainMember: null,
          };
        } else {
          return {
            role: "INDEPENDENT",
            subMembers: [],
            mainMember: null,
          };
        }
      }
    } catch (error) {
      logger.error("Failed to get family information", { ...context, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get user's family role based on family mappings (with caching)
   * @param userId - User ID to check
   * @returns Promise<string> - User's family role (MAIN_MEMBER, SUB_MEMBER, INDEPENDENT)
   */
  async getUserFamilyRole(userId: string): Promise<string> {
    const context = createTransactionContext("getUserFamilyRole", { userId });
    logger.info("Getting user family role", context);

    try {
      // Check cache first
      const cachedRole = getCachedUserRole(userId);
      if (cachedRole) {
        logger.info("User role retrieved from cache", context);
        return cachedRole;
      }

      // Check if user is a sub-member (only active mappings)
      const subMemberMapping = await FamilyMapping.findOne({
        subMemberId: userId,
        isActive: true,
      }).lean();

      if (subMemberMapping) {
        setCachedUserRole(userId, UserRole.SUB_MEMBER);
        return UserRole.SUB_MEMBER;
      }

      // Check if user has sub-members (only active mappings)
      const subMembersCount = await FamilyMapping.countDocuments({
        mainMemberId: userId,
        isActive: true,
      });

      if (subMembersCount > 0) {
        setCachedUserRole(userId, UserRole.MAIN_MEMBER);
        return UserRole.MAIN_MEMBER;
      }

      // User has no active family mappings
      setCachedUserRole(userId, UserRole.INDEPENDENT);
      return UserRole.INDEPENDENT;

    } catch (error) {
      logger.error("Failed to get user family role", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get all sub-members for a main member (with caching)
   * @param mainMemberId - Main member ID
   * @returns Promise<Array> - List of sub-members with user details
   */
  async getSubMembers(mainMemberId: string): Promise<any[]> {
    const context = createTransactionContext("getSubMembers", { mainMemberId });
    logger.info("Getting sub-members", context);

    try {
      // Check cache first
      const cachedSubMembers = getCachedSubMembers(mainMemberId);
      if (cachedSubMembers) {
        logger.info("Sub-members retrieved from cache", context);
        return cachedSubMembers;
      }

      const subMembers = await FamilyMapping.find({
        mainMemberId,
        isActive: true, // Only get active mappings
      })
        .populate("subMemberId", "firstName lastName email memberId role isSubMember")
        .lean();

      logger.info("Sub-members retrieved successfully", {
        ...context,
        count: subMembers.length,
      });

      const result = subMembers.map(mapping => ({
        _id: mapping._id,
        subMemberId: mapping.subMemberId._id,
        subMember: mapping.subMemberId,
        relationshipToParent: mapping.relationshipToParent,
        createdAt: mapping.createdAt,
      }));

      // Cache the result
      setCachedSubMembers(mainMemberId, result);

      return result;

    } catch (error) {
      logger.error("Failed to get sub-members", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get complete family details for a user (with caching)
   * @param userId - User ID
   * @returns Promise<object> - Family details based on user role
   */
  async getFamilyDetails(userId: string): Promise<any> {
    const context = createTransactionContext("getFamilyDetails", { userId });
    logger.info("Getting family details", context);

    try {
      // Check cache first
      const cachedDetails = getCachedFamilyDetails(userId);
      if (cachedDetails) {
        logger.info("Family details retrieved from cache", context);
        return cachedDetails;
      }

      const userRole = await this.getUserFamilyRole(userId);

      switch (userRole) {
        case UserRole.MAIN_MEMBER: {
          // Return all sub-members for main member
          const subMembers = await this.getSubMembers(userId);
          const result = {
            role: UserRole.MAIN_MEMBER,
            subMembers,
            mainMember: null,
          };

          // Cache the result
          setCachedFamilyDetails(userId, result);
          return result;
        }

        case UserRole.SUB_MEMBER: {
          // Return main member info for sub-member
          const mapping = await FamilyMapping.findOne({
            subMemberId: userId,
            isActive: true, // Only get active mappings
          })
            .populate("mainMemberId", "firstName lastName email memberId role")
            .lean();

          if (!mapping) {
            throw new AppError(
              "Family mapping not found",
              404,
              true,
              "FAMILY_MAPPING_NOT_FOUND"
            );
          }

          const result = {
            role: UserRole.SUB_MEMBER,
            subMembers: [],
            mainMember: mapping.mainMemberId,
            relationshipToParent: mapping.relationshipToParent,
          };

          // Cache the result
          setCachedFamilyDetails(userId, result);
          return result;
        }

        case UserRole.INDEPENDENT:
        default:
          // Return empty family structure for independent users
          const result = {
            role: UserRole.INDEPENDENT,
            subMembers: [],
            mainMember: null,
          };

          // Cache the result
          setCachedFamilyDetails(userId, result);
          return result;
      }

    } catch (error) {
      logger.error("Failed to get family details", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Allow sub-member to leave family (Transaction-Safe with Soft Delete & Events)
   * @param subMemberId - Sub-member ID
   * @returns Promise<void>
   */
  async leaveFamily(subMemberId: string): Promise<void> {
    const context = createTransactionContext("leaveFamily", { subMemberId });
    logger.info("Sub-member leaving family", context);

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      validateSession(session);
      logTransactionEvent('started', context);

      // Step 1: Validate user is a sub-member
      const userRole = await this.getUserFamilyRole(subMemberId);
      if (userRole !== UserRole.SUB_MEMBER) {
        logger.error("User is not a sub-member", context);
        await safeAbortTransaction(session, context, "User is not a sub-member");
        session.endSession();
        throw new AppError(
          "Only sub-members can leave family",
          400,
          true,
          "INVALID_USER_ROLE"
        );
      }

      // Step 2: Get active family mapping
      const mapping = await FamilyMapping.findOne({
        subMemberId,
        isActive: true, // Only get active mappings
      }).session(session);

      if (!mapping) {
        logger.error("Family mapping not found", context);
        await safeAbortTransaction(session, context, "Family mapping not found");
        session.endSession();
        throw new AppError(
          "Family mapping not found",
          404,
          true,
          "FAMILY_MAPPING_NOT_FOUND"
        );
      }

      // Step 3: Soft delete family mapping
      await FamilyMapping.updateOne(
        {
          subMemberId,
          isActive: true,
        },
        {
          isActive: false,
          removedAt: new Date(),
          removedBy: subMemberId,
        },
        { session }
      );

      // Step 4: Update user role to INDEPENDENT
      await User.findByIdAndUpdate(
        subMemberId,
        {
          role: UserRole.INDEPENDENT,
          isSubMember: false,
          parentMemberId: null,
          relationshipToParent: null,
        },
        { new: true, session }
      );

      // Step 5: Check if main member has no more active sub-members
      const remainingSubMembers = await FamilyMapping.countDocuments({
        mainMemberId: mapping.mainMemberId,
        isActive: true,
      }).session(session);

      if (remainingSubMembers === 0) {
        // Convert main member to independent
        await User.findByIdAndUpdate(
          mapping.mainMemberId,
          {
            role: UserRole.INDEPENDENT,
          },
          { new: true, session }
        );
      }

      // Commit transaction
      await safeCommitTransaction(session, context);
      logger.info("Sub-member left family successfully", context);

      // Emit events after successful transaction
      await emitFamilyMemberLeft({
        subMemberId,
        mainMemberId: mapping.mainMemberId.toString(),
        actionBy: subMemberId,
        timestamp: new Date(),
      });

      // Invalidate cache
      invalidateUserCache(subMemberId);
      invalidateUserCache(mapping.mainMemberId.toString());

    } catch (error) {
      // Handle duplicate key errors gracefully (idempotency)
      if (handleDuplicateKeyGracefully(error, context)) {
        await safeAbortTransaction(session, context, "Already independent");
        session.endSession();
        return; // Idempotent - already independent
      }

      // Rollback transaction on any error
      await safeAbortTransaction(session, context, "Error occurred during leave family");
      
      // Enhanced error logging
      const enhancedError = enhanceErrorInfo(error, context);
      logger.error("Sub-member leave family failed", enhancedError);
      
      session.endSession();
      throw error;
    } finally {
      // Always end session
      session.endSession();
    }
  }

  /**
   * Allow main member to remove sub-member (Transaction-Safe with Soft Delete & Events)
   * @param mainMemberId - Main member ID
   * @param subMemberId - Sub-member ID to remove
   * @returns Promise<void>
   */
  async removeSubMember(mainMemberId: string, subMemberId: string): Promise<void> {
    const context = createTransactionContext("removeSubMember", { mainMemberId, subMemberId });
    logger.info("Main member removing sub-member", context);

    // Start a MongoDB session for transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      validateSession(session);
      logTransactionEvent('started', context);

      // Step 1: Validate requester is main member
      const mainMemberRole = await this.getUserFamilyRole(mainMemberId);
      if (mainMemberRole !== UserRole.MAIN_MEMBER) {
        logger.error("User is not a main member", context);
        await safeAbortTransaction(session, context, "User is not a main member");
        session.endSession();
        throw new AppError(
          "Only main members can remove sub-members",
          403,
          true,
          "INSUFFICIENT_PERMISSIONS"
        );
      }

      // Step 2: Validate relationship exists (active mapping)
      const mapping = await FamilyMapping.findOne({
        mainMemberId,
        subMemberId,
        isActive: true, // Only get active mappings
      }).session(session);

      if (!mapping) {
        logger.error("Family relationship not found", context);
        await safeAbortTransaction(session, context, "Family relationship not found");
        session.endSession();
        throw new AppError(
          "Family relationship not found",
          404,
          true,
          "FAMILY_MAPPING_NOT_FOUND"
        );
      }

      // Step 3: Soft delete family mapping
      await FamilyMapping.updateOne(
        {
          mainMemberId,
          subMemberId,
          isActive: true,
        },
        {
          isActive: false,
          removedAt: new Date(),
          removedBy: mainMemberId,
        },
        { session }
      );

      // Step 4: Update sub-member role to INDEPENDENT
      await User.findByIdAndUpdate(
        subMemberId,
        {
          role: UserRole.INDEPENDENT,
          isSubMember: false,
          parentMemberId: null,
          relationshipToParent: null,
        },
        { new: true, session }
      );

      // Step 5: Check if main member still has active sub-members
      const remainingSubMembers = await FamilyMapping.countDocuments({
        mainMemberId,
        isActive: true,
      }).session(session);

      if (remainingSubMembers === 0) {
        // Convert main member to independent
        await User.findByIdAndUpdate(
          mainMemberId,
          {
            role: UserRole.INDEPENDENT,
          },
          { new: true, session }
        );
      }

      // Commit transaction
      await safeCommitTransaction(session, context);
      logger.info("Sub-member removed successfully", context);

      // Emit events after successful transaction
      await emitFamilyMemberRemoved({
        mainMemberId,
        subMemberId,
        actionBy: mainMemberId,
        timestamp: new Date(),
      });

      // Invalidate cache
      invalidateUserCache(subMemberId);
      invalidateUserCache(mainMemberId);

    } catch (error) {
      // Rollback transaction on any error
      await safeAbortTransaction(session, context, "Error occurred during remove sub-member");
      
      // Enhanced error logging
      const enhancedError = enhanceErrorInfo(error, context);
      logger.error("Remove sub-member failed", enhancedError);
      
      session.endSession();
      throw error;
    } finally {
      // Always end session
      session.endSession();
    }
  }
}

export const familyLinkingService = new FamilyLinkingService();
