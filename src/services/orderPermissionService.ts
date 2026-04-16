/**
 * @fileoverview Order Permission Service
 * @description Service for validating order permissions and tracking order context
 * @module services/orderPermissionService
 */

import { AppError } from "../utils/AppError";
import { getUserFamilyRole } from "./familyValidationService";
import { User } from "../models/core";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

// ============================================================================
// INTERFACES
// ============================================================================

export interface OrderContext {
  orderedBy: string; // Who placed the order
  orderedFor: string; // Whose profile the order is for
  relationshipType: "SELF" | "FAMILY";
  isValid: boolean;
  reason?: string; // For invalid permissions
}

export interface OrderPermissionResult {
  allowed: boolean;
  reason?: string;
  context?: OrderContext;
}

export enum OrderRelationshipType {
  SELF = "SELF",
  FAMILY = "FAMILY",
}

// ============================================================================
// ORDER PERMISSION SERVICE
// ============================================================================

class OrderPermissionService {
  /**
   * Validate if a user can place an order for another user
   * @param orderedBy - User ID placing the order
   * @param orderedFor - User ID the order is for
   * @returns Promise<OrderPermissionResult>
   */
  async validateOrderPermission(
    orderedBy: string,
    orderedFor: string
  ): Promise<OrderPermissionResult> {
    const context = {
      action: "validateOrderPermission",
      orderedBy,
      orderedFor,
    };

    logger.info("Validating order permission", context);

    try {
      // Validate input parameters
      if (!orderedBy || !orderedFor) {
        return {
          allowed: false,
          reason: "Both orderedBy and orderedFor are required",
        };
      }

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(orderedBy) || !mongoose.Types.ObjectId.isValid(orderedFor)) {
        return {
          allowed: false,
          reason: "Invalid user ID format",
        };
      }

      // Case 1: User ordering for themselves (always allowed)
      if (orderedBy === orderedFor) {
        const orderContext: OrderContext = {
          orderedBy,
          orderedFor,
          relationshipType: OrderRelationshipType.SELF,
          isValid: true,
        };

        logger.info("Self-order permission granted", context);
        return {
          allowed: true,
          context: orderContext,
        };
      }

      // Case 2: User ordering for someone else (validate family relationship)
      return await this.validateFamilyOrderPermission(orderedBy, orderedFor, context);

    } catch (error) {
      logger.error("Order permission validation failed", {
        ...context,
        error: (error as Error).message,
      });

      return {
        allowed: false,
        reason: "Permission validation failed",
      };
    }
  }

  /**
   * Build order context for valid permissions
   * @param orderedBy - User ID placing the order
   * @param orderedFor - User ID the order is for
   * @returns Promise<OrderContext>
   */
  async buildOrderContext(orderedBy: string, orderedFor: string): Promise<OrderContext> {
    const context = {
      action: "buildOrderContext",
      orderedBy,
      orderedFor,
    };

    logger.info("Building order context", context);

    try {
      // Validate permission first
      const permissionResult = await this.validateOrderPermission(orderedBy, orderedFor);

      if (!permissionResult.allowed) {
        throw new AppError(
          permissionResult.reason || "Order permission denied",
          403,
          true,
          "ORDER_PERMISSION_DENIED"
        );
      }

      if (!permissionResult.context) {
        throw new AppError("Order context not available", 500, true, "ORDER_CONTEXT_ERROR");
      }

      logger.info("Order context built successfully", {
        ...context,
        relationshipType: permissionResult.context.relationshipType,
      });

      return permissionResult.context;

    } catch (error) {
      logger.error("Failed to build order context", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get order context without validation (for existing orders)
   * @param orderedBy - User ID placing the order
   * @param orderedFor - User ID the order is for
   * @returns OrderContext
   */
  getOrderContext(orderedBy: string, orderedFor: string): OrderContext {
    const relationshipType = orderedBy === orderedFor 
      ? OrderRelationshipType.SELF 
      : OrderRelationshipType.FAMILY;

    return {
      orderedBy,
      orderedFor,
      relationshipType,
      isValid: true,
    };
  }

  /**
   * Check if user can place orders for specific family member
   * @param userId - User ID checking permissions
   * @param targetUserId - Target user ID
   * @returns Promise<boolean>
   */
  async canOrderForUser(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const result = await this.validateOrderPermission(userId, targetUserId);
      return result.allowed;
    } catch (error) {
      logger.error("Failed to check order permission", {
        userId,
        targetUserId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get list of users a main member can place orders for
   * @param mainMemberId - Main member ID
   * @returns Promise<string[]> - Array of user IDs
   */
  async getPermittedOrderTargets(mainMemberId: string): Promise<string[]> {
    const context = {
      action: "getPermittedOrderTargets",
      mainMemberId,
    };

    logger.info("Getting permitted order targets", context);

    try {
      // Always include self
      const permittedUsers = [mainMemberId];

      // Get user's family role
      const userRole = await getUserFamilyRole(mainMemberId);

      // If main member, add all linked sub-members
      if (userRole === "MAIN_MEMBER") {
        try {
          const subMembers = await User.find({ parentId: mainMemberId })
            .select('_id')
            .lean();
          
          for (const subMember of subMembers) {
            permittedUsers.push(subMember._id.toString());
          }

          logger.info("Found permitted order targets for main member", {
            ...context,
            permittedCount: permittedUsers.length,
            subMemberCount: subMembers.length,
          });

        } catch (error) {
          logger.error("Failed to get sub-members for order targets", {
            ...context,
            error: (error as Error).message,
          });
          // Continue with just self if sub-member fetch fails
        }
      }

      return permittedUsers;

    } catch (error) {
      logger.error("Failed to get permitted order targets", {
        ...context,
        error: (error as Error).message,
      });
      
      // Always return self as fallback
      return [mainMemberId];
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate family order permissions
   */
  private async validateFamilyOrderPermission(
    orderedBy: string,
    orderedFor: string,
    context: any
  ): Promise<OrderPermissionResult> {
    try {
      // Get the role of the user placing the order
      const orderedByRole = await this.getUserRoleWithCache(orderedBy);

      // Case 2a: Main Member ordering for sub-member
      if (orderedByRole === "MAIN_MEMBER") {
        return await this.validateMainMemberOrdering(orderedBy, orderedFor, context);
      }

      // Case 2b: Sub-Member ordering for someone else
      if (orderedByRole === "SUB_MEMBER") {
        return {
          allowed: false,
          reason: "Sub-members can only place orders for themselves",
        };
      }

      // Case 2c: Independent user ordering for someone else
      if (orderedByRole === "INDEPENDENT") {
        return {
          allowed: false,
          reason: "Independent users can only place orders for themselves",
        };
      }

      // Default case: Unknown role
      return {
        allowed: false,
        reason: "Unable to determine user role for permission validation",
      };

    } catch (error) {
      logger.error("Family order permission validation failed", {
        ...context,
        error: (error as Error).message,
      });

      return {
        allowed: false,
        reason: "Failed to validate family order permission",
      };
    }
  }

  /**
   * Validate main member ordering for sub-member
   */
  private async validateMainMemberOrdering(
    mainMemberId: string,
    orderedFor: string,
    context: any
  ): Promise<OrderPermissionResult> {
    try {
      // Check if orderedFor is a linked sub-member
      const subMembers = await User.find({ parentId: mainMemberId })
        .select('_id isActive')
        .lean();
      
      const isLinkedSubMember = subMembers.some(
        subMember => subMember._id.toString() === orderedFor
      );

      if (!isLinkedSubMember) {
        return {
          allowed: false,
          reason: "Main member can only place orders for linked sub-members",
        };
      }

      // Validate that the sub-member is active
      const targetSubMember = subMembers.find(
        subMember => subMember._id.toString() === orderedFor
      );

      if (!targetSubMember || !targetSubMember.isActive) {
        return {
          allowed: false,
          reason: "Sub-member is not active or has been removed",
        };
      }

      const orderContext: OrderContext = {
        orderedBy: mainMemberId,
        orderedFor,
        relationshipType: OrderRelationshipType.FAMILY,
        isValid: true,
      };

      logger.info("Main member ordering for sub-member allowed", {
        ...context,
        subMemberId: orderedFor,
      });

      return {
        allowed: true,
        context: orderContext,
      };

    } catch (error) {
      logger.error("Main member order validation failed", {
        ...context,
        error: (error as Error).message,
      });

      return {
        allowed: false,
        reason: "Failed to validate main member order permission",
      };
    }
  }

  /**
   * Get user role with caching
   */
  private async getUserRoleWithCache(userId: string): Promise<string> {
    try {
      // Fetch user role directly
      const userRole = await getUserFamilyRole(userId);
      return userRole;

    } catch (error) {
      logger.error("Failed to get user role with cache", {
        userId,
        error: (error as Error).message,
      });
      
      // Return INDEPENDENT as safe default
      return "INDEPENDENT";
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const orderPermissionService = new OrderPermissionService();
