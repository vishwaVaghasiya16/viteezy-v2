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
