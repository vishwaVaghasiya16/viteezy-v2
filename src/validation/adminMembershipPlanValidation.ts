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
 */
export const createMembershipPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().label("Name"),
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
  shortDescription: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
  })
    .optional()
    .label("Short Description"),
  description: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
  })
    .optional()
    .label("Description"),
  price: Joi.object({
    currency: Joi.string().uppercase().required(),
    amount: Joi.number().min(0).required(),
    taxRate: Joi.number().min(0).max(100).default(0).optional(),
  })
    .required()
    .label("Price"),
  interval: Joi.string()
    .valid(...MEMBERSHIP_INTERVAL_VALUES)
    .required()
    .label("Interval"),
  durationDays: Joi.number().integer().min(1).required().label("Duration Days"),
  benefits: Joi.array().items(Joi.string().trim()).optional().label("Benefits"),
  isActive: Joi.boolean().optional().label("Is Active"),
  isAutoRenew: Joi.boolean().optional().label("Is Auto Renew"),
  metadata: Joi.object().unknown(true).optional().label("Metadata"),
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
  })
    .optional()
    .label("Short Description"),
  description: Joi.object({
    en: Joi.string().optional(),
    nl: Joi.string().optional(),
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
