import { User } from '../models/core/users.model';
import { AppError } from '../utils/AppError';

export interface FamilyValidationResult {
  allowed: boolean;
  reason?: string;
  relationshipType?: 'SELF' | 'MAIN_MEMBER' | 'SUB_MEMBER' | 'INDEPENDENT';
}

/**
 * Centralized family relationship validation
 * Enforces 1-level hierarchy and family permissions
 */
export const validateFamilyRelation = async (
  requesterId: string,
  targetUserId: string
): Promise<FamilyValidationResult> => {
  try {
    // Same user - always allowed
    if (requesterId === targetUserId) {
      return {
        allowed: true,
        relationshipType: 'SELF'
      };
    }

    // Get both users in parallel
    const [requester, target] = await Promise.all([
      User.findById(requesterId).select('parentId isActive isDeleted').lean(),
      User.findById(targetUserId).select('parentId isActive isDeleted').lean()
    ]);

    // Validate users exist
    if (!requester || !requester.isActive || requester.isDeleted) {
      return {
        allowed: false,
        reason: 'Requester not found or inactive'
      };
    }

    if (!target || !target.isActive || target.isDeleted) {
      return {
        allowed: false,
        reason: 'Target user not found or inactive'
      };
    }

    // Check if requester is main member and target is their sub-member
    if (target.parentId && target.parentId.toString() === requesterId) {
      return {
        allowed: true,
        relationshipType: 'MAIN_MEMBER'
      };
    }

    // Check if requester is sub-member
    if (requester.parentId) {
      // Sub-members can only order for themselves or their main member
      // They CANNOT order for other sub-members or anyone else
      return {
        allowed: false,
        reason: 'Sub-members can only place orders for themselves'
      };
    }

    // Check if target is a sub-member of the requester
    if (!requester.parentId && target.parentId && target.parentId.toString() === requesterId) {
      return {
        allowed: true,
        relationshipType: 'MAIN_MEMBER'
      };
    }

    // Independent users can only order for themselves
    return {
      allowed: false,
      reason: 'Users can only place orders within their family'
    };

  } catch (error) {
    throw new AppError('Family validation failed', 500);
  }
};

/**
 * Get user's family role
 */
export const getUserFamilyRole = async (userId: string): Promise<'MAIN_MEMBER' | 'SUB_MEMBER' | 'INDEPENDENT'> => {
  try {
    const user = await User.findById(userId).select('parentId').lean();
    
    if (!user) {
      return 'INDEPENDENT';
    }
    
    if (user.parentId) {
      return 'SUB_MEMBER';
    }
    
    const hasChildren = await User.exists({ parentId: userId });
    if (hasChildren) {
      return 'MAIN_MEMBER';
    }
    
    return 'INDEPENDENT';
  } catch (error) {
    return 'INDEPENDENT';
  }
};

/**
 * Validate if user can be linked as sub-member
 */
export const validateSubMemberLinking = async (
  mainMemberId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> => {
  try {
    // Check if target is already a sub-member
    const targetUser = await User.findById(targetUserId).select('parentId isActive isDeleted').lean();
    
    if (!targetUser || !targetUser.isActive || targetUser.isDeleted) {
      return {
        allowed: false,
        reason: 'Target user not found or inactive'
      };
    }

    if (targetUser.parentId) {
      return {
        allowed: false,
        reason: 'User is already a sub-member'
      };
    }

    // Check if target is a main member (has children)
    const hasChildren = await User.exists({ parentId: targetUserId });
    if (hasChildren) {
      return {
        allowed: false,
        reason: 'Cannot link a main member as sub-member (multi-level hierarchy not allowed)'
      };
    }

    // Check if main member exists and is not a sub-member
    const mainMember = await User.findById(mainMemberId).select('parentId isActive isDeleted').lean();
    
    if (!mainMember || !mainMember.isActive || mainMember.isDeleted) {
      return {
        allowed: false,
        reason: 'Main member not found or inactive'
      };
    }

    if (mainMember.parentId) {
      return {
        allowed: false,
        reason: 'Cannot link to a sub-member (multi-level hierarchy not allowed)'
      };
    }

    // Check max sub-member limit
    const currentSubMemberCount = await User.countDocuments({ 
      parentId: mainMemberId,
      isActive: true,
      isDeleted: { $ne: true }
    });

    const MAX_SUB_MEMBERS = 10; // Configurable limit
    if (currentSubMemberCount >= MAX_SUB_MEMBERS) {
      return {
        allowed: false,
        reason: `Maximum sub-members limit reached (${MAX_SUB_MEMBERS})`
      };
    }

    return {
      allowed: true
    };

  } catch (error) {
    throw new AppError('Sub-member linking validation failed', 500);
  }
};

// Legacy exports for backward compatibility
export const familyValidationService = {
  validateFamilyRelation,
  getUserFamilyRole,
  validateSubMemberLinking
};

export default {
  validateFamilyRelation,
  getUserFamilyRole,
  validateSubMemberLinking
};
