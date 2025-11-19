/**
 * @fileoverview Address Routes
 * @description Routes for address-related operations
 * @module routes/addressRoutes
 */

import { Router } from "express";
import { AddressController } from "@/controllers/addressController";
import { authenticate } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import {
  addAddressSchema,
  updateAddressSchema,
  addressIdSchema,
  setDefaultAddressSchema,
} from "@/validation/addressValidation";

const router = Router();

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
router.get("/", authenticate, AddressController.getAllAddresses);

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
