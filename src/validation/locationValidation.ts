import Joi from "joi";
import { LocationType } from "@/models/enums";

// REUSABLE SUB-SCHEMAS

const addressSchema = Joi.object({
  street: Joi.string().trim().max(200).optional().allow(null, ""),
  street2: Joi.string().trim().max(200).optional().allow(null, ""),
  postalCode: Joi.string().trim().max(20).optional().allow(null, ""),
  city: Joi.string().trim().max(100).optional().allow(null, ""),
  state: Joi.string().trim().max(100).optional().allow(null, ""),
  country: Joi.string().trim().max(100).optional().allow(null, ""),
  countryCode: Joi.string()
    .trim()
    .uppercase()
    .length(2)
    .optional()
    .allow(null, "")
    .messages({
      "string.length": "countryCode must be a 2-letter ISO country code (e.g. NL, IN, US)",
    }),
});

const contactPersonSchema = Joi.object({
  name: Joi.string().trim().max(100).optional().allow(null, ""),
  phone: Joi.string().trim().max(20).optional().allow(null, ""),
  phoneCountryCode: Joi.string()
    .trim()
    .pattern(/^\+\d{1,4}$/)
    .optional()
    .allow(null, "")
    .messages({
      "string.pattern.base": "phoneCountryCode must be in format +XX or +XXX (e.g. +31, +91)",
    }),
  email: Joi.string().trim().email({ tlds: { allow: false } }).optional().allow(null, ""),
  designation: Joi.string().trim().max(100).optional().allow(null, ""),
}).custom((value, helpers) => {
  // Mirror the pre-validate hook in the model:
  // if contactPerson is provided, at least phone or email must be present
  if (value && !value.phone && !value.email) {
    return helpers.error("any.invalid");
  }
  return value;
}).messages({
  "any.invalid": "contactPerson must have at least a phone or email",
});

// CREATE LOCATION

export const createLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Location name is required",
    "string.min": "Location name must be at least 2 characters",
    "string.max": "Location name must not exceed 100 characters",
    "any.required": "Location name is required",
  }),
  type: Joi.string()
    .valid(...Object.values(LocationType))
    .required()
    .messages({
      "any.only": `Location type must be one of: ${Object.values(LocationType).join(", ")}`,
      "any.required": "Location type is required",
    }),
  address: addressSchema.optional().allow(null),
  contactPerson: contactPersonSchema.optional().allow(null),
});

// UPDATE LOCATION

export const updateLocationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    "string.min": "Location name must be at least 2 characters",
    "string.max": "Location name must not exceed 100 characters",
  }),
  address: addressSchema.optional().allow(null),
  contactPerson: contactPersonSchema.optional().allow(null),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),
})
  .min(1) // at least one field required for update
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// LIST / FILTER LOCATIONS

export const locationFilterSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(LocationType))
    .optional()
    .messages({
      "any.only": `type must be one of: ${Object.values(LocationType).join(", ")}`,
    }),
  isActive: Joi.boolean().optional(),
  search: Joi.string().trim().max(100).optional().allow(""),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

// PARAM VALIDATORS

export const mongoIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "id must be a valid MongoDB ObjectId",
      "any.required": "id param is required",
    }),
});

export const locationIdParamSchema = Joi.object({
  locationId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "locationId must be a valid MongoDB ObjectId",
      "any.required": "locationId param is required",
    }),
});

