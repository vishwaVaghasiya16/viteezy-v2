import Joi from "joi";
import mongoose from "mongoose";
import {
  NOTIFICATION_CATEGORY_VALUES,
  NOTIFICATION_TYPE_VALUES,
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

/**
 * Mock notification creation schema (for testing)
 */
export const createMockNotificationSchema = Joi.object(
  withFieldLabels({
    userId: objectIdSchema.required().messages({
      "any.required": "User ID is required",
    }),
    category: Joi.string()
      .valid(...NOTIFICATION_CATEGORY_VALUES)
      .required(),
    type: Joi.string()
      .valid(...NOTIFICATION_TYPE_VALUES)
      .optional()
      .messages({
        "any.only": "Invalid notification type",
      }),
    title: Joi.string()
      .trim()
      .required()
      .max(200)
      .messages({
        "any.required": "Notification title is required",
        "string.max": "Title cannot exceed 200 characters",
      }),
    message: Joi.string()
      .trim()
      .required()
      .max(1000)
      .messages({
        "any.required": "Notification message is required",
        "string.max": "Message cannot exceed 1000 characters",
      }),
    data: Joi.object().optional(),
    redirectUrl: Joi.string().uri().optional().messages({
      "string.uri": "Redirect URL must be a valid URI",
    }),
    appRoute: Joi.string()
      .valid(
        "/dashboard",
        "/product-detail",
        "/orderDetail",
        "/subscription",
        "/membership",
        "/support",
        "/ai-chat"
      )
      .optional()
      .messages({
        "any.only": "Invalid app route",
      }),
    query: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    skipPush: Joi.boolean().optional().default(false),
  })
).label("CreateMockNotification");

