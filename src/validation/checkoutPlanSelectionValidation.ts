import Joi from "joi";
import { withFieldLabels } from "./helpers";

/**
 * Joi schema for checkout plan selection payload
 *
 * This payload is used on the checkout page when user selects
 * a specific plan (one-time vs subscription) and duration.
 */
export const checkoutPlanSelectionSchema = Joi.object(
  withFieldLabels({
    // Plan duration in days (e.g., 30, 60, 90, 180)
    planDurationDays: Joi.number().integer().valid(30, 60, 90, 180).required(),

    // Whether the selection is for subscription (T) or one-time (F)
    isSubscription: Joi.boolean().required(),

    // Supplements count is required only for one-time purchases (30 or 60)
    supplementsCount: Joi.number()
      .integer()
      .valid(30, 60)
      .when("isSubscription", {
        is: false,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),

    // Product variant type: SACHETS or STAND_UP_POUCH
    variantType: Joi.string().valid("SACHETS", "STAND_UP_POUCH").required(),
  })
).label("CheckoutPlanSelectionPayload");

/**
 * Joi schema for checkout summary with optional plan selection
 * Used for GET /api/checkout/summary endpoint
 */
export const checkoutSummarySchema = Joi.object(
  withFieldLabels({
    // Plan duration in days (e.g., 30, 60, 90, 180) - optional
    planDurationDays: Joi.number().integer().valid(30, 60, 90, 180).optional(),

    // Whether the selection is for subscription (T) or one-time (F) - optional
    isSubscription: Joi.boolean().optional(),

    // Supplements count is required only for one-time purchases (30 or 60) - optional
    supplementsCount: Joi.number()
      .integer()
      .valid(30, 60)
      .when("isSubscription", {
        is: false,
        then: Joi.optional(),
        otherwise: Joi.optional(),
      }),

    // Product variant type: SACHETS or STAND_UP_POUCH - optional
    variantType: Joi.string().valid("SACHETS", "STAND_UP_POUCH").optional(),

    // Coupon code - optional
    couponCode: Joi.string().trim().uppercase().optional(),
  })
).label("CheckoutSummaryQuery");

/**
 * Joi schema for enhanced pricing API
 * Used for POST /api/v1/checkout/enhanced-pricing endpoint
 */
export const enhancedPricingSchema = Joi.object(
  withFieldLabels({
    // Plan duration in days (e.g., 30, 60, 90, 180)
    planDurationDays: Joi.number().integer().valid(30, 60, 90, 180).required(),

    // Plan type: SACHET or STANDUP_POUCH
    planType: Joi.string().valid("SACHET", "STANDUP_POUCH").required(),

    // Capsule count (30 or 60) - optional, mainly for one-time purchases
    capsuleCount: Joi.number().integer().valid(30, 60).optional(),

    // Coupon code - optional
    couponCode: Joi.string().trim().uppercase().optional(),
  })
).label("EnhancedPricingPayload");

/**
 * Joi schema for checkout page summary with plan selection (OLD - GET method)
 * Used for GET /api/v1/checkout/page-summary endpoint
 * @deprecated Use checkoutPageSummaryBodySchema for POST method
 */
export const checkoutPageSummarySchema = Joi.object({
  // Product variant type: SACHETS or STAND_UP_POUCH - defaults to SACHETS
  variantType: Joi.string()
    .valid("SACHETS", "STAND_UP_POUCH")
    .default("SACHETS")
    .messages({
      "string.base": "Variant type must be a string",
      "any.only": "Variant type must be SACHETS or STAND_UP_POUCH",
    }),

  // Plan duration in days - REQUIRED for SACHETS, NOT ALLOWED for STAND_UP_POUCH
  planDurationDays: Joi.number()
    .integer()
    .valid(30, 60, 90, 180)
    .when("variantType", {
      is: "SACHETS",
      then: Joi.number().integer().valid(30, 60, 90, 180).default(180),
      otherwise: Joi.forbidden(),
    })
    .messages({
      "number.base": "Plan duration must be a number",
      "any.only": "Plan duration must be 30, 60, 90, or 180 days",
      "any.unknown": "Plan duration is not allowed for STAND_UP_POUCH variant",
    }),

  // Capsule count - REQUIRED for STAND_UP_POUCH, NOT ALLOWED for SACHETS
  capsuleCount: Joi.number()
    .integer()
    .valid(30, 60)
    .when("variantType", {
      is: "STAND_UP_POUCH",
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    })
    .messages({
      "number.base": "Capsule count must be a number",
      "any.only": "Capsule count must be 30 or 60",
      "any.required": "Capsule count is required for STAND_UP_POUCH variant",
      "any.unknown": "Capsule count is not allowed for SACHETS variant",
    }),
}).label("CheckoutPageSummaryQuery");

/**
 * Joi schema for checkout page summary with plan selection (NEW - POST method)
 * Used for POST /api/v1/checkout/page-summary endpoint
 * Includes coupon code validation and comprehensive pricing breakdown
 */
export const checkoutPageSummaryBodySchema = Joi.object(
  withFieldLabels({
    // Product variant type: SACHETS or STAND_UP_POUCH - defaults to SACHETS
    variantType: Joi.string()
      .valid("SACHETS", "STAND_UP_POUCH")
      .default("SACHETS")
      .messages({
        "string.base": "Variant type must be a string",
        "any.only": "Variant type must be SACHETS or STAND_UP_POUCH",
      }),

    // Plan duration in days - REQUIRED for SACHETS, NOT ALLOWED for STAND_UP_POUCH
    planDurationDays: Joi.number()
      .integer()
      .valid(30, 60, 90, 180)
      .when("variantType", {
        is: "SACHETS",
        then: Joi.number().integer().valid(30, 60, 90, 180).default(180),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "number.base": "Plan duration must be a number",
        "any.only": "Plan duration must be 30, 60, 90, or 180 days",
        "any.unknown":
          "Plan duration is not allowed for STAND_UP_POUCH variant",
      }),

    // Capsule count - REQUIRED for STAND_UP_POUCH, NOT ALLOWED for SACHETS
    capsuleCount: Joi.number()
      .integer()
      .valid(30, 60)
      .when("variantType", {
        is: "STAND_UP_POUCH",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "number.base": "Capsule count must be a number",
        "any.only": "Capsule count must be 30 or 60",
        "any.required": "Capsule count is required for STAND_UP_POUCH variant",
        "any.unknown": "Capsule count is not allowed for SACHETS variant",
      }),

    // Coupon code - OPTIONAL
    couponCode: Joi.string()
      .trim()
      .uppercase()
      .min(3)
      .max(50)
      .optional()
      .allow(null, "")
      .messages({
        "string.base": "Coupon code must be a string",
        "string.min": "Coupon code must be at least 3 characters",
        "string.max": "Coupon code cannot exceed 50 characters",
      }),

    // Is one-time purchase - OPTIONAL (default: false for subscription)
    isOneTime: Joi.boolean().optional().default(false).messages({
      "boolean.base": "isOneTime must be a boolean",
    }),

    // Shipping Address ID - OPTIONAL
    shippingAddressId: Joi.string()
      .trim()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null, "")
      .messages({
        "string.base": "Shipping address ID must be a string",
        "string.pattern.base":
          "Shipping address ID must be a valid MongoDB ObjectId",
      }),

    // Billing Address ID - OPTIONAL
    billingAddressId: Joi.string()
      .trim()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .allow(null, "")
      .messages({
        "string.base": "Billing address ID must be a string",
        "string.pattern.base":
          "Billing address ID must be a valid MongoDB ObjectId",
      }),
  })
).label("CheckoutPageSummaryBody");
