/**
 * @fileoverview Family Management Validation Service
 * @description Service layer for family validation with database operations
 * @module services/familyValidationService
 */

import { AppError } from "../utils/AppError";
import { User } from "../models/core";
import { UserRole } from "../models/enums";
import { logger } from "../utils/logger";
import {
  FamilyValidationContext,
  MembershipContext,
  AddressContext,
  validateFamilyLinkingRules,
  validateCheckoutContextRules,
  validateMembershipApplicationRules,
  isOneLevelHierarchy,
  canUserBeSubMember,
  canUserCreateSubMembers,
  validateMembershipCascade,
  validateAddressInheritance,
  validateRemovalBehavior,
} from "../utils/familyValidationRules";

// ============================================================================
// ERROR TYPES
// ============================================================================

export const FAMILY_VALIDATION_ERRORS = {
  INVALID_HIERARCHY: "INVALID_HIERARCHY",
  SUB_MEMBER_CANNOT_ADD: "SUB_MEMBER_CANNOT_ADD",
  INVALID_MEMBERSHIP_CASCADE: "INVALID_MEMBERSHIP_CASCADE",
  ADDRESS_INHERITANCE_VIOLATION: "ADDRESS_INHERITANCE_VIOLATION",
  USER_ALREADY_IN_FAMILY: "USER_ALREADY_IN_FAMILY",
  INVALID_CHECKOUT_CONTEXT: "INVALID_CHECKOUT_CONTEXT",
  INVALID_MEMBERSHIP_APPLICATION: "INVALID_MEMBERSHIP_APPLICATION",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
} as const;

// ============================================================================
// VALIDATION SERVICE
// ============================================================================

