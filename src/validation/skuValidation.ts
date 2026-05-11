import Joi from "joi";
import { ProductVariant } from "@/models/enums";

// REUSABLE

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .messages({
    "string.pattern.base": "Must be a valid MongoDB ObjectId",
  });

// CREATE SKU

export const createSkuSchema = Joi.object({
  skuCode: Joi.string()
    .trim()
    .uppercase()
    .min(2)
    .max(50)
    .pattern(/^[A-Z0-9\-_]+$/)
    .required()
    .messages({
      "string.empty": "SKU code is required",
      "string.min": "SKU code must be at least 2 characters",
      "string.max": "SKU code must not exceed 50 characters",
      "string.pattern.base": "SKU code can only contain uppercase letters, numbers, hyphens, and underscores",
      "any.required": "SKU code is required",
    }),

  productId: mongoId.required().messages({
    "any.required": "productId is required",
  }),
  variantType: Joi.string()
    .valid(...Object.values(ProductVariant))
    .required()
    .messages({
      "any.only": `variantType must be one of: ${Object.values(ProductVariant).join(", ")}`,
      "any.required": "variantType is required",
    }),
  displayName: Joi.string().trim().min(2).max(150).required().messages({
    "string.empty": "Display name is required",
    "string.min": "Display name must be at least 2 characters",
    "string.max": "Display name must not exceed 150 characters",
    "any.required": "Display name is required",
  }),
  unit: Joi.string().trim().lowercase().min(1).max(30).required().messages({
    "string.empty": "Unit is required",
    "any.required": "Unit is required",
  }),
  weightGrams: Joi.number().min(0).optional().allow(null).messages({
    "number.min": "weightGrams cannot be negative",
  }),
});

// UPDATE SKU

export const updateSkuSchema = Joi.object({
  displayName: Joi.string().trim().min(2).max(150).optional().messages({
    "string.min": "Display name must be at least 2 characters",
    "string.max": "Display name must not exceed 150 characters",
  }),
  unit: Joi.string().trim().lowercase().min(1).max(30).optional(),
  weightGrams: Joi.number().min(0).optional().allow(null).messages({
    "number.min": "weightGrams cannot be negative",
  }),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// LIST / FILTER SKUs

export const skuFilterSchema = Joi.object({
  variantType: Joi.string()
    .valid(...Object.values(ProductVariant))
    .optional()
    .messages({
      "any.only": `variantType must be one of: ${Object.values(ProductVariant).join(", ")}`,
    }),
  isActive: Joi.boolean().optional(),
  search: Joi.string().trim().max(100).optional().allow(""),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

// PARAM VALIDATORS

export const skuIdParamSchema = Joi.object({
  skuId: mongoId.required().messages({
    "any.required": "skuId param is required",
  }),
});

export const updateSkuRequestSchema = Joi.object({
  params: skuIdParamSchema,
  body: updateSkuSchema,
  query : Joi.object({}).optional(),
});