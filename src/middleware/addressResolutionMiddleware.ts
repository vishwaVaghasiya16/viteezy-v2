/**
 * @fileoverview Address Resolution Middleware
 * @description Middleware for automatic address resolution and inheritance
 * @module middleware/addressResolutionMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { addressResolutionService } from "../services/addressResolutionService";
import { logger } from "../utils/logger";

// ============================================================================
// INTERFACES
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
  orderContext?: {
    orderedBy: string;
    orderedFor: string;
    relationshipType: "SELF" | "FAMILY";
  };
  resolvedAddress?: {
    addressId?: string;
    address: any;
    source: "SELF" | "INHERITED" | "MANUAL";
    inheritedFrom?: string;
    isManual: boolean;
  };
}

// ============================================================================
// ADDRESS RESOLUTION MIDDLEWARE
// ============================================================================

/**
 * Middleware to resolve shipping address with inheritance logic
 * This should be used before order creation endpoints
 */
export const resolveShippingAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    // Get order context from previous middleware or set defaults
    const orderedBy = req.orderContext?.orderedBy || currentUserId;
    const orderedFor = req.orderContext?.orderedFor || currentUserId;

    // Get manual address from request body (if provided)
    const manualAddress = req.body.manualAddress;

    // Get specific address ID from request body (if provided)
    const shippingAddressId = req.body.shippingAddressId;

    logger.info("Resolving shipping address", {
      orderedBy,
      orderedFor,
      shippingAddressId,
      hasManualAddress: !!manualAddress,
    });

    // Resolve address using the service
    const resolvedAddress = await addressResolutionService.resolveShippingAddress({
      orderedBy,
      orderedFor,
      shippingAddressId,
      manualAddress,
    });

    // Attach resolved address to request
    req.resolvedAddress = resolvedAddress;

    // Update request body with resolved address information
    if (resolvedAddress.addressId) {
      req.body.shippingAddressId = resolvedAddress.addressId;
    }

    // Add address source information to request body for tracking
    req.body.addressSource = resolvedAddress.source;
    req.body.addressInheritedFrom = resolvedAddress.inheritedFrom;
    req.body.addressIsManual = resolvedAddress.isManual;

    // Emit address resolved event
    try {
      const { familyEventEmitter, FAMILY_EVENTS } = await import("../utils/familyEvents");
      
      const addressResolvedEvent = {
        orderedBy,
        orderedFor,
        source: resolvedAddress.source,
        inheritedFrom: resolvedAddress.inheritedFrom,
        addressId: resolvedAddress.addressId,
        timestamp: new Date(),
      };

      familyEventEmitter.emit(FAMILY_EVENTS.ADDRESS_RESOLVED, addressResolvedEvent);
      
      logger.info("Address resolved event emitted", {
        orderedBy,
        orderedFor,
        source: resolvedAddress.source,
        inheritedFrom: resolvedAddress.inheritedFrom,
        addressId: resolvedAddress.addressId,
      });

    } catch (error) {
      logger.error("Failed to emit address resolved event", {
        orderedBy,
        orderedFor,
        error: (error as Error).message,
      });
      // Don't fail the address resolution if event emission fails
    }

    logger.info("Shipping address resolved successfully", {
      orderedBy,
      orderedFor,
      source: resolvedAddress.source,
      inheritedFrom: resolvedAddress.inheritedFrom,
      isManual: resolvedAddress.isManual,
    });

    next();

  } catch (error) {
    logger.error("Address resolution failed", {
      currentUserId: req.user?._id,
      orderedBy: req.orderContext?.orderedBy,
      orderedFor: req.orderContext?.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to validate manual address format
 */
export const validateManualAddress = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const manualAddress = req.body.manualAddress;

    if (!manualAddress) {
      // No manual address to validate
      next();
      return;
    }

    // Validate required fields for manual address
    const requiredFields = [
      'firstName',
      'lastName', 
      'streetName',
      'postalCode',
      'address',
      'country'
    ];

    for (const field of requiredFields) {
      if (!manualAddress[field] || typeof manualAddress[field] !== 'string' || manualAddress[field].trim() === '') {
        throw new AppError(
          `Manual address field '${field}' is required and must be a non-empty string`,
          400,
          true,
          "INVALID_MANUAL_ADDRESS"
        );
      }
    }

    // Validate postal code format (basic validation)
    const postalCode = manualAddress.postalCode.trim();
    if (postalCode.length < 3 || postalCode.length > 20) {
      throw new AppError(
        "Invalid postal code format",
        400,
        true,
        "INVALID_POSTAL_CODE"
      );
    }

    // Clean up manual address
    req.body.manualAddress = {
      firstName: manualAddress.firstName.trim(),
      lastName: manualAddress.lastName.trim(),
      streetName: manualAddress.streetName.trim(),
      houseNumber: manualAddress.houseNumber?.trim() || undefined,
      houseNumberAddition: manualAddress.houseNumberAddition?.trim() || undefined,
      postalCode: manualAddress.postalCode.trim(),
      address: manualAddress.address.trim(),
      phone: manualAddress.phone?.trim() || undefined,
      country: manualAddress.country.trim(),
      city: manualAddress.city?.trim() || undefined,
      note: manualAddress.note?.trim() || undefined,
    };

    logger.info("Manual address validated successfully", {
      orderedBy: req.orderContext?.orderedBy,
      orderedFor: req.orderContext?.orderedFor,
    });

    next();

  } catch (error) {
    logger.error("Manual address validation failed", {
      currentUserId: req.user?._id,
      error: (error as Error).message,
    });
    next(error);
  }
};

/**
 * Middleware to check if user can inherit addresses
 */
export const checkAddressInheritance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const currentUserId = req.user?._id;

    if (!currentUserId) {
      throw new AppError("User not authenticated", 401, true, "USER_NOT_AUTHENTICATED");
    }

    const orderedFor = req.orderContext?.orderedFor || currentUserId;

    // Check if user can inherit address
    const canInherit = await addressResolutionService.canInheritAddress(orderedFor);

    // Attach inheritance info to request
    req.body.canInheritAddress = canInherit;

    if (canInherit) {
      const inheritanceInfo = await addressResolutionService.getInheritanceInfo(orderedFor);
      req.body.addressInheritanceInfo = inheritanceInfo;
    }

    logger.info("Address inheritance check completed", {
      currentUserId,
      orderedFor,
      canInherit,
    });

    next();

  } catch (error) {
    logger.error("Address inheritance check failed", {
      currentUserId: req.user?._id,
      orderedFor: req.orderContext?.orderedFor,
      error: (error as Error).message,
    });
    next(error);
  }
};
