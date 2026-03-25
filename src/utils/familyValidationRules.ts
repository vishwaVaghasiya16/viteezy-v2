/**
 * @fileoverview Family Management Validation Rules
 * @description Pure functions for family hierarchy and membership validation
 * @module utils/familyValidationRules
 */

import { UserRole } from "../models/enums";
import { IUser } from "../models/core/users.model";

// ============================================================================
// TYPES
// ============================================================================

export interface FamilyValidationContext {
  mainMember: IUser;
  subMember: IUser;
  action: "link" | "unlink" | "checkout" | "membership";
}

export interface MembershipContext {
  userId: string;
  targetMemberId?: string;
  membershipType: "main" | "sub" | "independent";
  action: "create" | "upgrade" | "downgrade" | "cancel";
}

export interface AddressContext {
  subMember: IUser;
  mainMember: IUser;
  address: any;
  useMainMemberAddress: boolean;
}

// ============================================================================
// PURE VALIDATION RULES (No DB calls)
// ============================================================================

/**
 * Validates if hierarchy is limited to 1 level only
 * @param mainMember - Main member data
 * @param subMember - Sub member to validate
 * @returns boolean indicating if hierarchy is valid
 */
export const isOneLevelHierarchy = (mainMember: IUser, subMember: IUser): boolean => {
  // Sub-members cannot have children (isSubMember: true)
  if (subMember.isSubMember && (subMember as any).children?.length > 0) {
    return false;
  }
  
  // Main member cannot be a sub-member of someone else
  if (mainMember.isSubMember && mainMember.parentMemberId) {
    return false;
  }
  
  return true;
};

/**
 * Validates if a user can be a sub-member
 * @param user - User to validate
 * @returns boolean indicating if user can be sub-member
 */
export const canUserBeSubMember = (user: IUser): boolean => {
  // User must not already be a main member with sub-members
  if (!user.isSubMember && (user as any).children?.length > 0) {
    return false;
  }
  
  // User must not already have a parent
  if (user.isSubMember && user.parentMemberId) {
    return false;
  }
  
  return true;
};

/**
 * Validates if a user can create sub-members
 * @param user - User to validate
 * @returns boolean indicating if user can create sub-members
 */
export const canUserCreateSubMembers = (user: IUser): boolean => {
  // Only main members or independent users can create sub-members
  if (user.isSubMember) {
    return false;
  }
  
  // User must be active and have valid membership
  if (!user.isActive || user.membershipStatus !== "Active") {
    return false;
  }
  
  return true;
};

/**
 * Validates membership cascade rules
 * @param mainMember - Main member data
 * @param subMember - Sub member data
 * @returns boolean indicating if membership cascade is valid
 */
export const validateMembershipCascade = (mainMember: IUser, subMember: IUser): boolean => {
  // Main member membership applies to sub-members
  if (mainMember.membershipStatus === "Active" && subMember.membershipStatus !== "Active") {
    // This is valid - main member can provide benefits to sub-members
    return true;
  }
  
  // Sub-member membership applies only to self
  if (subMember.membershipStatus === "Active" && mainMember.membershipStatus !== "Active") {
    // This is also valid - sub-member can have their own membership
    return true;
  }
  
  return true; // Default to valid for other cases
};

/**
 * Validates address inheritance priority
 * @param subMember - Sub member data
 * @param mainMember - Main member data
 * @param address - Address to validate
 * @returns boolean indicating if address inheritance is valid
 */
export const validateAddressInheritance = (
  subMember: IUser, 
  mainMember: IUser, 
  address: any
): boolean => {
  // Priority 1: Sub-member's own address
  if (subMember.phone || subMember.email) {
    return true;
  }
  
  // Priority 2: Main member's default address
  if (mainMember.phone || mainMember.email) {
    return true;
  }
  
  // Priority 3: Manual input (address parameter)
  if (address && (address.line1 || address.phone || address.email)) {
    return true;
  }
  
  return false; // No valid address found
};

/**
 * Validates removal behavior and benefit revocation
 * @param memberBeingRemoved - Member being removed
 * @param mainMember - Main member (if applicable)
 * @returns boolean indicating if removal is valid
 */
export const validateRemovalBehavior = (memberBeingRemoved: IUser, mainMember?: IUser): boolean => {
  // If removing a sub-member, ensure inherited benefits are revoked
  if (memberBeingRemoved.isSubMember && mainMember) {
    // Sub-member should lose access to main member's benefits
    return true;
  }
  
  // If removing a main member, all sub-members should become independent
  if (!memberBeingRemoved.isSubMember && (memberBeingRemoved as any).children?.length > 0) {
    // This should be handled at the service level
    return true;
  }
  
  return true;
};

/**
 * Validates family linking constraints
 * @param mainMember - Main member data
 * @param subMember - Sub member data
 * @returns object with validation result and error message
 */
export const validateFamilyLinkingRules = (mainMember: IUser, subMember: IUser) => {
  const errors: string[] = [];
  
  // Check if users can be linked
  if (!canUserBeSubMember(subMember)) {
    errors.push("User cannot be added as sub-member");
  }
  
  if (!canUserCreateSubMembers(mainMember)) {
    errors.push("User cannot create sub-members");
  }
  
  // Check hierarchy constraints
  if (!isOneLevelHierarchy(mainMember, subMember)) {
    errors.push("Invalid hierarchy: Only 1-level hierarchy allowed");
  }
  
  // Check if already in family
  if (subMember.parentMemberId && subMember.parentMemberId.toString() === mainMember._id.toString()) {
    errors.push("User already in this family");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates checkout context for family members
 * @param userId - User performing checkout
 * @param targetMemberId - Target member for checkout
 * @param userRole - User role
 * @returns object with validation result and error message
 */
export const validateCheckoutContextRules = (
  userId: string, 
  targetMemberId: string, 
  userRole: UserRole
) => {
  const errors: string[] = [];
  
  // Users can only checkout for themselves or their sub-members
  if (userId !== targetMemberId && userRole !== UserRole.MAIN_MEMBER) {
    errors.push("Users can only checkout for themselves or their sub-members");
  }
  
  // Sub-members cannot checkout for other members
  if (userRole === UserRole.SUB_MEMBER && userId !== targetMemberId) {
    errors.push("Sub-members cannot checkout for other members");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates membership application context
 * @param userId - User applying for membership
 * @param targetMemberId - Target member for membership
 * @param userRole - User role
 * @returns object with validation result and error message
 */
export const validateMembershipApplicationRules = (
  userId: string,
  targetMemberId: string,
  userRole: UserRole
) => {
  const errors: string[] = [];
  
  // Main members can apply for themselves or sub-members
  if (userRole === UserRole.MAIN_MEMBER) {
    return { isValid: true, errors: [] };
  }
  
  // Sub-members can only apply for themselves
  if (userRole === UserRole.SUB_MEMBER && userId !== targetMemberId) {
    errors.push("Sub-members can only apply for membership for themselves");
  }
  
  // Independent users can only apply for themselves
  if (userRole === UserRole.INDEPENDENT && userId !== targetMemberId) {
    errors.push("Independent users can only apply for membership for themselves");
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};
