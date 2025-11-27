import Joi from "joi";
import mongoose from "mongoose";
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
  })
  .label("ID");

/**
 * Joi schema for creating a delivery postponement request
 */
export const createPostponementSchema = Joi.object(
  withFieldLabels({
    orderId: objectIdSchema.required(),
    requestedDeliveryDate: Joi.date().iso().greater("now").required(),
    reason: Joi.string().trim().max(1000).optional(),
    metadata: Joi.object().unknown(true).default({}).optional(),
  })
).label("CreatePostponementPayload");

/**
 * Joi schema for getting postponement details
 */
export const getPostponementDetailsParamsSchema = Joi.object(
  withFieldLabels({
    postponementId: objectIdSchema.required(),
  })
).label("PostponementDetailsParams");

/**
 * Joi schema for getting user's postponement history
 */
export const getPostponementHistoryQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid("Pending", "Approved", "Rejected", "Cancelled")
      .optional(),
    orderId: objectIdSchema.optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("PostponementHistoryQuery");
