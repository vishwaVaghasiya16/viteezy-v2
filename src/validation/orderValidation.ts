import Joi from "joi";
import mongoose from "mongoose";
import {
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  ORDER_PLAN_TYPE_VALUES,
  DISCOUNT_TYPE_VALUES,
  ProductVariant,
  PRODUCT_VARIANT_VALUES,
} from "@/models/enums";
import { withFieldLabels } from "./helpers";

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
  });

const priceSchema = Joi.object(
  withFieldLabels({
    currency: Joi.string().trim().uppercase().min(3).max(5).default("EUR"),
    amount: Joi.number().precision(2).min(0).required(),
    taxRate: Joi.number().precision(4).min(0).max(1).default(0),
  })
);

export const getOrderHistoryQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid(...ORDER_STATUS_VALUES)
      .optional(),
    paymentStatus: Joi.string()
      .valid(...PAYMENT_STATUS_VALUES)
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("OrderHistoryQuery");

export const getOrderDetailsParamsSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.required(),
  })
).label("OrderDetailsParams");

const addressSchema = Joi.object(
  withFieldLabels({
    name: Joi.string().trim().required().max(150),
    email: Joi.string().email().optional(),
    phone: Joi.string().trim().optional(),
    line1: Joi.string().trim().required().max(200),
    line2: Joi.string().trim().allow("").max(200).optional(),
    city: Joi.string().trim().required().max(100),
    state: Joi.string().trim().required().max(100),
    zip: Joi.string().trim().required().max(20),
    country: Joi.string().trim().required().max(100),
    company: Joi.string().trim().optional(),
    metadata: Joi.object().unknown(true).optional(),
  })
);

const orderItemSchema = Joi.object(
  withFieldLabels({
    productId: objectIdSchema.required(),
    price: priceSchema.required(),
    name: Joi.string().trim().optional(),
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

const planSchema = Joi.object(
  withFieldLabels({
    type: Joi.string()
      .valid(...ORDER_PLAN_TYPE_VALUES)
      .default(ORDER_PLAN_TYPE_VALUES[0]),
    interval: Joi.string().trim().optional(),
    startDate: Joi.date().optional(),
    trialDays: Joi.number().integer().min(0).optional(),
    planDays: Joi.number()
      .integer()
      .valid(30, 60, 90, 180)
      .when("type", {
        is: "Subscription",
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .label("Plan Days"),
    capsuleCount: Joi.number()
      .integer()
      .valid(30, 60)
      .when("type", {
        is: "One-Time",
        then: Joi.optional(),
        otherwise: Joi.optional(),
      })
      .label("Capsule Count"),
    metadata: Joi.object().unknown(true).default({}),
  })
).default({
  type: ORDER_PLAN_TYPE_VALUES[0],
});

/**
 * Joi schema for creating an order
 */
export const createOrderSchema = Joi.object(
  withFieldLabels({
    cartId: objectIdSchema.required().label("Cart ID"),
    variantType: Joi.string()
      .valid(...PRODUCT_VARIANT_VALUES)
      .required()
      .label("Variant Type"),
    planDurationDays: Joi.number()
      .integer()
      .valid(30, 60, 90, 180)
      .when("isOneTime", {
        is: true,
        then: Joi.valid(30, 60).required(),
        otherwise: Joi.valid(30, 60, 90, 180).required(),
      })
      .label("Plan Duration Days"),
    isOneTime: Joi.boolean().required().label("Is One Time Purchase"),
    capsuleCount: Joi.number()
      .integer()
      .valid(30, 60)
      .when("variantType", {
        is: "STAND_UP_POUCH",
        then: Joi.required(),
        otherwise: Joi.optional(),
      })
      .label("Capsule Count"),
    shippingAddressId: objectIdSchema.required().label("Shipping Address ID"),
    billingAddressId: objectIdSchema.optional().label("Billing Address ID"),
    // Pricing fields as numbers with separate currency
    subTotal: Joi.number().min(0).required().label("Sub Total"),
    discountedPrice: Joi.number().min(0).required().label("Discounted Price"),
    couponDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Coupon Discount Amount"),
    membershipDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Membership Discount Amount"),
    subscriptionPlanDiscountAmount: Joi.number()
      .min(0)
      .default(0)
      .label("Subscription Plan Discount Amount"),
    taxAmount: Joi.number().min(0).default(0).label("Tax Amount"),
    grandTotal: Joi.number().min(0).required().label("Grand Total"),
    currency: Joi.string()
      .trim()
      .uppercase()
      .min(3)
      .max(5)
      .default("EUR")
      .label("Currency"),
    couponCode: Joi.string().trim().uppercase().optional(),
    membership: membershipSchema,
    metadata: Joi.object().unknown(true).default({}),
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .optional(),
    notes: Joi.string().trim().max(1000).optional(),
  })
).label("CreateOrderPayload");
