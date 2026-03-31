/**
 * @fileoverview Address Resolution Service
 * @description Service for automatic address inheritance and resolution logic
 * @module services/addressResolutionService
 */

import { AppError } from "../utils/AppError";
import { Addresses } from "../models/core";
import { getUserFamilyRole } from "./familyValidationService";
import { orderPermissionService } from "./orderPermissionService";
import { logger } from "../utils/logger";
import { User } from "../models/core";
import mongoose from "mongoose";

// Export getUserFamilyRole for other services
export { getUserFamilyRole };

// Cache functions (simplified - no-op for now)
const getCachedUserAddresses = (userId: string) => null;
const setCachedUserAddresses = (userId: string, addresses: any) => {};
const getCachedDefaultAddress = (userId: string) => null;
const setCachedDefaultAddress = (userId: string, address: any) => {};
const invalidateUserAddressCache = (userId: string) => {};

// ============================================================================
// INTERFACES
// ============================================================================

export interface ManualAddress {
  firstName: string;
  lastName: string;
  streetName: string;
  houseNumber?: string;
  houseNumberAddition?: string;
  postalCode: string;
  address: string;
  phone?: string;
  country: string;
  city?: string;
  note?: string;
}

export interface ResolvedAddressResult {
  addressId?: string;
  address: any; // IAddress document
  source: "SELF" | "INHERITED" | "MANUAL";
  inheritedFrom?: string;
  isManual: boolean;
}

export interface AddressResolutionOptions {
  orderedBy: string;
  orderedFor: string;
  shippingAddressId?: string;
  manualAddress?: ManualAddress;
  includeInactive?: boolean;
}

// ============================================================================
// ADDRESS RESOLUTION SERVICE
// ============================================================================

