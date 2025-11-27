/**
 * @fileoverview Coupon Validation Schemas
 * @description Joi validation schemas for coupon-related endpoints
 * @module validation/couponValidation
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
 * Validate Coupon Body Validation Schema
 * @constant {Joi.ObjectSchema} validateCouponSchema
 * @description Validates request body for validating a coupon
 */
export const validateCouponSchema = Joi.object(
  withFieldLabels({
    couponCode: Joi.string()
      .trim()
      .required()
      .min(1)
      .max(50)
      .uppercase()
      .messages({
        "string.empty": "Coupon code is required",
        "string.min": "Coupon code must be at least 1 character",
        "string.max": "Coupon code must not exceed 50 characters",
        "any.required": "Coupon code is required",
      }),
    orderAmount: Joi.number().positive().optional().messages({
      "number.base": "Order amount must be a number",
      "number.positive": "Order amount must be a positive number",
    }),
    productIds: Joi.array().items(objectIdSchema).optional().messages({
      "array.base": "Product IDs must be an array",
      "any.invalid": "All product IDs must be valid MongoDB ObjectIds",
    }),
    categoryIds: Joi.array().items(objectIdSchema).optional().messages({
      "array.base": "Category IDs must be an array",
      "any.invalid": "All category IDs must be valid MongoDB ObjectIds",
    }),
  })
).label("ValidateCouponPayload");