class FamilyValidationService {
  /**
   * Validates family linking between main member and sub-member
   * @param mainMemberId - Main member ID
   * @param subMemberId - Sub-member ID
   * @throws AppError if validation fails
   */
  async validateFamilyLinking(mainMemberId: string, subMemberId: string): Promise<void> {
    const context = {
      action: "validateFamilyLinking",
      mainMemberId,
      subMemberId,
    };

    logger.info("Family validation started", context);

    try {
      // Edge case: Prevent self-linking
      if (mainMemberId === subMemberId) {
        logger.error("Validation failed: self-linking attempt", context);
        throw new AppError(
          "Users cannot link to themselves",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
        );
      }

      // Fetch users from database
      const [mainMember, subMember] = await Promise.all([
        User.findById(mainMemberId).lean(),
        User.findById(subMemberId).lean(),
      ]);

      if (!mainMember) {
        logger.error("Validation failed: main member not found", context);
        throw new AppError(
          "Main member not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
        );
      }

      if (!subMember) {
        logger.error("Validation failed: sub-member not found", context);
        throw new AppError(
          "Sub-member not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
        );
      }

      // Edge case: Prevent main member from becoming sub-member
      if (mainMember.isSubMember) {
        logger.error("Validation failed: main member is already a sub-member", context);
        throw new AppError(
          "Main member cannot be a sub-member",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
        );
      }

      // Edge case: Prevent sub-member from already belonging to another family
      if (subMember.isSubMember && subMember.parentMemberId) {
        logger.error("Validation failed: sub-member already belongs to family", context);
        throw new AppError(
          "Sub-member already belongs to another family",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.USER_ALREADY_IN_FAMILY
        );
      }

      // Edge case: Prevent circular relationships
      if (subMember.parentMemberId && subMember.parentMemberId.toString() === mainMemberId) {
        logger.error("Validation failed: users already linked", context);
        throw new AppError(
          "Users are already linked",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.USER_ALREADY_IN_FAMILY
        );
      }

      // Apply validation rules
      const validation = validateFamilyLinkingRules(mainMember, subMember);
      
      if (!validation.isValid) {
        logger.error("Validation failed: rule violations", { ...context, errors: validation.errors });
        throw new AppError(
          validation.errors.join("; "),
          400,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
        );
      }

      // Additional database validations
      await this.validateFamilyLinkingConstraints(mainMember, subMember);

      logger.info("Family validation completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Validation failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected validation error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  /**
   * Validates checkout context for family members
   * @param userId - User performing checkout
   * @param targetMemberId - Target member for checkout
   * @throws AppError if validation fails
   */
  async validateCheckoutContext(userId: string, targetMemberId: string): Promise<void> {
    const context = {
      action: "validateCheckoutContext",
      userId,
      targetMemberId,
    };

    logger.info("Checkout validation started", context);

    try {
      // Edge case: Prevent self-checkout validation when not needed
      if (userId === targetMemberId) {
        logger.info("Self-checkout detected, validation bypassed", context);
        return;
      }

      // Fetch user from database
      const user = await User.findById(userId).lean();
      
      if (!user) {
        logger.error("Validation failed: user not found", context);
        throw new AppError(
          "User not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_CHECKOUT_CONTEXT
        );
      }

      // Determine user role based on family structure
      const userRole = this.determineUserRole(user);

      // Apply validation rules
      const validation = validateCheckoutContextRules(userId, targetMemberId, userRole);
      
      if (!validation.isValid) {
        logger.error("Validation failed: rule violations", { ...context, errors: validation.errors });
        throw new AppError(
          validation.errors.join("; "),
          403,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_CHECKOUT_CONTEXT
        );
      }

      // Additional checkout validations
      await this.validateCheckoutPermissions(user, targetMemberId);

      logger.info("Checkout validation completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Validation failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected validation error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  /**
   * Validates membership application context
   * @param userId - User applying for membership
   * @param targetMemberId - Target member for membership
   * @throws AppError if validation fails
   */
  async validateMembershipApplication(userId: string, targetMemberId: string): Promise<void> {
    const context = {
      action: "validateMembershipApplication",
      userId,
      targetMemberId,
    };

    logger.info("Membership validation started", context);

    try {
      // Edge case: Prevent self-application validation when not needed
      if (userId === targetMemberId) {
        logger.info("Self-application detected, basic validation only", context);
      }

      // Fetch user from database
      const user = await User.findById(userId).lean();
      
      if (!user) {
        logger.error("Validation failed: user not found", context);
        throw new AppError(
          "User not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_APPLICATION
        );
      }

      // Determine user role based on family structure
      const userRole = this.determineUserRole(user);

      // Apply validation rules
      const validation = validateMembershipApplicationRules(userId, targetMemberId, userRole);
      
      if (!validation.isValid) {
        logger.error("Validation failed: rule violations", { ...context, errors: validation.errors });
        throw new AppError(
          validation.errors.join("; "),
          403,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_APPLICATION
        );
      }

      // Additional membership validations
      await this.validateMembershipEligibility(user, targetMemberId);

      logger.info("Membership validation completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Validation failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected validation error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  /**
   * Validates admin actions on family members
   * @param actionType - Type of admin action
   * @param payload - Action payload
   * @throws AppError if validation fails
   */
  async validateAdminAction(actionType: string, payload: any): Promise<void> {
    const context = {
      action: "validateAdminAction",
      actionType,
      payloadKeys: Object.keys(payload),
    };

    logger.info("Admin validation started", context);

    try {
      switch (actionType) {
        case "LINK_FAMILY_MEMBERS":
          await this.validateFamilyLinking(payload.mainMemberId, payload.subMemberId);
          break;
        
        case "UNLINK_FAMILY_MEMBERS":
          await this.validateFamilyUnlinking(payload.mainMemberId, payload.subMemberId);
          break;
        
        case "UPDATE_FAMILY_HIERARCHY":
          await this.validateHierarchyUpdate(payload);
          break;
        
        default:
          logger.error("Validation failed: invalid admin action", { ...context, actionType });
          throw new AppError(
            "Invalid admin action type",
            400,
            true,
            FAMILY_VALIDATION_ERRORS.INSUFFICIENT_PERMISSIONS
          );
      }

      logger.info("Admin validation completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Admin validation failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected admin validation error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  /**
   * Validates address inheritance for sub-members
   * @param subMemberId - Sub-member ID
   * @param address - Address to validate
   * @param useMainMemberAddress - Whether to use main member's address
   * @throws AppError if validation fails
   */
  async validateAddressInheritanceContext(
    subMemberId: string,
    address: any,
    useMainMemberAddress: boolean = false
  ): Promise<void> {
    const context = {
      action: "validateAddressInheritanceContext",
      subMemberId,
      useMainMemberAddress,
      hasAddress: !!address,
    };

    logger.info("Address inheritance validation started", context);

    try {
      // Fetch sub-member from database
      const subMember = await User.findById(subMemberId).lean();
      
      if (!subMember) {
        logger.error("Validation failed: sub-member not found", context);
        throw new AppError(
          "Sub-member not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.ADDRESS_INHERITANCE_VIOLATION
        );
      }

      if (!subMember.isSubMember || !subMember.parentMemberId) {
        logger.error("Validation failed: user is not a sub-member", context);
        throw new AppError(
          "User is not a sub-member",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.ADDRESS_INHERITANCE_VIOLATION
        );
      }

      // Fetch main member
      const mainMember = await User.findById(subMember.parentMemberId).lean();
      
      if (!mainMember) {
        logger.error("Validation failed: main member not found", context);
        throw new AppError(
          "Main member not found",
          404,
          true,
          FAMILY_VALIDATION_ERRORS.ADDRESS_INHERITANCE_VIOLATION
        );
      }

      // Apply address inheritance validation
      const isValid = validateAddressInheritance(subMember, mainMember, address);
      
      if (!isValid) {
        logger.error("Validation failed: no valid address found", context);
        throw new AppError(
          "Invalid address inheritance: No valid address found",
          400,
          true,
          FAMILY_VALIDATION_ERRORS.ADDRESS_INHERITANCE_VIOLATION
        );
      }

      logger.info("Address inheritance validation completed successfully", context);
    } catch (error) {
      if (error instanceof AppError) {
        logger.error("Validation failed", { ...context, error: error.message, errorType: error.errorType });
      } else {
        logger.error("Unexpected validation error", { ...context, error: (error as Error).message });
      }
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Determines user role based on family structure
   * @param user - User data
   * @returns UserRole
   */
  private determineUserRole(user: any): UserRole {
    if (user.isSubMember) {
      return UserRole.SUB_MEMBER;
    }
    
    // For now, assume independent since we can't make async calls here
    // In a real implementation, this might need to be refactored
    // to pass the sub-member count as a parameter
    return UserRole.INDEPENDENT;
  }

  /**
   * Validates additional family linking constraints from database
   * @param mainMember - Main member data
   * @param subMember - Sub-member data
   */
  private async validateFamilyLinkingConstraints(mainMember: any, subMember: any): Promise<void> {
    // Check if main member has reached maximum sub-members (if applicable)
    const subMemberCount = await User.countDocuments({
      parentMemberId: mainMember._id,
      isSubMember: true,
      isDeleted: { $ne: true },
    });

    // Example: Maximum 10 sub-members per main member (configurable)
    const MAX_SUB_MEMBERS = 10;
    if (subMemberCount >= MAX_SUB_MEMBERS) {
      throw new AppError(
        `Maximum sub-members limit reached (${MAX_SUB_MEMBERS})`,
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
      );
    }

    // Check if sub-member has any active subscriptions that might conflict
    if (subMember.membershipStatus === "Active") {
      throw new AppError(
        "User with active membership cannot be added as sub-member",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_CASCADE
      );
    }
  }

  /**
   * Validates checkout permissions
   * @param user - User performing checkout
   * @param targetMemberId - Target member ID
   */
  private async validateCheckoutPermissions(user: any, targetMemberId: string): Promise<void> {
    // If user is checking out for someone else, validate relationship
    if (user._id.toString() !== targetMemberId) {
      const targetMember = await User.findById(targetMemberId).lean();
      
      if (!targetMember) {
        throw new AppError("Target member not found", 404, true, FAMILY_VALIDATION_ERRORS.INVALID_CHECKOUT_CONTEXT);
      }

      // Validate that target member is actually a sub-member of the user
      if (!targetMember.isSubMember || targetMember.parentMemberId?.toString() !== user._id.toString()) {
        throw new AppError(
          "Cannot checkout for non-family member",
          403,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_CHECKOUT_CONTEXT
        );
      }
    }
  }

  /**
   * Validates membership eligibility
   * @param user - User applying for membership
   * @param targetMemberId - Target member ID
   */
  private async validateMembershipEligibility(user: any, targetMemberId: string): Promise<void> {
    // Check if user already has active membership
    if (user.membershipStatus === "Active") {
      throw new AppError(
        "User already has active membership",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_APPLICATION
      );
    }

    // If applying for sub-member, validate relationship
    if (user._id.toString() !== targetMemberId) {
      const targetMember = await User.findById(targetMemberId).lean();
      
      if (!targetMember) {
        throw new AppError("Target member not found", 404, true, FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_APPLICATION);
      }

      // Validate that target member is actually a sub-member of the user
      if (!targetMember.isSubMember || targetMember.parentMemberId?.toString() !== user._id.toString()) {
        throw new AppError(
          "Cannot apply membership for non-family member",
          403,
          true,
          FAMILY_VALIDATION_ERRORS.INVALID_MEMBERSHIP_APPLICATION
        );
      }
    }
  }

  /**
   * Validates family unlinking
   * @param mainMemberId - Main member ID
   * @param subMemberId - Sub-member ID
   */
  private async validateFamilyUnlinking(mainMemberId: string, subMemberId: string): Promise<void> {
    const [mainMember, subMember] = await Promise.all([
      User.findById(mainMemberId).lean(),
      User.findById(subMemberId).lean(),
    ]);

    if (!mainMember || !subMember) {
      throw new AppError("Member not found", 404, true, FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY);
    }

    // Validate that sub-member belongs to main member
    if (!subMember.isSubMember || subMember.parentMemberId?.toString() !== mainMemberId) {
      throw new AppError(
        "Sub-member does not belong to this main member",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
      );
    }

    // Validate removal behavior
    const isValidRemoval = validateRemovalBehavior(subMember, mainMember);
    if (!isValidRemoval) {
      throw new AppError(
        "Invalid removal behavior",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
      );
    }
  }

  /**
   * Validates hierarchy update
   * @param payload - Update payload
   */
  private async validateHierarchyUpdate(payload: any): Promise<void> {
    const { userId, newHierarchyData } = payload;
    
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError("User not found", 404, true, FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY);
    }

    // Validate hierarchy constraints
    if (newHierarchyData.isSubMember && !canUserBeSubMember(user)) {
      throw new AppError(
        "User cannot be converted to sub-member",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
      );
    }

    if (!newHierarchyData.isSubMember && !canUserCreateSubMembers(user)) {
      throw new AppError(
        "User cannot be converted to main member",
        400,
        true,
        FAMILY_VALIDATION_ERRORS.INVALID_HIERARCHY
      );
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const familyValidationService = new FamilyValidationService();
export default FamilyValidationService;