class AddressResolutionService {
  /**
   * Resolve shipping address with inheritance logic
   * @param options - Address resolution options
   * @returns Promise<ResolvedAddressResult>
   */
  async resolveShippingAddress(
    options: AddressResolutionOptions
  ): Promise<ResolvedAddressResult> {
    const { orderedBy, orderedFor, shippingAddressId, manualAddress } = options;
    
    const context = {
      action: "resolveShippingAddress",
      orderedBy,
      orderedFor,
      shippingAddressId,
      hasManualAddress: !!manualAddress,
    };

    logger.info("Resolving shipping address", context);

    try {
      // Validate order permission first
      const hasPermission = await orderPermissionService.canOrderForUser(orderedBy, orderedFor);
      if (!hasPermission) {
        throw new AppError(
          "User does not have permission to place order for target user",
          403,
          true,
          "ORDER_PERMISSION_DENIED"
        );
      }

      // STEP 1: Manual address has highest priority
      if (manualAddress) {
        logger.info("Using manual address", context);
        return {
          address: manualAddress,
          source: "MANUAL",
          isManual: true,
        };
      }

      // STEP 2: Try specific address ID if provided
      if (shippingAddressId) {
        const specificAddress = await this.resolveSpecificAddressId(
          orderedFor,
          shippingAddressId,
          context
        );
        if (specificAddress) {
          return specificAddress;
        }
      }

      // STEP 3: Try user's own default address
      const userDefaultAddress = await this.getUserDefaultAddress(orderedFor);
      if (userDefaultAddress) {
        logger.info("Using user's default address", context);
        return {
          addressId: userDefaultAddress._id.toString(),
          address: userDefaultAddress,
          source: "SELF",
          isManual: false,
        };
      }

      // STEP 4: Try inheritance from main member (for sub-members)
      const inheritedAddress = await this.getInheritedAddress(orderedFor);
      if (inheritedAddress) {
        logger.info("Using inherited address from main member", context);
        return {
          addressId: inheritedAddress.address._id.toString(),
          address: inheritedAddress.address,
          source: "INHERITED",
          inheritedFrom: inheritedAddress.mainMemberId,
          isManual: false,
        };
      }

      // STEP 5: No address found - provide helpful error message
      const userRole = await getUserFamilyRole(orderedFor);
      let errorMessage = "No shipping address found. Please add an address or provide one during checkout.";
      
      if (userRole === "SUB_MEMBER") {
        // Check if main member has any addresses
        const user = await User.findById(orderedFor).select('parentId').lean();
        if (user && user.parentId) {
          const mainMemberAddresses = await this.getUserAddresses(user.parentId.toString());
          if (mainMemberAddresses.length === 0) {
            errorMessage = "No shipping address found. Sub-member cannot inherit address because main member has no addresses. Please add an address for the main member or provide a manual address during checkout.";
          } else {
            errorMessage = "No shipping address found. Sub-member has no addresses and main member has no default address set. Please set a default address for the main member or provide a manual address during checkout.";
          }
        }
      }
      
      throw new AppError(
        errorMessage,
        404,
        true,
        "ADDRESS_NOT_FOUND"
      );

    } catch (error) {
      logger.error("Failed to resolve shipping address", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get all addresses for a user
   * @param userId - User ID
   * @param includeInactive - Include inactive/soft-deleted addresses
   * @returns Promise<any[]>
   */
  async getUserAddresses(
    userId: string,
    includeInactive = false
  ): Promise<any[]> {
    const context = {
      action: "getUserAddresses",
      userId,
      includeInactive,
    };

    logger.info("Getting user addresses", context);

    try {
      // Try cache first
      const cachedAddresses = getCachedUserAddresses(userId);
      if (cachedAddresses && !includeInactive) {
        logger.info("Using cached user addresses", context);
        return cachedAddresses;
      }

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
      };

      if (!includeInactive) {
        query.isDeleted = false;
      }

      // Fetch addresses
      const addresses = await Addresses.find(query)
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();

      // Cache active addresses
      if (!includeInactive) {
        setCachedUserAddresses(userId, addresses);
      }

      logger.info("User addresses retrieved successfully", {
        ...context,
        count: addresses.length,
      });

      return addresses;

    } catch (error) {
      logger.error("Failed to get user addresses", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get default address for a user
   * @param userId - User ID
   * @returns Promise<any>
   */
  async getDefaultAddress(userId: string): Promise<any> {
    const context = {
      action: "getDefaultAddress",
      userId,
    };

    logger.info("Getting default address", context);

    try {
      // Try cache first
      const cachedDefault = getCachedDefaultAddress(userId);
      if (cachedDefault) {
        logger.info("Using cached default address", context);
        return cachedDefault;
      }

      // Fetch default address
      const defaultAddress = await Addresses.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      }).lean();

      // Cache result
      if (defaultAddress) {
        setCachedDefaultAddress(userId, defaultAddress);
      }

      logger.info("Default address retrieved successfully", {
        ...context,
        found: !!defaultAddress,
      });

      return defaultAddress;

    } catch (error) {
      logger.error("Failed to get default address", {
        ...context,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Check if user can inherit address from main member
   * @param userId - User ID to check
   * @returns Promise<boolean>
   */
  async canInheritAddress(userId: string): Promise<boolean> {
    try {
      const inheritedAddress = await this.getInheritedAddress(userId);
      return !!inheritedAddress;
    } catch (error) {
      logger.error("Failed to check address inheritance", {
        userId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get inheritance info for a user
   * @param userId - User ID
   * @returns Promise<{mainMemberId: string, address: any} | null>
   */
  async getInheritanceInfo(userId: string): Promise<{ mainMemberId: string; address: any } | null> {
    return await this.getInheritedAddress(userId);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Resolve specific address ID with validation
   */
  private async resolveSpecificAddressId(
    userId: string,
    addressId: string,
    context: any
  ): Promise<ResolvedAddressResult | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        logger.warn("Invalid address ID format", { ...context, addressId });
        return null;
      }

      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(addressId),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!address) {
        logger.warn("Address not found", { ...context, addressId });
        return null;
      }

      logger.info("Using specific address ID", { ...context, addressId });
      return {
        addressId: address._id.toString(),
        address,
        source: "SELF",
        isManual: false,
      };

    } catch (error) {
      logger.error("Failed to resolve specific address ID", {
        ...context,
        addressId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get user's default address (private method)
   */
  private async getUserDefaultAddress(userId: string): Promise<any> {
    try {
      // Try cache first
      const cachedDefault = getCachedDefaultAddress(userId);
      if (cachedDefault) {
        return cachedDefault;
      }

      // Fetch from database
      const defaultAddress = await Addresses.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDefault: true,
        isDeleted: false,
      }).lean();

      // Cache result
      if (defaultAddress) {
        setCachedDefaultAddress(userId, defaultAddress);
      }

      return defaultAddress;

    } catch (error) {
      logger.error("Failed to get user default address", {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get inherited address from main member
   */
  private async getInheritedAddress(
    userId: string
  ): Promise<{ mainMemberId: string; address: any } | null> {
    try {
      // Get user's family role
      const userRole = await getUserFamilyRole(userId);

      // Only sub-members can inherit addresses
      if (userRole !== "SUB_MEMBER") {
        return null;
      }

      // Get user to find main member
      const user = await User.findById(userId).select('parentId').lean();
      if (!user || !user.parentId) {
        return null;
      }

      const mainMemberId = user.parentId.toString();

      // Get main member's default address first
      const mainMemberDefaultAddress = await this.getUserDefaultAddress(mainMemberId);
      if (mainMemberDefaultAddress) {
        return {
          mainMemberId,
          address: mainMemberDefaultAddress,
        };
      }

      // If no default address, get any address of main member
      const mainMemberAddresses = await this.getUserAddresses(mainMemberId);
      if (mainMemberAddresses.length > 0) {
        logger.info("Using main member's first available address (no default set)", {
          userId,
          mainMemberId,
          addressCount: mainMemberAddresses.length,
        });
        return {
          mainMemberId,
          address: mainMemberAddresses[0], // Use first available address
        };
      }

      logger.info("Main member has no addresses at all", {
        userId,
        mainMemberId,
      });
      return null;

    } catch (error) {
      logger.error("Failed to get inherited address", {
        userId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Invalidate address cache for user
   */
  private invalidateAddressCache(userId: string): void {
    try {
      invalidateUserAddressCache(userId);
      logger.info("Address cache invalidated", { userId });
    } catch (error) {
      logger.error("Failed to invalidate address cache", {
        userId,
        error: (error as Error).message,
      });
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const addressResolutionService = new AddressResolutionService();
