/**
 * @fileoverview Address Validation Schemas
 * @description Joi validation schemas for address-related endpoints
 * @module validation/addressValidation
 */

import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";

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
 * Country-specific validation helper
 */
const validateAddressByCountry = (
  value: any,
  helpers: Joi.CustomHelpers,
  country?: string
) => {
  const countryCode = country?.toUpperCase();

  // Netherlands (NL): postalCode + houseNumber are primary
  if (countryCode === "NL" || countryCode === "NETHERLANDS") {
    if (!value.postalCode || !value.houseNumber) {
      return helpers.error("any.custom", {
        message:
          "For Netherlands addresses, postalCode and houseNumber are required",
      });
    }
  }

  // Belgium (BE): streetName + city + postalCode + houseNumber are required
  if (countryCode === "BE" || countryCode === "BELGIUM") {
    if (
      !value.streetName ||
      !value.city ||
      !value.postalCode ||
      !value.houseNumber
    ) {
      return helpers.error("any.custom", {
        message:
          "For Belgium addresses, streetName, city, postalCode, and houseNumber are required",
      });
    }
  }

  // Luxembourg (LU): postalCode + houseNumber are required (similar to NL)
  if (countryCode === "LU" || countryCode === "LUXEMBOURG") {
    if (!value.postalCode || !value.houseNumber) {
      return helpers.error("any.custom", {
        message:
          "For Luxembourg addresses, postalCode and houseNumber are required",
      });
    }
  }

  return value;
};

/**
 * Add Address Body Validation Schema
 * @constant {Joi.ObjectSchema} addAddressSchema
 * @description Validates request body for adding a new address
 */
export const addAddressSchema = Joi.object(
  withFieldLabels({
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
    streetName: Joi.string().trim().required().min(1).max(200).messages({
      "string.empty": "Street name is required",
      "string.min": "Street name must be at least 1 character",
      "string.max": "Street name must not exceed 200 characters",
      "any.required": "Street name is required",
    }),
    houseNumber: Joi.alternatives()
      .try(
        Joi.string()
          .trim()
          .pattern(/^[0-9]{1,5}[a-zA-Z]{0,2}$/),
        Joi.number().min(1).max(99999)
      )
      .optional()
      .allow(null, "")
      .messages({
        "alternatives.match":
          "House number must be numeric with optional letters",
        "string.pattern.base":
          "House number must be numeric with optional letters",
      }),
    houseNumberAddition: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
      .max(10)
      .messages({
        "string.max": "House number addition must not exceed 10 characters",
      }),
    postalCode: Joi.string().trim().required().min(3).max(20).messages({
      "string.empty": "Postal code is required",
      "string.min": "Postal code must be at least 3 characters",
      "string.max": "Postal code must not exceed 20 characters",
      "any.required": "Postal code is required",
    }),
    address: Joi.string().trim().required().min(5).max(300).messages({
      "string.empty": "Address is required",
      "string.min": "Address must be at least 5 characters",
      "string.max": "Address must not exceed 300 characters",
      "any.required": "Address is required",
    }),
    phone: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
      .pattern(
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/
      )
      .messages({
        "string.pattern.base": "Please provide a valid phone number",
      }),
    country: Joi.string().trim().required().min(2).max(100).messages({
      "string.empty": "Country is required",
      "string.min": "Country must be at least 2 characters",
      "string.max": "Country must not exceed 100 characters",
      "any.required": "Country is required",
    }),
    city: Joi.string().trim().optional().allow(null, "").max(100).messages({
      "string.max": "City must not exceed 100 characters",
    }),
    isDefault: Joi.boolean().optional().default(false),
    note: Joi.string().trim().optional().allow(null, "").max(500).messages({
      "string.max": "Note must not exceed 500 characters",
    }),
  })
)
  .custom((value, helpers) =>
    validateAddressByCountry(value, helpers, value.country)
  )
  .unknown(false)
  .label("AddAddressPayload");

/**
 * Update Address Body Validation Schema
 * @constant {Joi.ObjectSchema} updateAddressSchema
 * @description Validates request body for updating an address
 */
export const updateAddressSchema = Joi.object(
  withFieldLabels({
    firstName: Joi.string().trim().optional().min(1).max(50).messages({
      "string.min": "First name must be at least 1 character",
      "string.max": "First name must not exceed 50 characters",
    }),
    lastName: Joi.string().trim().optional().min(1).max(50).messages({
      "string.min": "Last name must be at least 1 character",
      "string.max": "Last name must not exceed 50 characters",
    }),
    streetName: Joi.string().trim().optional().min(1).max(200).messages({
      "string.min": "Street name must be at least 1 character",
      "string.max": "Street name must not exceed 200 characters",
    }),
    houseNumber: Joi.alternatives()
      .try(
        Joi.string()
          .trim()
          .pattern(/^[0-9]{1,5}[a-zA-Z]{0,2}$/),
        Joi.number().min(1).max(99999)
      )
      .optional()
      .allow(null, "")
      .messages({
        "alternatives.match":
          "House number must be numeric with optional letters",
        "string.pattern.base":
          "House number must be numeric with optional letters",
      }),
    houseNumberAddition: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
      .max(10)
      .messages({
        "string.max": "House number addition must not exceed 10 characters",
      }),
    postalCode: Joi.string().trim().optional().min(3).max(20).messages({
      "string.min": "Postal code must be at least 3 characters",
      "string.max": "Postal code must not exceed 20 characters",
    }),
    address: Joi.string().trim().optional().min(5).max(300).messages({
      "string.min": "Address must be at least 5 characters",
      "string.max": "Address must not exceed 300 characters",
    }),
    phone: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
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
    city: Joi.string().trim().optional().allow(null, "").max(100).messages({
      "string.max": "City must not exceed 100 characters",
    }),
    isDefault: Joi.boolean().optional(),
    note: Joi.string().trim().optional().allow(null, "").max(500).messages({
      "string.max": "Note must not exceed 500 characters",
    }),
  })
)
  .custom((value, helpers) => {
    // Only validate if country is being updated
    if (value.country) {
      return validateAddressByCountry(value, helpers, value.country);
    }
    return value;
  })
  .unknown(false)
  .label("UpdateAddressPayload");

/**
 * Address ID Params Validation Schema
 * @constant {Joi.ObjectSchema} addressIdSchema
 * @description Validates path parameters for address ID
 */
export const addressIdSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema,
  })
)
  .unknown(false)
  .label("AddressIdParams");

/**
 * Set Default Address Params Validation Schema
 * @constant {Joi.ObjectSchema} setDefaultAddressSchema
 * @description Validates path parameters for setting default address
 */
export const setDefaultAddressSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema,
  })
)
  .unknown(false)
  .label("SetDefaultAddressParams");
