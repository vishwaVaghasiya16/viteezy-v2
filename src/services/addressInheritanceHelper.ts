/**
 * @fileoverview Address Inheritance Helper
 * @description Helper functions for automatic address inheritance for sub-members
 * @module services/addressInheritanceHelper
 */

import { AppError } from "../utils/AppError";
import { Addresses } from "../models/core";
import { User } from "../models/core";
import { addressResolutionService, getUserFamilyRole } from "./addressResolutionService";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

/**
 * Automatically inherit and create address for sub-member
 * This helps when sub-member places order for first time
 */
export const autoInheritAddressForSubMember = async (
  subMemberId: string
): Promise<{ success: boolean; addressId?: string; message?: string }> => {
  try {
    // Check if user is sub-member
    const userRole = await getUserFamilyRole(subMemberId);
    if (userRole !== "SUB_MEMBER") {
      return {
        success: false,
        message: "User is not a sub-member"
      };
    }

    // Check if sub-member already has addresses
    const existingAddresses = await addressResolutionService.getUserAddresses(subMemberId);
    if (existingAddresses.length > 0) {
      return {
        success: false,
        message: "Sub-member already has addresses"
      };
    }

    // Get main member info
    const subMember = await User.findById(subMemberId).select('parentId').lean();
    if (!subMember || !subMember.parentId) {
      return {
        success: false,
        message: "Sub-member has no main member"
      };
    }

    const mainMemberId = subMember.parentId.toString();

    // Get main member's addresses
    const mainMemberAddresses = await addressResolutionService.getUserAddresses(mainMemberId);
    if (mainMemberAddresses.length === 0) {
      return {
        success: false,
        message: "Main member has no addresses to inherit"
      };
    }

    // Find main member's default address, or use first available
    let addressToInherit = mainMemberAddresses.find(addr => addr.isDefault) || mainMemberAddresses[0];

    // Create copy of main member's address for sub-member
    const inheritedAddress = await Addresses.create({
      userId: new mongoose.Types.ObjectId(subMemberId),
      firstName: addressToInherit.firstName,
      lastName: addressToInherit.lastName,
      streetName: addressToInherit.streetName,
      houseNumber: addressToInherit.houseNumber,
      houseNumberAddition: addressToInherit.houseNumberAddition,
      postalCode: addressToInherit.postalCode,
      address: addressToInherit.address,
      city: addressToInherit.city,
      country: addressToInherit.country,
      phone: addressToInherit.phone,
      isDefault: true, // Set as default for sub-member
      metadata: {
        inheritedFrom: mainMemberId,
        inheritedAt: new Date(),
        source: "AUTO_INHERITANCE"
      }
    });

    const addressId = (inheritedAddress._id as mongoose.Types.ObjectId).toString();

    logger.info("Address automatically inherited for sub-member", {
      subMemberId,
      mainMemberId,
      newAddressId: inheritedAddress._id,
      originalAddressId: addressToInherit._id
    });

    return {
      success: true,
      addressId: addressId,
      message: "Address automatically inherited from main member"
    };

  } catch (error) {
    logger.error("Failed to auto-inherit address for sub-member", {
      subMemberId,
      error: (error as Error).message
    });
    return {
      success: false,
      message: "Failed to inherit address"
    };
  }
};

/**
 * Check and auto-inherit address if needed for sub-member
 * This can be called before order creation
 */
export const ensureSubMemberHasAddress = async (
  subMemberId: string
): Promise<{ hasAddress: boolean; autoInherited?: boolean; addressId?: string }> => {
  try {
    // Check if sub-member already has addresses
    const existingAddresses = await addressResolutionService.getUserAddresses(subMemberId);
    if (existingAddresses.length > 0) {
      return {
        hasAddress: true,
        addressId: existingAddresses.find(addr => addr.isDefault)?._id?.toString() || existingAddresses[0]._id.toString()
      };
    }

    // Try to auto-inherit
    const inheritResult = await autoInheritAddressForSubMember(subMemberId);
    
    return {
      hasAddress: inheritResult.success,
      autoInherited: inheritResult.success,
      addressId: inheritResult.addressId
    };

  } catch (error) {
    logger.error("Failed to ensure sub-member has address", {
      subMemberId,
      error: (error as Error).message
    });
    return {
      hasAddress: false
    };
  }
};
