import Joi from "joi";
import mongoose from "mongoose";
import { withFieldLabels } from "./helpers";
import { DeviceType, DEVICE_TYPE_VALUES } from "@/models/enums";

const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid ObjectId format",
  });

import { getI18nStringSchema } from "@/utils/i18nValidationHelper";

// Use dynamic I18n schema that supports any configured languages
const i18nStringSchema = getI18nStringSchema({
  required: false,
  allowEmpty: true,
});

// Simple string schema (for create - English only)
const simpleStringSchema = Joi.string()
  .trim()
  .min(1)
  .max(500)
  .required()
  .messages({
    "string.empty": "Banner text cannot be empty",
    "string.min": "Banner text must be at least 1 character",
    "string.max": "Banner text must not exceed 500 characters",
    "any.required": "Banner text is required",
  });

export const createHeaderBannerSchema = Joi.object(
  withFieldLabels({
    text: simpleStringSchema.label("Banner Text (English only)"),
    deviceType: Joi.string()
      .valid(...DEVICE_TYPE_VALUES)
      .required()
      .messages({
        "any.required": "Device type is required",
        "any.only": `Device type must be one of: ${DEVICE_TYPE_VALUES.join(", ")}`,
      }),
    isActive: Joi.boolean().optional().default(false),
  })
).label("CreateHeaderBannerPayload");

export const updateHeaderBannerSchema = Joi.object(
  withFieldLabels({
    text: i18nStringSchema.optional(),
    deviceType: Joi.string()
      .valid(...DEVICE_TYPE_VALUES)
      .optional()
      .messages({
        "any.only": `Device type must be one of: ${DEVICE_TYPE_VALUES.join(", ")}`,
      }),
    isActive: Joi.boolean().optional(),
  })
).label("UpdateHeaderBannerPayload");

export const headerBannerIdParamsSchema = Joi.object(
  withFieldLabels({
    id: objectIdSchema.required().messages({
      "any.required": "Header banner ID is required",
      "any.invalid": "Header banner ID must be a valid MongoDB ObjectId",
    }),
  })
).label("HeaderBannerIdParams");

export const getAllHeaderBannersQuerySchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(10),
    search: Joi.string().trim().max(200).optional(),
    deviceType: Joi.string()
      .valid(...DEVICE_TYPE_VALUES)
      .optional()
      .messages({
        "any.only": `Device type must be one of: ${DEVICE_TYPE_VALUES.join(", ")}`,
      }),
    isActive: Joi.boolean().optional(),
  })
).label("GetAllHeaderBannersQuery");

export const getActiveHeaderBannerQuerySchema = Joi.object(
  withFieldLabels({
    deviceType: Joi.string()
      .valid(...DEVICE_TYPE_VALUES)
      .required()
      .messages({
        "any.required": "Device type is required",
        "any.only": `Device type must be one of: ${DEVICE_TYPE_VALUES.join(", ")}`,
      }),
  })
).label("GetActiveHeaderBannerQuery");

