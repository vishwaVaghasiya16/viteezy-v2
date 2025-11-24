import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { PAYMENT_METHOD_VALUES } from "@/models/enums";

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

/**
 * Joi schema for creating a saved card
 */
export const createSavedCardSchema = Joi.object(
  withFieldLabels({
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .required(),
    last4: Joi.string()
      .pattern(/^\d{4}$/)
      .required()
      .messages({
        "string.pattern.base": "Last 4 digits must be exactly 4 digits",
      }),
    cardType: Joi.string()
      .valid(
        "Visa",
        "Mastercard",
        "American Express",
        "Discover",
        "Diners Club",
        "JCB",
        "UnionPay",
        "Other"
      )
      .required(),
    cardholderName: Joi.string().trim().max(100).optional(),
    expiryMonth: Joi.number().integer().min(1).max(12).required(),
    expiryYear: Joi.number()
      .integer()
      .min(new Date().getFullYear())
      .max(new Date().getFullYear() + 20)
      .required(),
    gatewayToken: Joi.string().trim().optional(),
    gatewayCustomerId: Joi.string().trim().optional(),
    isDefault: Joi.boolean().default(false),
    billingAddressId: objectIdSchema.optional(),
    metadata: Joi.object().unknown(true).default({}).optional(),
  })
).label("CreateSavedCardPayload");

/**
 * Joi schema for updating a saved card
 */
export const updateSavedCardSchema = Joi.object(
  withFieldLabels({
    cardholderName: Joi.string().trim().max(100).optional(),
    expiryMonth: Joi.number().integer().min(1).max(12).optional(),
    expiryYear: Joi.number()
      .integer()
      .min(new Date().getFullYear())
      .max(new Date().getFullYear() + 20)
      .optional(),
    isDefault: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
    billingAddressId: objectIdSchema.optional(),
    metadata: Joi.object().unknown(true).optional(),
  })
).label("UpdateSavedCardPayload");

/**
 * Joi schema for getting card details
 */
export const getCardDetailsParamsSchema = Joi.object(
  withFieldLabels({
    cardId: objectIdSchema.required(),
  })
).label("CardDetailsParams");

/**
 * Joi schema for getting user's saved cards
 */
export const getSavedCardsQuerySchema = Joi.object(
  withFieldLabels({
    paymentMethod: Joi.string()
      .valid(...PAYMENT_METHOD_VALUES)
      .optional(),
    isActive: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("SavedCardsQuery");
