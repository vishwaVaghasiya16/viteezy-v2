import Joi from "joi";
import { withFieldLabels } from "./helpers";
import {
  SubscriptionStatus,
  SUBSCRIPTION_STATUS_VALUES,
} from "@/models/enums";
import { paginationQuerySchema } from "./commonValidation";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const subscriptionIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid subscription ID",
      "any.required": "Subscription ID is required",
    }),
  })
);

export const getAllSubscriptionsQuerySchema = paginationQuerySchema.keys(
  withFieldLabels({
    search: Joi.string().trim().optional().label("Search query"),
    status: Joi.string()
      .valid(...SUBSCRIPTION_STATUS_VALUES)
      .optional()
      .label("Subscription status"),
    startDate: Joi.date().iso().optional().label("Start date"),
    endDate: Joi.date()
      .iso()
      .optional()
      .label("End date")
      .when("startDate", {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref("startDate")),
        otherwise: Joi.date(),
      }),
    userId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .messages({
        "string.pattern.base": "Invalid user ID format",
      })
      .label("User ID"),
  })
).label("GetAllSubscriptionsQuery");

// Predefined cancellation reasons
export const CANCELLATION_REASONS = [
  "Too expensive",
  "Not satisfied with product",
  "Found a better alternative",
  "No longer needed",
  "Moving/relocating",
  "Financial difficulties",
  "Product quality issues",
  "Delivery problems",
  "Customer service issues",
  "Other",
] as const;

export type CancellationReasonType = typeof CANCELLATION_REASONS[number];

export const cancelSubscriptionSchema = Joi.object(
  withFieldLabels({
    cancelAtEndDate: Joi.boolean().optional().label("Cancel at end date"),
    cancelImmediately: Joi.boolean().optional().label("Cancel immediately"),
    cancellationReason: Joi.string()
      .valid(...CANCELLATION_REASONS)
      .required()
      .label("Cancellation reason"),
    customReason: Joi.string()
      .trim()
      .max(500)
      .optional()
      .label("Custom reason")
      .when("cancellationReason", {
        is: "Other",
        then: Joi.required().messages({
          "any.required": "Custom reason is required when 'Other' is selected",
        }),
        otherwise: Joi.optional(),
      }),
  })
)
  .custom((value, helpers) => {
    // At least one of cancelAtEndDate or cancelImmediately must be true
    if (!value.cancelAtEndDate && !value.cancelImmediately) {
      return helpers.error("any.custom", {
        message:
          "Either 'cancelAtEndDate' or 'cancelImmediately' must be true",
      });
    }
    // Both cannot be true at the same time
    if (value.cancelAtEndDate && value.cancelImmediately) {
      return helpers.error("any.custom", {
        message:
          "Cannot set both 'cancelAtEndDate' and 'cancelImmediately' to true",
      });
    }
    return value;
  })
  .label("CancelSubscriptionPayload");

export const pauseSubscriptionSchema = Joi.object(
  withFieldLabels({
    // No additional fields needed, just pause the subscription
  })
).label("PauseSubscriptionPayload");

export const updateDeliveryDateSchema = Joi.object(
  withFieldLabels({
    nextDeliveryDate: Joi.date()
      .iso()
      .required()
      .label("Next delivery date")
      .messages({
        "date.format": "Next delivery date must be a valid ISO date",
        "any.required": "Next delivery date is required",
      }),
    nextBillingDate: Joi.date()
      .iso()
      .optional()
      .label("Next billing date")
      .messages({
        "date.format": "Next billing date must be a valid ISO date",
      }),
    updateReason: Joi.string()
      .trim()
      .max(500)
      .optional()
      .label("Update reason")
      .messages({
        "string.max": "Update reason cannot exceed 500 characters",
      }),
    notifyUser: Joi.boolean()
      .optional()
      .default(true)
      .label("Notify user")
      .messages({
        "boolean.base": "Notify user must be a boolean",
      }),
  })
).label("UpdateDeliveryDatePayload");

