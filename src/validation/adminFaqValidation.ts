import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { FAQ_STATUS_VALUES } from "@/models/enums";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const i18nStringSchema = Joi.object({
  en: Joi.string().trim().min(2).required().messages({
    "any.required": "English text is required",
    "string.min": "English text must be at least 2 characters",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
}).required();

const i18nTextSchema = Joi.object({
  en: Joi.string().trim().min(2).required().messages({
    "any.required": "English text is required",
    "string.min": "English text must be at least 2 characters",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
}).required();

export const createFaqSchema = Joi.object(
  withFieldLabels({
    question: i18nStringSchema.label("Question"),
    answer: i18nTextSchema.label("Answer"),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .allow(null)
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
    tags: Joi.array().items(Joi.string().trim()).optional().label("Tags"),
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    status: Joi.string()
      .valid(...FAQ_STATUS_VALUES)
      .optional()
      .label("Status"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
).label("CreateFaqPayload");

export const updateFaqSchema = Joi.object(
  withFieldLabels({
    question: i18nStringSchema.label("Question"),
    answer: i18nTextSchema.label("Answer"),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .allow(null)
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
    tags: Joi.array().items(Joi.string().trim()).optional().label("Tags"),
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    status: Joi.string()
      .valid(...FAQ_STATUS_VALUES)
      .optional()
      .label("Status"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
)
  .label("UpdateFaqPayload")
  .min(1);

export const faqIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid FAQ ID",
      "any.required": "FAQ ID is required",
    }),
  })
);
