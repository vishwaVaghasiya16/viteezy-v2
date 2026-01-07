import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import {
  SUBSCRIPTION_PLAN_STATUS_VALUE,
  SubscriptionPlanStatusEnum,
} from "@/models/enums";

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
 * Create Subscription Plan Schema
 */
export const createSubscriptionPlanSchema = Joi.object(
  withFieldLabels({
    title: Joi.string().trim().min(1).max(200).required().label("Title"),
    durationInDays: Joi.number()
      .integer()
      .min(1)
      .required()
      .label("Duration in Days"),
    status: Joi.string()
      .valid(...SUBSCRIPTION_PLAN_STATUS_VALUE)
      .optional()
      .default(SubscriptionPlanStatusEnum.ACTIVE)
      .label("Status"),
    hasDiscount: Joi.boolean().optional().default(false).label("Has Discount"),
    discountPercentage: Joi.number()
      .min(1)
      .max(100)
      .optional()
      .allow(null)
      .label("Discount Percentage")
      .when("hasDiscount", {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null),
      }),
    freeShipping: Joi.boolean()
      .optional()
      .default(false)
      .label("Free Shipping"),
  })
).label("CreateSubscriptionPlanPayload");

/**
 * Update Subscription Plan Schema
 */
export const updateSubscriptionPlanSchema = Joi.object(
  withFieldLabels({
    title: Joi.string().trim().min(1).max(200).optional().label("Title"),
    durationInDays: Joi.number()
      .integer()
      .min(1)
      .optional()
      .label("Duration in Days"),
    status: Joi.string()
      .valid(...SUBSCRIPTION_PLAN_STATUS_VALUE)
      .optional()
      .label("Status"),
    hasDiscount: Joi.boolean().optional().label("Has Discount"),
    discountPercentage: Joi.number()
      .min(1)
      .max(100)
      .optional()
      .allow(null)
      .label("Discount Percentage")
      .when("hasDiscount", {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional().allow(null),
      }),
    freeShipping: Joi.boolean().optional().label("Free Shipping"),
  })
).label("UpdateSubscriptionPlanPayload");

/**
 * Subscription Plan ID Params Schema
 */
export const subscriptionPlanIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required().label("Subscription Plan ID"),
  })
).label("SubscriptionPlanParams");

/**
 * Get All Subscription Plans Query Schema
 */
export const getAllSubscriptionPlansQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).default(1).optional().label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(10)
      .optional()
      .label("Limit"),
    status: Joi.string()
      .valid(...SUBSCRIPTION_PLAN_STATUS_VALUE)
      .optional()
      .label("Status"),
    search: Joi.string().trim().min(1).max(100).optional().label("Search"),
  })
).label("GetAllSubscriptionPlansQuery");
