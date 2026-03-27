/**
 * @fileoverview Commerce Context Service
 * @description Service for managing profile-based commerce context and validation
 * @module services/commerceContextService
 */

import { AppError } from "../utils/AppError";
import { orderPermissionService } from "./orderPermissionService";
import { getUserFamilyRole } from "./familyValidationService";
import { User } from "../models/core";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

// Cache functions (simplified - no-op for now)
const getCachedCommerceContext = (selectedBy: string): any => null;
const setCachedCommerceContext = (selectedBy: string, context: any) => {};
const invalidateUserCommerceContext = (selectedBy: string) => {};

// ============================================================================
// INTERFACES
// ============================================================================

export interface CommerceContext {
  selectedProfileId: string;
  selectedBy: string;
  isValid: boolean;
  relationshipType?: "SELF" | "FAMILY";
  createdAt: Date;
}

export interface ContextValidationResult {
  allowed: boolean;
  reason?: string;
  context?: CommerceContext;
}

export interface EffectiveProfileResult {
  profileId: string;
  profileData: any;
  relationshipType: "SELF" | "FAMILY";
  isValid: boolean;
}

// ============================================================================
// COMMERCE CONTEXT SERVICE
// ============================================================================

class CommerceContextService {
  /**
   * Validate commerce context (who is shopping for whom)
   * @param selectedBy - User ID doing the shopping
   * @param selectedProfileId - Profile ID being shopped for
   * @returns Promise<ContextValidationResult>
   */
  async validateContext(
    selectedBy: string,
    selectedProfileId: string
  ): Promise<ContextValidationResult> {
    const context = {
      action: "validateContext",
      selectedBy,
      selectedProfileId,
    };

    logger.info("Validating commerce context", context);

    try {
      // Validate input parameters
      if (!selectedBy || !selectedProfileId) {
        return {
          allowed: false,
          reason: "Both selectedBy and selectedProfileId are required",
        };
      }

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(selectedBy) || !mongoose.Types.ObjectId.isValid(selectedProfileId)) {
        return {
          allowed: false,
          reason: "Invalid user ID format",
        };
      }

      // Check if selected profile exists
      const profileExists = await this.checkProfileExists(selectedProfileId);
      if (!profileExists) {
        return {
          allowed: false,
          reason: "Selected profile does not exist",
        };
      }

      // Reuse order permission service for validation
      const permissionResult = await orderPermissionService.validateOrderPermission(
        selectedBy,
        selectedProfileId
      );

      if (!permissionResult.allowed) {
        return {
          allowed: false,
          reason: permissionResult.reason || "Permission denied for selected profile",
        };
      }

      // Determine relationship type
      const relationshipType = selectedBy === selectedProfileId ? "SELF" : "FAMILY";

      // Create commerce context
      const commerceContext: CommerceContext = {
        selectedProfileId,
        selectedBy,
        isValid: true,
        relationshipType,
        createdAt: new Date(),
      };

      logger.info("Commerce context validated successfully", {
        ...context,
        relationshipType,
      });

      return {
        allowed: true,
        context: commerceContext,
      };

    } catch (error) {
      logger.error("Commerce context validation failed", {
        ...context,
        error: (error as Error).message,
      });

      return {
        allowed: false,
        reason: "Context validation failed",
      };
    }
  }

  /**
   * Get effective profile with data
   * @param selectedBy - User ID doing the shopping
   * @param selectedProfileId - Profile ID being shopped for
   * @returns Promise<EffectiveProfileResult>
   */
  async getEffectiveProfile(
    selectedBy: string,
    selectedProfileId: string
  ): Promise<EffectiveProfileResult> {
    const context = {
      action: "getEffectiveProfile",
      selectedBy,
      selectedProfileId,
    };

    logger.info("Getting effective profile", context);

    try {
      // Validate context first
      const validation = await this.validateContext(selectedBy, selectedProfileId);
      if (!validation.allowed) {
        throw new AppError(
          validation.reason || "Invalid commerce context",
          403,
          true,
          "INVALID_COMMERCE_CONTEXT"
        );
      }

      // Get profile data
      const profileData = await this.getProfileData(selectedProfileId);
      if (!profileData) {
        throw new AppError(
          "Profile data not found",
          404,
          true,
          "PROFILE_NOT_FOUND"
        );
      }

      const relationshipType = selectedBy === selectedProfileId ? "SELF" : "FAMILY";

      logger.info("Effective profile retrieved successfully", {
        ...context,
        relationshipType,
        profileAge: profileData.age,
        profileGender: profileData.gender,
      });

      return {
        profileId: selectedProfileId,
        profileData,
        relationshipType,
        isValid: true,
      };

    } catch (error) {
      logger.error("Failed to get effective profile", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Set commerce context for user session
   * @param selectedBy - User ID doing the shopping
   * @param selectedProfileId - Profile ID being shopped for
   * @returns Promise<CommerceContext>
   */
  async setCommerceContext(
    selectedBy: string,
    selectedProfileId: string
  ): Promise<CommerceContext> {
    const context = {
      action: "setCommerceContext",
      selectedBy,
      selectedProfileId,
    };

    logger.info("Setting commerce context", context);

    try {
      // Validate context first
      const validation = await this.validateContext(selectedBy, selectedProfileId);
      if (!validation.allowed) {
        throw new AppError(
          validation.reason || "Cannot set commerce context",
          403,
          true,
          "INVALID_COMMERCE_CONTEXT"
        );
      }

      const commerceContext: CommerceContext = {
        selectedProfileId,
        selectedBy,
        isValid: true,
        relationshipType: selectedBy === selectedProfileId ? "SELF" : "FAMILY",
        createdAt: new Date(),
      };

      // Cache the context
      setCachedCommerceContext(selectedBy, commerceContext);

      logger.info("Commerce context set successfully", {
        ...context,
        relationshipType: commerceContext.relationshipType,
      });

      return commerceContext;

    } catch (error) {
      logger.error("Failed to set commerce context", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get current commerce context for user
   * @param selectedBy - User ID doing the shopping
   * @returns Promise<CommerceContext | null>
   */
  async getCurrentContext(selectedBy: string): Promise<CommerceContext | null> {
    try {
      // Try cache first
      const cachedContext = getCachedCommerceContext(selectedBy);
      if (cachedContext) {
        logger.info("Using cached commerce context", {
          selectedBy,
          selectedProfileId: cachedContext.selectedProfileId,
        });
        return cachedContext;
      }

      // No context found
      logger.info("No commerce context found", { selectedBy });
      return null;

    } catch (error) {
      logger.error("Failed to get current commerce context", {
        selectedBy,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Clear commerce context for user
   * @param selectedBy - User ID doing the shopping
   * @returns Promise<void>
   */
  async clearCommerceContext(selectedBy: string): Promise<void> {
    try {
      invalidateUserCommerceContext(selectedBy);
      logger.info("Commerce context cleared", { selectedBy });
    } catch (error) {
      logger.error("Failed to clear commerce context", {
        selectedBy,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Switch commerce context to a different profile
   * @param selectedBy - User ID doing the shopping
   * @param newProfileId - New profile ID to switch to
   * @returns Promise<CommerceContext>
   */
  async switchCommerceContext(
    selectedBy: string,
    newProfileId: string
  ): Promise<CommerceContext> {
    const context = {
      action: "switchCommerceContext",
      selectedBy,
      newProfileId,
    };

    logger.info("Switching commerce context", context);

    try {
      // Get current context for logging
      const currentContext = await this.getCurrentContext(selectedBy);

      // Validate and set new context
      const newContext = await this.setCommerceContext(selectedBy, newProfileId);

      logger.info("Commerce context switched successfully", {
        ...context,
        oldProfileId: currentContext?.selectedProfileId,
        newProfileId: newContext.selectedProfileId,
        relationshipType: newContext.relationshipType,
      });

      return newContext;

    } catch (error) {
      logger.error("Failed to switch commerce context", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get available profiles for user to shop for
   * @param selectedBy - User ID doing the shopping
   * @returns Promise<Array<{profileId: string, relationshipType: string, profileData: any}>>
   */
  async getAvailableProfiles(selectedBy: string): Promise<Array<{
    profileId: string;
    relationshipType: "SELF" | "FAMILY";
    profileData: any;
  }>> {
    const context = {
      action: "getAvailableProfiles",
      selectedBy,
    };

    logger.info("Getting available profiles", context);

    try {
      const profiles = [];

      // Always include self
      const selfProfile = await this.getProfileData(selectedBy);
      if (selfProfile) {
        profiles.push({
          profileId: selectedBy,
          relationshipType: "SELF" as const,
          profileData: selfProfile,
        });
      }

      // Get family members if main member
      const userRole = await getUserFamilyRole(selectedBy);
      if (userRole === "MAIN_MEMBER") {
        try {
          const subMembers = await User.find({ parentId: selectedBy })
            .select('_id firstName lastName email isActive')
            .lean();
          
          for (const subMember of subMembers) {
            const subMemberId = subMember._id.toString();
            const subMemberProfile = await this.getProfileData(subMemberId);
            
            if (subMemberProfile && subMember.isActive) {
              profiles.push({
                profileId: subMemberId,
                relationshipType: "FAMILY" as const,
                profileData: subMemberProfile,
              });
            }
          }

        } catch (error) {
          logger.error("Failed to get sub-members for available profiles", {
            ...context,
            error: (error as Error).message,
          });
        }
      }

      logger.info("Available profiles retrieved successfully", {
        ...context,
        profileCount: profiles.length,
      });

      return profiles;

    } catch (error) {
      logger.error("Failed to get available profiles", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Check if profile exists
   */
  private async checkProfileExists(profileId: string): Promise<boolean> {
    try {
      const user = await User.findById(profileId).select("_id").lean();
      return !!user;
    } catch (error) {
      logger.error("Failed to check profile existence", {
        profileId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get profile data for recommendations
   */
  private async getProfileData(profileId: string): Promise<any> {
    try {
      const user = await User.findById(profileId)
        .select("firstName lastName gender age email isActive")
        .lean();

      return user;
    } catch (error) {
      logger.error("Failed to get profile data", {
        profileId,
        error: (error as Error).message,
      });
      return null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const commerceContextService = new CommerceContextService();
