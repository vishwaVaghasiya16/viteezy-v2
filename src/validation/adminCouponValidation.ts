import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { CouponType, COUPON_TYPE_VALUES } from "@/models/enums";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const i18nStringSchema = Joi.object({
  en: Joi.string().trim().min(2).optional(),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
}).optional();

const objectIdSchema = Joi.string()
  .pattern(objectIdRegex)
  .messages({ "string.pattern.base": "Invalid ObjectId format" });

export const createCouponSchema = Joi.object(
  withFieldLabels({
    code: Joi.string()
      .trim()
      .uppercase()
      .min(1)
      .max(50)
      .required()
      .label("Coupon code"),
    name: i18nStringSchema.label("Coupon name"),
    description: i18nStringSchema.label("Coupon description"),
    type: Joi.string()
      .valid(...COUPON_TYPE_VALUES)
      .required()
      .label("Discount type"),
    value: Joi.number()
      .min(0)
      .required()
      .label("Discount value")
      .custom((value, helpers) => {
        const type = helpers.state.ancestors[0]?.type;
        if (type === CouponType.PERCENTAGE && (value < 0 || value > 100)) {
          return helpers.error("number.base", {
            message: "Percentage value must be between 0 and 100",
          });
        }
        return value;
      }),
    minOrderAmount: Joi.number().min(0).optional().label("Minimum cart amount"),
    maxDiscountAmount: Joi.number()
      .min(0)
      .optional()
      .label("Max discount amount"),
    usageLimit: Joi.number()
      .integer()
      .min(1)
      .optional()
      .label("Max global usage"),
    userUsageLimit: Joi.number()
      .integer()
      .min(1)
      .optional()
      .label("Max usage per user"),
    validFrom: Joi.date().optional().label("Valid from date"),
    validUntil: Joi.date()
      .optional()
      .label("Expiry date")
      .when("validFrom", {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref("validFrom")),
        otherwise: Joi.date(),
      }),
    isActive: Joi.boolean().optional().label("Is active"),
    isRecurring: Joi.boolean().optional().label("Is recurring"),
    oneTimeUse: Joi.boolean().optional().label("One time use"),
    applicableProducts: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Applicable products"),
    applicableCategories: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Applicable categories"),
    excludedProducts: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Excluded products"),
  })
)
  .custom((value, helpers) => {
    // Validate percentage value range
    if (
      value.type === CouponType.PERCENTAGE &&
      (value.value < 0 || value.value > 100)
    ) {
      return helpers.error("any.invalid", {
        message: "Percentage discount value must be between 0 and 100",
      });
    }
    return value;
  })
  .label("CreateCouponPayload");

export const updateCouponSchema = Joi.object(
  withFieldLabels({
    code: Joi.string()
      .trim()
      .uppercase()
      .min(1)
      .max(50)
      .optional()
      .label("Coupon code"),
    name: i18nStringSchema.label("Coupon name"),
    description: i18nStringSchema.label("Coupon description"),
    type: Joi.string()
      .valid(...COUPON_TYPE_VALUES)
      .optional()
      .label("Discount type"),
    value: Joi.number()
      .min(0)
      .optional()
      .label("Discount value")
      .custom((value, helpers) => {
        const type = helpers.state.ancestors[0]?.type;
        if (type === CouponType.PERCENTAGE && (value < 0 || value > 100)) {
          return helpers.error("number.base", {
            message: "Percentage value must be between 0 and 100",
          });
        }
        return value;
      }),
    minOrderAmount: Joi.number()
      .min(0)
      .optional()
      .allow(null)
      .label("Minimum cart amount"),
    maxDiscountAmount: Joi.number()
      .min(0)
      .optional()
      .allow(null)
      .label("Max discount amount"),
    usageLimit: Joi.number()
      .integer()
      .min(1)
      .optional()
      .allow(null)
      .label("Max global usage"),
    userUsageLimit: Joi.number()
      .integer()
      .min(1)
      .optional()
      .allow(null)
      .label("Max usage per user"),
    validFrom: Joi.date().optional().allow(null).label("Valid from date"),
    validUntil: Joi.date()
      .optional()
      .allow(null)
      .label("Expiry date")
      .when("validFrom", {
        is: Joi.exist(),
        then: Joi.date().greater(Joi.ref("validFrom")),
        otherwise: Joi.date(),
      }),
    isActive: Joi.boolean().optional().label("Is active"),
    isRecurring: Joi.boolean().optional().label("Is recurring"),
    oneTimeUse: Joi.boolean().optional().label("One time use"),
    applicableProducts: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Applicable products"),
    applicableCategories: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Applicable categories"),
    excludedProducts: Joi.array()
      .items(objectIdSchema)
      .optional()
      .label("Excluded products"),
  })
)
  .min(1)
  .label("UpdateCouponPayload");

export const couponIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid coupon ID",
      "any.required": "Coupon ID is required",
    }),
  })
);

export const updateCouponStatusSchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().required().label("Is active"),
  })
).label("UpdateCouponStatusPayload");
