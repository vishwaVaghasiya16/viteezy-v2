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
}).required();

export const createBlogCategorySchema = Joi.object(
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
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
).label("CreateBlogCategoryPayload");

export const updateBlogCategorySchema = Joi.object(
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
    sortOrder: Joi.number().integer().min(0).optional().label("Sort order"),
    isActive: Joi.boolean().optional().label("Is active"),
  })
)
  .label("UpdateBlogCategoryPayload")
  .min(1);

export const blogCategoryIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid category ID",
      "any.required": "Category ID is required",
    }),
  })
);
