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

// I18n String Schema (for text field in update - accepts I18n object)
const i18nStringSchema = Joi.alternatives()
  .try(
    Joi.string().allow(""),
    Joi.object({
      en: Joi.string().allow("").optional(),
      nl: Joi.string().allow("").optional(),
      de: Joi.string().allow("").optional(),
      fr: Joi.string().allow("").optional(),
      es: Joi.string().allow("").optional(),
    }).min(1)
  )
  .optional()
  .messages({
    "alternatives.match": "Text must be a string or an I18n object",
  });

// I18n String Schema for create (accepts both string and I18n object)
const createI18nStringSchema = Joi.alternatives()
  .try(
    Joi.string()
      .trim()
      .min(1)
      .max(500)
      .required()
      .messages({
        "string.empty": "Banner text cannot be empty",
        "string.min": "Banner text must be at least 1 character",
        "string.max": "Banner text must not exceed 500 characters",
        "any.required": "Banner text is required",
      }),
    Joi.object({
      en: Joi.string().trim().min(1).max(500).required(),
      nl: Joi.string().trim().max(500).optional(),
      de: Joi.string().trim().max(500).optional(),
      fr: Joi.string().trim().max(500).optional(),
      es: Joi.string().trim().max(500).optional(),
    })
      .required()
      .messages({
        "object.base": "Banner text must be a string or I18n object",
        "any.required": "Banner text is required",
      })
  )
  .messages({
    "alternatives.match": "Banner text must be a string or I18n object with 'en' field",
  });

export const createHeaderBannerSchema = Joi.object(
  withFieldLabels({
    text: createI18nStringSchema.label("Banner Text"),
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

