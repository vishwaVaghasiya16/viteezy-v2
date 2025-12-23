/**
 * @fileoverview Address Controller
 * @description Controller for address-related operations
 * @module controllers/addressController
 */

import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Addresses, IAddress } from "@/models/core/addresses.model";
import mongoose from "mongoose";
import {
  postNLService,
  PostNLNormalizedAddress,
} from "@/services/postNLService";
import { logger } from "@/utils/logger";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

// PostNL supported countries: Netherlands, Belgium, Luxembourg
const POSTNL_SUPPORTED_COUNTRIES = new Set([
  // Netherlands
  "nl",
  "netherlands",
  "the netherlands",
  "nederland",
  // Belgium
  "be",
  "belgium",
  "belgië",
  "belgique",
  // Luxembourg
  "lu",
  "luxembourg",
  "lëtzebuerg",
]);

const shouldValidateWithPostNL = (country?: string): boolean => {
  if (!country) {
    return false;
  }

  return POSTNL_SUPPORTED_COUNTRIES.has(country.trim().toLowerCase());
};

const buildAddressLineFromNormalized = (
  normalized?: PostNLNormalizedAddress
): string | undefined => {
  if (!normalized?.street || !normalized?.houseNumber) {
    return undefined;
  }

  const addition = normalized.houseNumberAddition
    ? ` ${normalized.houseNumberAddition}`
    : "";

  return `${normalized.street} ${normalized.houseNumber}${addition}`;
};

const extractHouseNumberFromLine = (line?: string): string | undefined => {
  if (!line) {
    return undefined;
  }

  const match = line.match(/(\d{1,5})/);
  return match?.[1];
};

const extractAdditionFromLine = (line?: string): string | undefined => {
  if (!line) {
    return undefined;
  }

  const match = line.match(/\d{1,5}\s*([a-zA-Z]{1,2})$/);
  return match?.[1];
};

