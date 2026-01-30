import Joi from "joi";
import mongoose from "mongoose";
import {
  NOTIFICATION_CATEGORY_VALUES,
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

/**
 * Get notifications query schema
 */
export const getNotificationsQuerySchema = Joi.object(
  withFieldLabels({
    category: Joi.string()
      .valid(...NOTIFICATION_CATEGORY_VALUES)
      .optional()
      .messages({
        "any.only": "Invalid notification category",
      }),
    isRead: Joi.string()
      .valid("true", "false", "1", "0")
      .optional()
      .messages({
        "any.only": "Invalid isRead value. Must be 'true', 'false', '1', or '0'",
      }),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  })
)
  .default({})
  .label("GetNotificationsQuery");

/**
 * Notification ID params schema
 */
export const notificationIdParamsSchema = Joi.object(
  withFieldLabels({
    notificationId: objectIdSchema.required().messages({
      "any.required": "Notification ID is required",
    }),
  })
).label("NotificationIdParams");

