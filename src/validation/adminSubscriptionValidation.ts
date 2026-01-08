import Joi from "joi";
import { SUBSCRIPTION_STATUS_VALUES } from "@/models/enums";

/**
 * Validation schema for subscription ID parameter
 */
export const subscriptionIdParamsSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid subscription ID format",
      "any.required": "Subscription ID is required",
    }),
});

/**
 * Validation schema for get all subscriptions query parameters
 */
export const getAllSubscriptionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().max(255).optional().allow(""),
  status: Joi.string()
    .valid(...SUBSCRIPTION_STATUS_VALUES)
    .optional(),
  sort: Joi.string().optional(),
  order: Joi.string().valid("asc", "desc").optional(),
});
