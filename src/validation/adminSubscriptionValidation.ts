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
    scheduledCancellationDate: Joi.date()
      .iso()
      .optional()
      .label("Scheduled cancellation date")
      .when("cancelImmediately", {
        is: true,
        then: Joi.forbidden().messages({
          "any.unknown": "Cannot schedule cancellation date when cancelling immediately",
        }),
        otherwise: Joi.date().iso().optional(),
      })
      .when("cancelAtEndDate", {
        is: true,
        then: Joi.forbidden().messages({
          "any.unknown": "Cannot specify custom cancellation date when cancelling at end date",
        }),
        otherwise: Joi.date().iso().optional(),
      }),
  })
)
  .custom((value, helpers) => {
    // At least one of cancelAtEndDate, cancelImmediately, or scheduledCancellationDate must be provided
    const hasCancelAtEndDate = value.hasOwnProperty('cancelAtEndDate');
    const hasCancelImmediately = value.hasOwnProperty('cancelImmediately');
    const hasScheduledCancellationDate = value.hasOwnProperty('scheduledCancellationDate') && value.scheduledCancellationDate;
    
    if (!hasCancelAtEndDate && !hasCancelImmediately && !hasScheduledCancellationDate) {
      return helpers.error("any.custom", {
        message:
          "Either 'cancelAtEndDate', 'cancelImmediately', or 'scheduledCancellationDate' must be provided",
      });
    }
    // Only one cancellation method can be specified
    // Note: cancelImmediately: false is a valid standalone option (defaults to cancel at end date)
    const activeCancellationMethods = [
      hasCancelAtEndDate && value.cancelAtEndDate === true,
      hasCancelImmediately && value.cancelImmediately === true,
      hasScheduledCancellationDate,
    ].filter(Boolean);
    
    // Special case: cancelImmediately: false is valid even if no other methods are specified
    const hasExplicitFalseCancel = hasCancelImmediately && value.cancelImmediately === false;
    
    if (activeCancellationMethods.length > 1 && !hasExplicitFalseCancel) {
      return helpers.error("any.custom", {
        message:
          "Only one cancellation method can be specified: 'cancelAtEndDate', 'cancelImmediately', or 'scheduledCancellationDate'",
      });
    }
    
    // Validate scheduled cancellation date is in future
    if (value.scheduledCancellationDate) {
      const now = new Date();
      const scheduledDate = new Date(value.scheduledCancellationDate);
      if (scheduledDate <= now) {
        return helpers.error("any.custom", {
          message: "Scheduled cancellation date must be in the future",
        });
      }
    }
    
    return value;
  })
  .label("CancelSubscriptionPayload");

export const pauseSubscriptionSchema = Joi.object(
  withFieldLabels({
    // No additional fields needed, just pause the subscription
  })
).label("PauseSubscriptionPayload");

