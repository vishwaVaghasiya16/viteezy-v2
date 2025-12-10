import Joi from "joi";
import mongoose from "mongoose";
import { PAYMENT_METHOD_VALUES } from "@/models/enums";
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
      .valid("Monthly", "Quarterly", "Yearly")
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
