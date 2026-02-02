import Joi from "joi";
import mongoose from "mongoose";
import { MEMBERSHIP_INTERVAL_VALUES } from "@/models/enums";

const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ID format",
  });

/**
 * Create Membership Plan Schema
 * 
 * Required Fields:
 * - name (title): Plan name/title
 * - price.amount: Price amount (must be >= 0)
 * - durationDays: Duration in days (must be >= 1)
 * 
 * Optional Fields:
 * - interval: Membership interval (MONTHLY, YEARLY, etc.)
 * - price.currency: Currency code (e.g., EUR, USD, GBP)
 * 
 * Optional Fields:
 * - slug: Auto-generated if not provided
 * - shortDescription: Short description (I18n object)
 * - description: Full description (I18n object)
 * - discountPercentage: Discount percentage (0-100)
 * - benefits: Array of benefit strings
 * - isActive: Active status (defaults to true)
 * - isAutoRenew: Auto-renewal status (defaults to true)
 * - metadata: Additional metadata object
 */
export const createMembershipPlanSchema = Joi.object({
  // REQUIRED: Plan title/name
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      "string.empty": "Plan title/name is required",
      "any.required": "Plan title/name is required",
    })
    .label("Title/Name"),
  
  // OPTIONAL: Slug (auto-generated if not provided)
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(100)
    .messages({
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
    })
    .optional()
    .label("Slug"),
  
  // OPTIONAL: Short description (I18n)
  shortDescription: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
    de: Joi.string().optional(),
    fr: Joi.string().optional(),
    es: Joi.string().optional(),
  })
    .optional()
    .label("Short Description"),
  
  // OPTIONAL: Full description (I18n)
  description: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
    de: Joi.string().optional(),
    fr: Joi.string().optional(),
    es: Joi.string().optional(),
  })
    .optional()
    .label("Description"),
  
  // REQUIRED: Price object with amount (currency is optional)
  price: Joi.object({
    // OPTIONAL: Currency code (e.g., EUR, USD, GBP)
    currency: Joi.string()
      .uppercase()
      .min(3)
      .max(5)
      .optional()
      .label("Currency"),
    
    // REQUIRED: Price amount (must be >= 0)
    amount: Joi.number()
      .min(0)
      .required()
      .messages({
        "number.base": "Price amount must be a number",
        "number.min": "Price amount must be greater than or equal to 0",
        "any.required": "Price amount is required",
      })
      .label("Price Amount"),
    
    // OPTIONAL: Tax rate (0-100, defaults to 0)
    taxRate: Joi.number()
      .min(0)
      .max(100)
      .default(0)
      .optional()
      .label("Tax Rate"),
  })
    .required()
    .messages({
      "object.base": "Price object is required",
      "any.required": "Price is required",
    })
    .label("Price"),
  
  // OPTIONAL: Universal discount percentage for products
  discountPercentage: Joi.number()
    .min(0)
    .max(100)
    .optional()
    .label("Discount Percentage"),
  
  // OPTIONAL: Membership interval (MONTHLY, YEARLY, etc.)
  interval: Joi.string()
    .valid(...MEMBERSHIP_INTERVAL_VALUES)
    .optional()
    .messages({
      "any.only": `Interval must be one of: ${MEMBERSHIP_INTERVAL_VALUES.join(", ")}`,
    })
    .label("Interval"),
  
  // REQUIRED: Duration in days (must be >= 1)
  durationDays: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.base": "Duration in days must be a number",
      "number.integer": "Duration in days must be an integer",
      "number.min": "Duration in days must be at least 1",
      "any.required": "Duration in days is required",
    })
    .label("Duration Days"),
  
  // OPTIONAL: Benefits array
  benefits: Joi.array()
    .items(Joi.string().trim())
    .optional()
    .label("Benefits"),
  
  // OPTIONAL: Active status (defaults to true)
  isActive: Joi.boolean()
    .optional()
    .default(true)
    .label("Is Active"),
  
  // OPTIONAL: Auto-renewal status (defaults to true)
  isAutoRenew: Joi.boolean()
    .optional()
    .default(true)
    .label("Is Auto Renew"),
  
  // OPTIONAL: Additional metadata
  metadata: Joi.object()
    .unknown(true)
    .optional()
    .label("Metadata"),
});

/**
 * Update Membership Plan Schema
 */
export const updateMembershipPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).optional(),
  slug: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9-]+$/)
    .min(1)
    .max(100)
    .optional()
    .messages({
      "string.pattern.base":
        "Slug can only contain lowercase letters, numbers, and hyphens",
    })
    .label("Slug"),
  shortDescription: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
    de: Joi.string().optional(),
    fr: Joi.string().optional(),
    es: Joi.string().optional(),
  })
    .optional()
    .label("Short Description"),
  description: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
    de: Joi.string().optional(),
    fr: Joi.string().optional(),
    es: Joi.string().optional(),
  })
    .optional()
    .label("Description"),
  price: Joi.object({
    currency: Joi.string().uppercase().optional(),
    amount: Joi.number().min(0).optional(),
    taxRate: Joi.number().min(0).max(100).optional(),
  })
    .optional()
    .label("Price"),
  // Universal discount % for products
  discountPercentage: Joi.number()
    .min(0)
    .max(100)
    .optional()
    .label("Discount Percentage"),
  interval: Joi.string()
    .valid(...MEMBERSHIP_INTERVAL_VALUES)
    .optional()
    .label("Interval"),
  durationDays: Joi.number().integer().min(1).optional(),
  benefits: Joi.array().items(Joi.string().trim()).optional().label("Benefits"),
  isActive: Joi.boolean().optional().label("Is Active"),
  isAutoRenew: Joi.boolean().optional().label("Is Auto Renew"),
  metadata: Joi.object().unknown(true).optional().label("Metadata"),
});

/**
 * Membership Plan ID Params Schema
 */
export const membershipPlanIdParamsSchema = Joi.object({
  id: objectIdSchema.required().label("ID"),
});

/**
 * Get All Membership Plans Query Schema
 */
export const getAllMembershipPlansQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  isActive: Joi.string().valid("true", "false").optional(),
  search: Joi.string().trim().optional(),
});
