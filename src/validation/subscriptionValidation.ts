import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import {
  PAYMENT_METHOD_VALUES,
  SUBSCRIPTION_CYCLE_VALUES,
} from "@/models/enums";

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

const subscriptionItemSchema = Joi.object(
  withFieldLabels({
    productId: objectIdSchema.required(),
    variantId: objectIdSchema.optional(),
    quantity: Joi.number().integer().min(1).required(),
    price: priceSchema.required(),
    name: Joi.string().trim().optional(),
    sku: Joi.string().trim().optional(),
  })
);

/**
 * Joi schema for creating a subscription after checkout
 */
export const createSubscriptionSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.required(),
    cycleDays: Joi.number()
      .integer()
      .valid(...SUBSCRIPTION_CYCLE_VALUES)
      .required(),
    items: Joi.array().items(subscriptionItemSchema).min(1).required(),
    amount: priceSchema.required(),
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .required(),
    gatewaySubscriptionId: Joi.string().trim().optional(),
    gatewayCustomerId: Joi.string().trim().optional(),
    gatewayPaymentMethodId: Joi.string().trim().optional(),
    initialDeliveryDate: Joi.date().iso().required(),
    nextDeliveryDate: Joi.date().iso().required(),
    nextBillingDate: Joi.date().iso().required(),
    metadata: Joi.object().unknown(true).default({}).optional(),
  })
).label("CreateSubscriptionPayload");

/**
 * Joi schema for updating subscription
 */
export const updateSubscriptionSchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid("Active", "Paused", "Cancelled", "Expired", "Suspended")
      .optional(),
    nextDeliveryDate: Joi.date().iso().optional(),
    nextBillingDate: Joi.date().iso().optional(),
    pausedUntil: Joi.date().iso().optional(),
    cancellationReason: Joi.string().trim().max(500).optional(),
    metadata: Joi.object().unknown(true).optional(),
  })
).label("UpdateSubscriptionPayload");

/**
 * Joi schema for getting subscription details
 */
export const getSubscriptionDetailsParamsSchema = Joi.object(
  withFieldLabels({
    subscriptionId: objectIdSchema.required(),
  })
).label("SubscriptionDetailsParams");

/**
 * Joi schema for getting user's subscriptions
 */
export const getSubscriptionsQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid("Active", "Paused", "Cancelled", "Expired", "Suspended")
      .optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("SubscriptionsQuery");
