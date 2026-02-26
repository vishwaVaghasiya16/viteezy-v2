import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { POSTPONEMENT_STATUS_VALUES } from "@/models/enums";

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
      .valid(...POSTPONEMENT_STATUS_VALUES)
      .optional(),
    orderId: objectIdSchema.optional(),
    subscriptionId: objectIdSchema.optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("PostponementHistoryQuery");

/**
 * Admin: list all postponement requests query
 */
export const adminListPostponementsQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid(...POSTPONEMENT_STATUS_VALUES)
      .optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("AdminListPostponementsQuery");

/**
 * Admin: approve postponement (optional modified date)
 */
export const adminApprovePostponementSchema = Joi.object(
  withFieldLabels({
    approvedDeliveryDate: Joi.date().iso().optional(),
  })
).label("AdminApprovePostponementPayload");

/**
 * Admin: reject postponement (mandatory reason)
 */
export const adminRejectPostponementSchema = Joi.object(
  withFieldLabels({
    reason: Joi.string().trim().min(1).max(1000).required().messages({
      "string.empty": "Rejection reason is required",
      "any.required": "Rejection reason is required",
    }),
  })
).label("AdminRejectPostponementPayload");

/**
 * Admin: postponement ID param
 */
export const adminPostponementIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required(),
  })
).label("AdminPostponementIdParams");

/**
 * Admin: update approved delivery date (only when postponement is already approved)
 */
export const adminUpdateApprovedDateSchema = Joi.object(
  withFieldLabels({
    approvedDeliveryDate: Joi.date().iso().required().messages({
      "date.format": "approvedDeliveryDate must be a valid ISO date",
      "any.required": "approvedDeliveryDate is required",
    }),
  })
).label("AdminUpdateApprovedDatePayload");
