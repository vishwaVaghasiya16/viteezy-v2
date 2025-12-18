import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { DISCOUNT_TYPE_VALUES } from "@/models/enums";

// Joi Schemas
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

const priceSchema = Joi.object(
  withFieldLabels({
    currency: Joi.string().trim().uppercase().min(3).max(5).default("EUR"),
    amount: Joi.number().precision(2).min(0).required(),
    taxRate: Joi.number().precision(4).min(0).max(1).default(0),
  })
);

const orderItemSchema = Joi.object(
  withFieldLabels({
    productId: objectIdSchema.required(),
    variantId: objectIdSchema.optional(),
    quantity: Joi.number().integer().min(1).required(),
    price: priceSchema.required(),
  })
);

const membershipSchema = Joi.object(
  withFieldLabels({
    isMember: Joi.boolean().default(false),
    membershipId: objectIdSchema.optional(),
    level: Joi.string().trim().optional(),
    label: Joi.string().trim().optional(),
    discountType: Joi.string()
      .valid(...DISCOUNT_TYPE_VALUES)
      .when("isMember", {
        is: true,
        then: Joi.required(),
      })
      .optional(),
    discountValue: Joi.number()
      .min(0)
      .when("isMember", {
        is: true,
        then: Joi.required(),
      })
      .optional(),
    metadata: Joi.object().unknown(true).default({}),
  })
).optional();

const familyMemberSchema = Joi.object(
  withFieldLabels({
    familyMemberId: objectIdSchema.optional(),
    relationship: Joi.string().trim().optional(),
    isBuyingForFamily: Joi.boolean().default(false),
  })
).optional();

/**
 * Joi schema for pre-checkout validation
 */
export const preCheckoutValidationSchema = Joi.object(
  withFieldLabels({
    items: Joi.array().items(orderItemSchema).min(1).required(),
    shippingAddressId: objectIdSchema.optional(),
    billingAddressId: objectIdSchema.optional(),
    membership: membershipSchema,
    familyMember: familyMemberSchema,
    couponCode: Joi.string().trim().uppercase().optional(),
  })
).label("PreCheckoutValidationPayload");
