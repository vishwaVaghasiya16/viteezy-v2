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
import {
  STAND_UP_POUCH_PLANS,
  DEFAULT_STAND_UP_POUCH_PLAN,
} from "../config/planConfig";

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
    currency: Joi.string().trim().uppercase().min(3).max(5).default("USD"),
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
    // SACHETS variant configuration - OPTIONAL (required if cart has SACHETS items)
    sachets: Joi.object({
      planDurationDays: Joi.number()
        .integer()
        .valid(30, 60, 90, 180)
        .default(180)
        .required()
        .messages({
          "number.base": "Plan duration days must be a number",
          "any.only": "Plan duration days must be 30, 60, 90, or 180",
          "any.required": "planDurationDays is required for SACHETS variant",
        }),
      isOneTime: Joi.boolean()
        .optional()
        .default(false)
        .messages({
          "boolean.base": "isOneTime must be a boolean",
        }),
    })
      .optional()
      .messages({
        "object.base": "sachets must be an object",
      }),
    // STAND_UP_POUCH variant configuration - OPTIONAL (required if cart has STAND_UP_POUCH items)
    standUpPouch: Joi.object({
      capsuleCount: Joi.number()
        .integer()
        .default(DEFAULT_STAND_UP_POUCH_PLAN)
        .optional()
        .messages({
          "number.base": "Capsule count must be a number",
          "number.integer": "Capsule count must be an integer",
        }),
      planDays: Joi.number()
        .integer()
        .valid(...STAND_UP_POUCH_PLANS)
        .optional()
        .messages({
          "number.base": "Plan days must be a number",
          "any.only": `Plan days must be one of: ${STAND_UP_POUCH_PLANS.join(", ")} for STAND_UP_POUCH`,
        }),
      // Quantity updates for STAND_UP_POUCH items (required if cart has STAND_UP_POUCH items)
      // Each item can have its own capsuleCount/planDays
      itemQuantities: Joi.array()
        .items(
          Joi.object({
            productId: Joi.string()
              .pattern(/^[0-9a-fA-F]{24}$/)
              .required()
              .messages({
                "string.pattern.base": "Product ID must be a valid MongoDB ObjectId",
                "any.required": "productId is required",
              }),
            quantity: Joi.number()
              .integer()
              .min(1)
              .required()
              .messages({
                "number.base": "Quantity must be a number",
                "number.integer": "Quantity must be an integer",
                "number.min": "Quantity must be at least 1",
                "any.required": "quantity is required",
              }),
            capsuleCount: Joi.number()
              .integer()
              .optional()
              .messages({
                "number.base": "Capsule count must be a number",
                "number.integer": "Capsule count must be an integer",
              }),
            planDays: Joi.number()
              .integer()
              .valid(...STAND_UP_POUCH_PLANS)
              .optional()
              .messages({
                "number.base": "Plan days must be a number",
                "any.only": `Plan days must be one of: ${STAND_UP_POUCH_PLANS.join(", ")}`,
              }),
          })
        )
        .min(1)
        .optional()
        .messages({
          "array.base": "itemQuantities must be an array",
          "array.min": "itemQuantities must contain at least one item",
        }),
    })
      .optional()
      .messages({
        "object.base": "standUpPouch must be an object",
      }),
    // Legacy fields (deprecated, kept for backward compatibility)
    variantType: Joi.string()
      .valid(...PRODUCT_VARIANT_VALUES)
      .optional()
      .label("Variant Type"), // Optional - will be determined from cart items
    planDurationDays: Joi.number()
      .integer()
      .valid(30, 60, 90, 180)
      .optional()
      .label("Plan Duration Days"), // Deprecated - use sachets.planDurationDays
    isOneTime: Joi.boolean()
      .optional()
      .label("Is One Time Purchase"), // Deprecated - use sachets.isOneTime
    capsuleCount: Joi.number()
      .integer()
      .valid(30, 60)
      .optional()
      .default(30)
      .label("Capsule Count"), // Deprecated - use standUpPouch.capsuleCount
    shippingAddressId: objectIdSchema.required().label("Shipping Address ID"),
    billingAddressId: objectIdSchema.optional().label("Billing Address ID"),
    // Family management fields
    orderedBy: objectIdSchema.optional().label("Ordered By User ID"),
    orderedFor: objectIdSchema.optional().label("Ordered For User ID"),
    relationshipType: Joi.string()
      .valid("SELF", "FAMILY", "SPOUSE", "CHILD", "PARENT", "SIBLING", "OTHER")
      .optional()
      .label("Relationship Type"),
    addressSource: Joi.string()
      .valid("SELF", "INHERITED", "MANUAL")
      .optional()
      .label("Address Source"),
    addressInheritedFrom: objectIdSchema.optional().label("Address Inherited From User ID"),
    addressIsManual: Joi.boolean().optional().label("Address Is Manual"),
    // Pricing breakdown (this is what we store in DB)
    pricing: Joi.object({
      sachets: Joi.object({
        subTotal: Joi.number().min(0).required(),
        discountedPrice: Joi.number().min(0).required(),
        membershipDiscountAmount: Joi.number().min(0).default(0),
        subscriptionPlanDiscountAmount: Joi.number().min(0).default(0),
        taxAmount: Joi.number().min(0).default(0),
        total: Joi.number().min(0).required(),
        currency: Joi.string().trim().uppercase().min(3).max(5).default("USD"),
      })
        .optional()
        .allow(null),
      standUpPouch: Joi.object({
        subTotal: Joi.number().min(0).required(),
        discountedPrice: Joi.number().min(0).required(),
        membershipDiscountAmount: Joi.number().min(0).default(0),
        taxAmount: Joi.number().min(0).default(0),
        total: Joi.number().min(0).required(),
        currency: Joi.string().trim().uppercase().min(3).max(5).default("USD"),
      })
        .optional()
        .allow(null),
      overall: Joi.object({
        subTotal: Joi.number().min(0).required(),
        discountedPrice: Joi.number().min(0).required(),
        couponDiscountAmount: Joi.number().min(0).default(0),
        membershipDiscountAmount: Joi.number().min(0).default(0),
        subscriptionPlanDiscountAmount: Joi.number().min(0).default(0),
        taxAmount: Joi.number().min(0).default(0),
        grandTotal: Joi.number().min(0).required(),
        currency: Joi.string().trim().uppercase().min(3).max(5).default("USD"),
      }).required(),
    })
      .required()
      .messages({
        "any.required": "pricing is required",
        "object.base": "pricing must be an object",
      }),
    couponCode: Joi.string().trim().uppercase().optional(),
    membership: membershipSchema,
    metadata: Joi.object().unknown(true).default({}),
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .optional(),
    notes: Joi.string().trim().max(1000).optional(),
  })
).label("CreateOrderPayload");
