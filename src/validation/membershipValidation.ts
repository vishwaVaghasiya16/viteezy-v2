import Joi from "joi";
import mongoose from "mongoose";
import {
  PAYMENT_METHOD_VALUES,
  MEMBERSHIP_INTERVAL_VALUES,
  MEMBERSHIP_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "@/models/enums";
import { withFieldLabels } from "./helpers";

const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ID format",
  })
  .label("ID");

export const buyMembershipSchema = Joi.object(
  withFieldLabels({
    planId: objectIdSchema.required(),
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .required(),
    returnUrl: Joi.string().uri().optional(),
    beneficiaryUserId: objectIdSchema.optional(),
    metadata: Joi.object().unknown(true).optional(),
  })
).label("BuyMembershipPayload");

/**
 * Get Membership Plans Query Validation Schema
 */
export const getMembershipPlansSchema = Joi.object(
  withFieldLabels({
    interval: Joi.string()
      .valid(...MEMBERSHIP_INTERVAL_VALUES)
      .optional()
      .label("Billing interval"),
    lang: Joi.string()
      .valid("en", "nl", "de", "fr", "es")
      .optional()
      .label("Language"),
  })
)
  .unknown(false)
  .label("MembershipPlansQuery");

/**
 * Joi schema for getting membership details
 */
export const getMembershipDetailsParamsSchema = Joi.object(
  withFieldLabels({
    membershipId: objectIdSchema.required(),
  })
).label("MembershipDetailsParams");

/**
 * Joi schema for getting user's memberships
 */
export const getMembershipsQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid(...MEMBERSHIP_STATUS_VALUES, "all")
      .optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("MembershipsQuery");

/**
 * Joi schema for cancelling membership (optional reason)
 */
export const cancelMembershipSchema = Joi.object(
  withFieldLabels({
    reason: Joi.string().trim().max(500).optional().label("Cancellation reason"),
    feedback: Joi.string().trim().max(1000).optional().label("Feedback"),
  })
).label("CancelMembershipPayload");

/**
 * Get Membership Transactions Query Validation Schema
 */
export const getMembershipTransactionsQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().default(1).label("Page"),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .label("Limit"),
    status: Joi.string()
      .valid(...PAYMENT_STATUS_VALUES)
      .optional()
      .label("Payment status")
      .messages({
        "any.only": "Payment status must be one of [Pending, Processing, Completed, Failed, Cancelled, Refunded]"
      })
      .custom((value, helpers) => {
        if (!value) return value;
        // Case-insensitive matching
        const matchedValue = PAYMENT_STATUS_VALUES.find(
          (validValue) => validValue.toLowerCase() === value.toLowerCase()
        );
        if (matchedValue) {
          return matchedValue; // Return the correct case value
        }
        return helpers.error("any.only");
      }),
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .optional()
      .label("Payment method")
      .messages({
        "any.only": "Payment method must be one of [Stripe, Mollie, Paypal, Bank Transfer]"
      })
      .custom((value, helpers) => {
        if (!value) return value;
        // Case-insensitive matching
        const matchedValue = PAYMENT_METHOD_VALUES.find(
          (validValue) => validValue.toLowerCase() === value.toLowerCase()
        );
        if (matchedValue) {
          return matchedValue; // Return the correct case value
        }
        return helpers.error("any.only");
      }),
    sortBy: Joi.string()
      .valid("createdAt", "processedAt", "amount", "status")
      .optional()
      .default("createdAt")
      .label("Sort by"),
    sortOrder: Joi.string()
      .valid("asc", "desc")
      .optional()
      .default("desc")
      .label("Sort order"),
    search: Joi.string().trim().max(100).optional().label("Search query"),
  })
).label("MembershipTransactionsQuery");
