import Joi from "joi";
import mongoose from "mongoose";
import {
  PAYMENT_METHOD_VALUES,
  MEMBERSHIP_INTERVAL_VALUES,
  MEMBERSHIP_STATUS_VALUES,
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
    cancellationReason: Joi.string().trim().max(500).optional().label("Cancellation reason"),
  })
).label("CancelMembershipPayload");
