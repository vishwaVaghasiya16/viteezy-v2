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
