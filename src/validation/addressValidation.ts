/**
 * @fileoverview Address Validation Schemas
 * @description Joi validation schemas for address-related endpoints
 * @module validation/addressValidation
 */

import Joi from "joi";
import { AddressType, ADDRESS_TYPE_VALUES } from "../models/enums";
import mongoose from "mongoose";

// Common validation patterns
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .required()
  .messages({
    "any.invalid": "Invalid ID format",
    "any.required": "ID is required",
  });

/**
 * Add Address Body Validation Schema
 * @constant {Joi.ObjectSchema} addAddressSchema
 * @description Validates request body for adding a new address
 */
export const addAddressSchema = Joi.object({
  firstName: Joi.string().trim().required().min(1).max(50).messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 1 character",
    "string.max": "First name must not exceed 50 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().trim().required().min(1).max(50).messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 1 character",
    "string.max": "Last name must not exceed 50 characters",
    "any.required": "Last name is required",
  }),
  phone: Joi.string()
    .trim()
    .required()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    )
    .messages({
      "string.empty": "Phone number is required",
      "string.pattern.base": "Please provide a valid phone number",
      "any.required": "Phone number is required",
    }),
  country: Joi.string().trim().required().min(2).max(100).messages({
    "string.empty": "Country is required",
    "string.min": "Country must be at least 2 characters",
    "string.max": "Country must not exceed 100 characters",
    "any.required": "Country is required",
  }),
  state: Joi.string().trim().required().min(1).max(100).messages({
    "string.empty": "State is required",
    "string.min": "State must be at least 1 character",
    "string.max": "State must not exceed 100 characters",
    "any.required": "State is required",
  }),
  city: Joi.string().trim().required().min(1).max(100).messages({
    "string.empty": "City is required",
    "string.min": "City must be at least 1 character",
    "string.max": "City must not exceed 100 characters",
    "any.required": "City is required",
  }),
  zip: Joi.string().trim().required().min(3).max(20).messages({
    "string.empty": "ZIP/Postal code is required",
    "string.min": "ZIP/Postal code must be at least 3 characters",
    "string.max": "ZIP/Postal code must not exceed 20 characters",
    "any.required": "ZIP/Postal code is required",
  }),
  addressLine1: Joi.string().trim().required().min(5).max(200).messages({
    "string.empty": "Address line 1 is required",
    "string.min": "Address line 1 must be at least 5 characters",
    "string.max": "Address line 1 must not exceed 200 characters",
    "any.required": "Address line 1 is required",
  }),
  addressLine2: Joi.string().trim().optional().allow("").max(200).messages({
    "string.max": "Address line 2 must not exceed 200 characters",
  }),
  isDefault: Joi.boolean().optional().default(false),
  type: Joi.string()
    .valid(...ADDRESS_TYPE_VALUES)
    .optional()
    .default(AddressType.HOME)
    .messages({
      "any.only": `Type must be one of: ${ADDRESS_TYPE_VALUES.join(", ")}`,
    }),
  label: Joi.string().trim().optional().allow("").max(50).messages({
    "string.max": "Label must not exceed 50 characters",
  }),
  instructions: Joi.string().trim().optional().allow("").max(500).messages({
    "string.max": "Instructions must not exceed 500 characters",
  }),
}).unknown(false);

/**
 * Update Address Body Validation Schema
 * @constant {Joi.ObjectSchema} updateAddressSchema
 * @description Validates request body for updating an address
 */
export const updateAddressSchema = Joi.object({
  firstName: Joi.string().trim().optional().min(1).max(50).messages({
    "string.min": "First name must be at least 1 character",
    "string.max": "First name must not exceed 50 characters",
  }),
  lastName: Joi.string().trim().optional().min(1).max(50).messages({
    "string.min": "Last name must be at least 1 character",
    "string.max": "Last name must not exceed 50 characters",
  }),
  phone: Joi.string()
    .trim()
    .optional()
    .pattern(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
    )
    .messages({
      "string.pattern.base": "Please provide a valid phone number",
    }),
  country: Joi.string().trim().optional().min(2).max(100).messages({
    "string.min": "Country must be at least 2 characters",
    "string.max": "Country must not exceed 100 characters",
  }),
  state: Joi.string().trim().optional().min(1).max(100).messages({
    "string.min": "State must be at least 1 character",
    "string.max": "State must not exceed 100 characters",
  }),
  city: Joi.string().trim().optional().min(1).max(100).messages({
    "string.min": "City must be at least 1 character",
    "string.max": "City must not exceed 100 characters",
  }),
  zip: Joi.string().trim().optional().min(3).max(20).messages({
    "string.min": "ZIP/Postal code must be at least 3 characters",
    "string.max": "ZIP/Postal code must not exceed 20 characters",
  }),
  addressLine1: Joi.string().trim().optional().min(5).max(200).messages({
    "string.min": "Address line 1 must be at least 5 characters",
    "string.max": "Address line 1 must not exceed 200 characters",
  }),
  addressLine2: Joi.string().trim().optional().allow("").max(200).messages({
    "string.max": "Address line 2 must not exceed 200 characters",
  }),
  isDefault: Joi.boolean().optional(),
  type: Joi.string()
    .valid(...ADDRESS_TYPE_VALUES)
    .optional()
    .messages({
      "any.only": `Type must be one of: ${ADDRESS_TYPE_VALUES.join(", ")}`,
    }),
  label: Joi.string().trim().optional().allow("").max(50).messages({
    "string.max": "Label must not exceed 50 characters",
  }),
  instructions: Joi.string().trim().optional().allow("").max(500).messages({
    "string.max": "Instructions must not exceed 500 characters",
  }),
}).unknown(false);

/**
 * Address ID Params Validation Schema
 * @constant {Joi.ObjectSchema} addressIdSchema
 * @description Validates path parameters for address ID
 */
export const addressIdSchema = Joi.object({
  id: objectIdSchema,
}).unknown(false);

/**
 * Set Default Address Params Validation Schema
 * @constant {Joi.ObjectSchema} setDefaultAddressSchema
 * @description Validates path parameters for setting default address
 */
export const setDefaultAddressSchema = Joi.object({
  id: objectIdSchema,
}).unknown(false);