class AddressController {
  /**
   * Add new address for authenticated user
   * @route POST /api/addresses
   * @access Private
   */
  addAddress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        firstName,
        lastName,
        streetName,
        houseNumber,
        houseNumberAddition,
        postalCode,
        address,
        phone,
        country,
        city,
        isDefault,
        note,
      } = req.body;

      // Country-specific validation
      await this.validateAddressByCountry({
        country,
        postalCode,
        houseNumber,
        streetName,
        city,
      });

      // Validate with PostNL for NL, BE, and LU addresses
      const validationOutcome = await this.validateDutchAddressOrRespond({
        country,
        postcode: postalCode,
        houseNumber,
        houseNumberAddition,
      });

      const normalizedAddress = validationOutcome.normalized;
      const cityToSave = normalizedAddress?.city || city;
      const postalCodeToSave = normalizedAddress?.postcode || postalCode;
      const streetNameToSave = normalizedAddress?.street || streetName;
      const houseNumberToSave =
        normalizedAddress?.houseNumber ??
        (houseNumber !== undefined && houseNumber !== null
          ? String(houseNumber)
          : undefined);
      const additionToSave =
        normalizedAddress?.houseNumberAddition ?? houseNumberAddition;

      // Build full address string
      const addressParts = [
        streetNameToSave,
        houseNumberToSave,
        additionToSave,
      ].filter(Boolean);
      const fullAddress = addressParts.join(" ") || address;

      // If setting as default, unset other default addresses for this user
      if (isDefault === true) {
        await Addresses.updateMany(
          {
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: false,
          },
          { $set: { isDefault: false } }
        );
      }

      // Create new address
      const createdAddress = await Addresses.create({
        userId: new mongoose.Types.ObjectId(userId),
        firstName,
        lastName,
        streetName: streetNameToSave,
        ...(houseNumberToSave && { houseNumber: houseNumberToSave }),
        ...(additionToSave && { houseNumberAddition: additionToSave }),
        postalCode: postalCodeToSave,
        address: fullAddress,
        ...(phone && { phone }),
        country,
        ...(cityToSave && { city: cityToSave }),
        isDefault: isDefault || false,
        ...(note && { note }),
        createdBy: new mongoose.Types.ObjectId(userId),
        updatedBy: new mongoose.Types.ObjectId(userId),
      });

      res.apiCreated({ address: createdAddress }, "Address added successfully");
    }
  );

  /**
   * Get all addresses for authenticated user
   * @route GET /api/addresses
   * @access Private
   */
  getAllAddresses = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const addresses = await Addresses.find({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();

      res.apiSuccess({ addresses }, "Addresses retrieved successfully");
    }
  );

  /**
   * Get address by ID
   * @route GET /api/addresses/:id
   * @access Private
   */
  getAddressById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid address ID", 400);
      }

      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!address) {
        throw new AppError("Address not found", 404);
      }

      res.apiSuccess({ address }, "Address retrieved successfully");
    }
  );

  /**
   * Update address by ID
   * @route PUT /api/addresses/:id
   * @access Private
   */
  updateAddress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid address ID", 400);
      }

      // Check if address exists and belongs to user
      const existingAddress = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!existingAddress) {
        throw new AppError("Address not found", 404);
      }

      const {
        firstName,
        lastName,
        streetName,
        houseNumber,
        houseNumberAddition,
        postalCode,
        address,
        phone,
        country,
        city,
        isDefault,
        note,
      } = req.body;

      const finalCountry = country || existingAddress.country;
      const finalPostalCode = postalCode || existingAddress.postalCode;
      const finalHouseNumber =
        houseNumber !== undefined && houseNumber !== null
          ? String(houseNumber)
          : existingAddress.houseNumber;
      const finalStreetName = streetName || existingAddress.streetName;
      const finalCity = city || existingAddress.city;

      // Country-specific validation
      await this.validateAddressByCountry({
        country: finalCountry,
        postalCode: finalPostalCode,
        houseNumber: finalHouseNumber,
        streetName: finalStreetName,
        city: finalCity,
      });

      // Validate with PostNL for NL, BE, and LU addresses
      const validationOutcome = await this.validateDutchAddressOrRespond({
        country: finalCountry,
        postcode: finalPostalCode,
        houseNumber: finalHouseNumber,
        houseNumberAddition:
          houseNumberAddition ?? existingAddress.houseNumberAddition,
      });

      const normalizedAddress = validationOutcome.normalized;
      const cityToSave = normalizedAddress?.city || finalCity;
      const postalCodeToSave = normalizedAddress?.postcode || finalPostalCode;
      const streetNameToSave = normalizedAddress?.street || finalStreetName;
      const houseNumberToSave =
        normalizedAddress?.houseNumber ?? finalHouseNumber;
      const additionToSave =
        normalizedAddress?.houseNumberAddition ??
        (houseNumberAddition !== undefined
          ? houseNumberAddition
          : existingAddress.houseNumberAddition);

      // Build full address string
      const addressParts = [
        streetNameToSave,
        houseNumberToSave,
        additionToSave,
      ].filter(Boolean);
      const fullAddress =
        addressParts.join(" ") || address || existingAddress.address;

      // If setting as default, unset other default addresses for this user
      if (isDefault === true && existingAddress.isDefault !== true) {
        await Addresses.updateMany(
          {
            userId: new mongoose.Types.ObjectId(userId),
            _id: { $ne: new mongoose.Types.ObjectId(id) },
            isDeleted: false,
          },
          { $set: { isDefault: false } }
        );
      }

      const updatePayload: Partial<IAddress> = {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(streetNameToSave && { streetName: streetNameToSave }),
        ...(houseNumberToSave && { houseNumber: houseNumberToSave }),
        ...(additionToSave !== undefined && {
          houseNumberAddition: additionToSave,
        }),
        ...(postalCodeToSave && { postalCode: postalCodeToSave }),
        ...(fullAddress && { address: fullAddress }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(finalCountry && { country: finalCountry }),
        ...(cityToSave !== undefined && { city: cityToSave || null }),
        ...(isDefault !== undefined && { isDefault }),
        ...(note !== undefined && { note: note || null }),
        updatedBy: new mongoose.Types.ObjectId(userId),
      };

      // Update address
      const updatedAddress = await Addresses.findByIdAndUpdate(
        id,
        updatePayload,
        { new: true, runValidators: true }
      ).lean();

      res.apiSuccess(
        { address: updatedAddress },
        "Address updated successfully"
      );
    }
  );

  /**
   * Delete address by ID (soft delete)
   * @route DELETE /api/addresses/:id
   * @access Private
   */
  deleteAddress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid address ID", 400);
      }

      // Check if address exists and belongs to user
      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!address) {
        throw new AppError("Address not found", 404);
      }

      // Soft delete the address
      await Addresses.findByIdAndUpdate(id, {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: new mongoose.Types.ObjectId(userId),
      });

      res.apiSuccess(null, "Address deleted successfully");
    }
  );

  /**
   * Set address as default
   * @route PATCH /api/addresses/:id/set-default
   * @access Private
   */
  setDefaultAddress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid address ID", 400);
      }

      // Check if address exists and belongs to user
      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!address) {
        throw new AppError("Address not found", 404);
      }

      // Unset all other default addresses for this user
      await Addresses.updateMany(
        {
          userId: new mongoose.Types.ObjectId(userId),
          _id: { $ne: new mongoose.Types.ObjectId(id) },
          isDeleted: false,
        },
        { $set: { isDefault: false } }
      );

      // Set this address as default
      const updatedAddress = await Addresses.findByIdAndUpdate(
        id,
        {
          isDefault: true,
          updatedBy: new mongoose.Types.ObjectId(userId),
        },
        { new: true }
      ).lean();

      res.apiSuccess(
        { address: updatedAddress },
        "Default address set successfully"
      );
    }
  );

  /**
   * Validate address based on country-specific requirements
   */
  private async validateAddressByCountry(options: {
    country?: string;
    postalCode?: string;
    houseNumber?: string | number | null;
    streetName?: string;
    city?: string | null;
  }): Promise<void> {
    const countryCode = options.country?.toUpperCase();

    // Netherlands (NL): postalCode + houseNumber are primary
    if (countryCode === "NL" || countryCode === "NETHERLANDS") {
      if (!options.postalCode || !options.houseNumber) {
        throw new AppError(
          "For Netherlands addresses, postalCode and houseNumber are required",
          400
        );
      }
    }

    // Belgium (BE): streetName + city + postalCode + houseNumber are required
    if (countryCode === "BE" || countryCode === "BELGIUM") {
      if (
        !options.streetName ||
        !options.city ||
        !options.postalCode ||
        !options.houseNumber
      ) {
        throw new AppError(
          "For Belgium addresses, streetName, city, postalCode, and houseNumber are required",
          400
        );
      }
    }

    // Luxembourg (LU): postalCode + houseNumber are required (similar to NL)
    if (countryCode === "LU" || countryCode === "LUXEMBOURG") {
      if (!options.postalCode || !options.houseNumber) {
        throw new AppError(
          "For Luxembourg addresses, postalCode and houseNumber are required",
          400
        );
      }
    }
  }

  private async validateDutchAddressOrRespond(options: {
    country?: string;
    postcode?: string;
    houseNumber?: string | number | null;
    houseNumberAddition?: string | null;
  }): Promise<{ success: true; normalized?: PostNLNormalizedAddress }> {
    // Skip validation for non-Benelux countries
    if (!shouldValidateWithPostNL(options.country)) {
      return { success: true };
    }

    if (!options.postcode || !options.houseNumber) {
      return { success: true }; // Validation already done in validateAddressByCountry
    }

    // Normalize country code for PostNL API (NL, BE, LU)
    const countryCode = options.country?.toUpperCase();
    let postNLCountryCode = "NL"; // Default to NL

    if (countryCode === "BE" || countryCode === "BELGIUM") {
      postNLCountryCode = "BE";
    } else if (countryCode === "LU" || countryCode === "LUXEMBOURG") {
      postNLCountryCode = "LU";
    }

    try {
      const validation = await postNLService.validateAddress({
        postcode: String(options.postcode),
        houseNumber: String(options.houseNumber),
        houseNumberAddition: options.houseNumberAddition || undefined,
        countryCode: postNLCountryCode,
      });

      // PostNL validation is mandatory - reject if invalid
      if (!validation.isValid) {
        throw new AppError(
          "Address validation failed. Please check the address details.",
          400
        );
      }

      // Validation successful - return normalized address
      return { success: true, normalized: validation.normalizedAddress };
    } catch (error: any) {
      // Extract status code from error
      const statusCode =
        error?.status || error?.details?.status || error?.response?.status;

      // Check if it's an authentication/configuration error (401, 403)
      const isAuthError =
        statusCode === 401 ||
        statusCode === 403 ||
        error?.message?.includes("401") ||
        error?.message?.includes("403") ||
        error?.message?.includes("Unauthorized") ||
        error?.message?.includes("Forbidden");

      // Check if PostNL service is not configured
      const isNotConfigured =
        error?.message?.includes("not configured") ||
        error?.message?.includes("Missing POSTNL") ||
        error?.message?.includes("POSTNL_API_KEY");

      // For auth/config errors, throw error (don't allow address creation)
      if (isAuthError || isNotConfigured) {
        logger.error("PostNL validation failed - API not configured", {
          error: error?.message ?? error,
          statusCode,
          reason: isAuthError
            ? `PostNL API authentication failed (status: ${statusCode}). Please check POSTNL_API_KEY environment variable.`
            : "PostNL service not configured",
        });
        throw new AppError(
          "Address validation service is not available. Please contact support.",
          503
        );
      }

      // For timeout errors
      if (
        error?.message?.includes("timed out") ||
        error?.name === "AbortError"
      ) {
        logger.error("PostNL validation timed out", {
          error: error?.message ?? error,
        });
        throw new AppError(
          "Address validation timed out. Please try again.",
          504
        );
      }

      // For invalid address (400) or other validation errors
      if (statusCode === 400 || error?.message?.includes("Address incorrect")) {
        throw new AppError(
          "Invalid address. Please verify the address details and try again.",
          400
        );
      }

      // For any other errors, reject the address
      logger.error("PostNL validation failed", {
        error: error?.message ?? error,
        statusCode,
      });
      throw new AppError(
        "Address validation failed. Please check the address and try again.",
        400
      );
    }
  }
}

const addressController = new AddressController();
export { addressController as AddressController };
