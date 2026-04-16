/**
 * @fileoverview Address Routes
 * @description Routes for address-related operations
 * @module routes/addressRoutes
 */

import { Router } from "express";
import { AddressController } from "@/controllers/addressController";
import { authenticate } from "@/middleware/auth";
import { validateJoi, validateParams, validateQuery } from "@/middleware/joiValidation";
import {
  addAddressSchema,
  updateAddressSchema,
  addressIdSchema,
  setDefaultAddressSchema,
} from "@/validation/addressValidation";
import Joi from "joi";
import mongoose from "mongoose";

const router = Router();

// Query parameter validation for getAllAddresses
const getAllAddressesQuerySchema = Joi.object({
  subscriptionId: Joi.string().optional(),
  subMemberId: Joi.string()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    })
    .optional()
    .messages({
      "any.invalid": "Invalid sub-member ID format",
    }),
});

/**
 * Private Routes (Authentication Required)
 * All address routes require user authentication
 */

// Add new address
router.post(
  "/",
  authenticate,
  validateJoi(addAddressSchema),
  AddressController.addAddress
);

// Get all addresses for authenticated user
router.get(
  "/", 
  authenticate, 
  validateQuery(getAllAddressesQuerySchema),
  AddressController.getAllAddresses
);

// Get address by ID
router.get(
  "/:id",
  authenticate,
  validateParams(addressIdSchema),
  AddressController.getAddressById
);

// Update address by ID
router.put(
  "/:id",
  authenticate,
  validateParams(addressIdSchema),
  validateJoi(updateAddressSchema),
  AddressController.updateAddress
);

// Delete address by ID
router.delete(
  "/:id",
  authenticate,
  validateParams(addressIdSchema),
  AddressController.deleteAddress
);

// Set address as default
router.patch(
  "/:id/set-default",
  authenticate,
  validateParams(setDefaultAddressSchema),
  AddressController.setDefaultAddress
);

export default router;
