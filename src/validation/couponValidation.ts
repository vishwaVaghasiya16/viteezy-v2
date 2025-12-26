/**
 * @fileoverview Coupon Validation Schemas
 * @description Joi validation schemas for coupon-related endpoints
 * @module validation/couponValidation
 */

import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/models/common.model";

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
 * Validate Coupon Body Validation Schema
 * @constant {Joi.ObjectSchema} validateCouponSchema
 * @description Validates request body for validating a coupon with cart integration
 */
export const validateCouponSchema = Joi.object(
  withFieldLabels({
    cartId: objectIdSchema.required().messages({
      "any.required": "Cart ID is required",
      "any.invalid": "Cart ID must be a valid MongoDB ObjectId",
    }),
    couponCode: Joi.alternatives()
      .try(
        Joi.string().trim().min(1).max(50).uppercase(),
        Joi.string().allow(null, ""),
        Joi.valid(null, "")
      )
      .optional()
      .messages({
        "string.min": "Coupon code must be at least 1 character",
        "string.max": "Coupon code must not exceed 50 characters",
        "alternatives.match": "Coupon code must be a valid string or null",
      }),
    language: Joi.string()
      .valid(...SUPPORTED_LANGUAGES)
      .default(DEFAULT_LANGUAGE)
      .optional()
      .messages({
        "any.only": `Language must be one of: ${SUPPORTED_LANGUAGES.join(
          ", "
        )}`,
      }),
  })
).label("ValidateCouponPayload");
