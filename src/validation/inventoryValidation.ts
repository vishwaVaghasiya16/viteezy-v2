import Joi from "joi";
import { ProductVariant } from "@/models/enums";

// REUSABLE

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .messages({
    "string.pattern.base": "Must be a valid MongoDB ObjectId",
  });

// UPDATE LOW STOCK THRESHOLD

export const updateThresholdSchema = Joi.object({
  lowStockThreshold: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      "number.base": "lowStockThreshold must be a number",
      "number.integer": "lowStockThreshold must be a whole number",
      "number.min": "lowStockThreshold cannot be negative",
      "any.required": "lowStockThreshold is required",
    }),
});

// LIST / FILTER INVENTORY

export const inventoryFilterSchema = Joi.object({
  locationId: mongoId.optional(),
  skuId: mongoId.optional(),
  variantType: Joi.string()
    .valid(...Object.values(ProductVariant))
    .optional()
    .messages({
      "any.only": `variantType must be one of: ${Object.values(ProductVariant).join(", ")}`,
    }),
  isLowStock: Joi.boolean().optional(),
  isOutOfStock: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

// PARAM VALIDATORS

export const skuLocationParamSchema = Joi.object({
  skuId: mongoId.required().messages({
    "any.required": "skuId param is required",
  }),
  locationId: mongoId.required().messages({
    "any.required": "locationId param is required",
  }),
});

export const locationIdParamSchema = Joi.object({
  locationId: mongoId.required().messages({
    "any.required": "locationId param is required",
  }),
});

export const skuIdParamSchema = Joi.object({
  skuId: mongoId.required().messages({
    "any.required": "skuId param is required",
  }),
});

export const updateThresholdRequestSchema = Joi.object({
  params : skuLocationParamSchema,
  query : updateThresholdSchema,
})