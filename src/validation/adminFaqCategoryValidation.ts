import Joi from "joi";
import { withFieldLabels } from "./helpers";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const i18nStringSchema = Joi.object({
  en: Joi.string().trim().min(2).required().messages({
    "any.required": "English title is required",
    "string.min": "English title must be at least 2 characters",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
}).required();

export const createFaqCategorySchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Category title"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    icon: Joi.string().uri().allow("", null).optional().label("Icon URL"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
).label("CreateFaqCategoryPayload");

export const updateFaqCategorySchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Category title"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    icon: Joi.string().uri().allow("", null).optional().label("Icon URL"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
)
  .label("UpdateFaqCategoryPayload")
  .min(1);

export const faqCategoryIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid category ID",
      "any.required": "Category ID is required",
    }),
  })
);
