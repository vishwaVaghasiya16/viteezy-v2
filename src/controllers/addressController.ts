/**
 * @fileoverview Address Controller
 * @description Controller for address-related operations
 * @module controllers/addressController
 */

import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
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

const DUTCH_IDENTIFIERS = new Set([
  "nl",
  "netherlands",
  "the netherlands",
  "nederland",
]);

const shouldValidateWithPostNL = (country?: string): boolean => {
  if (!country) {
    return false;
  }

  return DUTCH_IDENTIFIERS.has(country.trim().toLowerCase());
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
        res.apiError("User not authenticated", 401);
        return;
      }

      const {
        firstName,
        lastName,
        phone,
        country,
        state,
        city,
        zip,
        addressLine1,
        addressLine2,
        isDefault,
        type,
        label,
        instructions,
        houseNumber,
        houseNumberAddition,
      } = req.body;

      const validationOutcome = await this.validateDutchAddressOrRespond(res, {
        country,
        postcode: zip,
        houseNumber,
        houseNumberAddition,
      });

      if (!validationOutcome.success) {
        return;
      }

      const normalizedAddress = validationOutcome.normalized;
      const normalizedAddressLine1 =
        buildAddressLineFromNormalized(normalizedAddress);
      const cityToSave = normalizedAddress?.city || city;
      const stateToSave = normalizedAddress?.state || state;
      const zipToSave = normalizedAddress?.postcode || zip;
      const houseNumberToSave =
        normalizedAddress?.houseNumber ??
        (houseNumber !== undefined && houseNumber !== null
          ? String(houseNumber)
          : undefined);
      const additionToSave =
        normalizedAddress?.houseNumberAddition ?? houseNumberAddition;

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
      const address = await Addresses.create({
        userId: new mongoose.Types.ObjectId(userId),
        firstName,
        lastName,
        phone,
        country,
        state: stateToSave,
        city: cityToSave,
        zip: zipToSave,
        addressLine1: normalizedAddressLine1 || addressLine1,
        addressLine2,
        ...(houseNumberToSave !== undefined && {
          houseNumber: houseNumberToSave,
        }),
        ...(additionToSave !== undefined && {
          houseNumberAddition: additionToSave,
        }),
        isDefault: isDefault || false,
        type: type || "home",
        label,
        instructions,
        createdBy: new mongoose.Types.ObjectId(userId),
        updatedBy: new mongoose.Types.ObjectId(userId),
      });

      res.apiCreated({ address }, "Address added successfully");
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
        res.apiError("User not authenticated", 401);
        return;
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
        res.apiError("User not authenticated", 401);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.apiError("Invalid address ID", 400);
        return;
      }

      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!address) {
        res.apiNotFound("Address not found");
        return;
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
        res.apiError("User not authenticated", 401);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.apiError("Invalid address ID", 400);
        return;
      }

      // Check if address exists and belongs to user
      const existingAddress = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!existingAddress) {
        res.apiNotFound("Address not found");
        return;
      }

      const {
        firstName,
        lastName,
        phone,
        country,
        state,
        city,
        zip,
        addressLine1,
        addressLine2,
        isDefault,
        type,
        label,
        instructions,
        houseNumber,
        houseNumberAddition,
      } = req.body;

      const inferredHouseNumber =
        houseNumber ??
        existingAddress.houseNumber ??
        extractHouseNumberFromLine(
          addressLine1 || existingAddress.addressLine1
        );
      const inferredAddition =
        houseNumberAddition ??
        existingAddress.houseNumberAddition ??
        extractAdditionFromLine(addressLine1 || existingAddress.addressLine1);

      const validationOutcome = await this.validateDutchAddressOrRespond(res, {
        country: country || existingAddress.country,
        postcode: zip || existingAddress.zip,
        houseNumber: inferredHouseNumber,
        houseNumberAddition: inferredAddition,
      });

      if (!validationOutcome.success) {
        return;
      }

      const normalizedAddress = validationOutcome.normalized;
      const normalizedAddressLine1 =
        buildAddressLineFromNormalized(normalizedAddress);

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
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
        ...(country && { country }),
        ...(state && { state }),
        ...(city && { city }),
        ...(zip && { zip }),
        ...(addressLine1 && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2 }),
        ...(isDefault !== undefined && { isDefault }),
        ...(type && { type }),
        ...(label !== undefined && { label }),
        ...(instructions !== undefined && { instructions }),
        ...(houseNumber !== undefined && {
          houseNumber: String(houseNumber),
        }),
        ...(houseNumberAddition !== undefined && {
          houseNumberAddition,
        }),
        updatedBy: new mongoose.Types.ObjectId(userId),
      };

      if (normalizedAddressLine1) {
        updatePayload.addressLine1 = normalizedAddressLine1;
      }
      if (normalizedAddress?.city) {
        updatePayload.city = normalizedAddress.city;
      }
      if (normalizedAddress?.state) {
        updatePayload.state = normalizedAddress.state;
      }
      if (normalizedAddress?.postcode) {
        updatePayload.zip = normalizedAddress.postcode;
      }
      if (normalizedAddress?.houseNumber) {
        updatePayload.houseNumber = normalizedAddress.houseNumber;
      }
      if (normalizedAddress?.houseNumberAddition !== undefined) {
        updatePayload.houseNumberAddition =
          normalizedAddress.houseNumberAddition;
      }

      if (
        updatePayload.houseNumber === undefined &&
        inferredHouseNumber !== undefined
      ) {
        updatePayload.houseNumber = inferredHouseNumber;
      }

      if (
        updatePayload.houseNumberAddition === undefined &&
        inferredAddition !== undefined
      ) {
        updatePayload.houseNumberAddition = inferredAddition;
      }

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
        res.apiError("User not authenticated", 401);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.apiError("Invalid address ID", 400);
        return;
      }

      // Check if address exists and belongs to user
      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!address) {
        res.apiNotFound("Address not found");
        return;
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
        res.apiError("User not authenticated", 401);
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        res.apiError("Invalid address ID", 400);
        return;
      }

      // Check if address exists and belongs to user
      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(id),
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      });

      if (!address) {
        res.apiNotFound("Address not found");
        return;
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

  private async validateDutchAddressOrRespond(
    res: Response,
    options: {
      country?: string;
      postcode?: string;
      houseNumber?: string | number;
      houseNumberAddition?: string;
    }
  ): Promise<
    { success: true; normalized?: PostNLNormalizedAddress } | { success: false }
  > {
    if (!shouldValidateWithPostNL(options.country)) {
      return { success: true };
    }

    if (!options.postcode || !options.houseNumber) {
      res.apiError(
        "Postcode and house number are required for Netherlands addresses",
        400
      );
      return { success: false };
    }

    try {
      const validation = await postNLService.validateAddress({
        postcode: String(options.postcode),
        houseNumber: String(options.houseNumber),
        houseNumberAddition: options.houseNumberAddition,
      });

      if (!validation.isValid) {
        res.apiError("Address incorrect", 400);
        return { success: false };
      }

      return { success: true, normalized: validation.normalizedAddress };
    } catch (error: any) {
      logger.error("PostNL validation failed", {
        error: error?.message ?? error,
      });
      res.apiError(
        "Unable to validate address with PostNL. Please try again later.",
        502
      );
      return { success: false };
    }
  }
}

const addressController = new AddressController();
export { addressController as AddressController };
