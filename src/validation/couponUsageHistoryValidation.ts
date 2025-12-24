import Joi from "joi";

/**
 * Validation schemas for coupon usage history endpoints
 */

/**
 * Validation for getting user's coupon usage history
 */
export const getMyUsageHistorySchema = Joi.object({
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    couponId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid coupon ID format",
      }),
  }).optional(),
  params: Joi.object({}).optional(),
  body: Joi.object({}).optional(),
});

/**
 * Validation for getting user order coupon data (Admin)
 */
export const getUserOrderCouponDataSchema = Joi.object({
  query: Joi.object({
    userId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid user ID format",
      }),
    orderId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.pattern.base": "Invalid order ID format",
      }),
  }).optional(),
  params: Joi.object({}).optional(),
  body: Joi.object({}).optional(),
});
