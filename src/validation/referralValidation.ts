/**
 * @fileoverview Referral Validation Schemas
 * @description Joi validation schemas for referral-related endpoints
 * @module validation/referralValidation
 */

import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";

// Common validation patterns
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ObjectId format",
  });

/**
 * Validate Referral Code Body Validation Schema
 * @constant {Joi.ObjectSchema} validateReferralCodeSchema
 * @description Validates request body for validating a referral code with cart integration
 */
export const validateReferralCodeSchema = Joi.object(
  withFieldLabels({
    cartId: objectIdSchema.required().messages({
      "any.required": "Cart ID is required",
      "any.invalid": "Cart ID must be a valid MongoDB ObjectId",
    }),
    referralCode: Joi.alternatives()
      .try(
        Joi.string().trim().min(1).max(50).uppercase(),
        Joi.string().allow(null, ""),
        Joi.valid(null, "")
      )
      .optional()
      .messages({
        "string.min": "Referral code must be at least 1 character",
        "string.max": "Referral code must not exceed 50 characters",
        "alternatives.match": "Referral code must be a valid string or null",
      }),
  })
).label("ValidateReferralCodePayload");

