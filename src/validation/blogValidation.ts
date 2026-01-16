import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { getLanguageQuerySchema } from "@/utils/i18nValidationHelper";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const slugRegex = /^[0-9a-z]+(?:-[0-9a-z]+)*$/;

const withJsonSupport = <T extends Joi.Schema>(
  schema: T,
  options: { allowEmpty?: boolean } = {}
) =>
  Joi.alternatives().try(
    schema,
    Joi.string().custom((value, helpers) => {
      if (value === undefined || value === null) {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        if (options.allowEmpty) {
          return undefined;
        }
        return helpers.error("any.required");
      }

      try {
        const parsed = JSON.parse(trimmed);
        const { error, value: validated } = schema.validate(parsed, {
          abortEarly: false,
          allowUnknown: true,
        });

        if (error) {
          return helpers.error("any.invalid", { message: error.message });
        }

        return validated;
      } catch (err) {
        return helpers.error("any.invalid");
      }
    })
  );

import { getI18nStringSchema, getI18nTextSchema } from "@/utils/i18nValidationHelper";

// Use dynamic I18n schemas that support any configured languages
const baseI18nStringSchema = getI18nStringSchema({
  required: true,
  minLength: 3,
});

// Description schema - allows markdown/HTML content
const baseI18nDescriptionSchema = getI18nTextSchema({
  required: false,
  allowEmpty: true,
});

const baseSeoSchema = Joi.object({
  metaTitle: Joi.string().trim().allow("", null),
  metaSlug: Joi.string()
    .trim()
    .lowercase()
    .pattern(slugRegex)
    .allow("", null)
    .messages({
      "string.pattern.base":
        "Meta slug must contain only lowercase letters, numbers, and hyphens",
    }),
  metaDescription: Joi.string().trim().allow("", null),
});

const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nDescriptionSchema = withJsonSupport(baseI18nDescriptionSchema, {
  allowEmpty: true,
}).optional();
const seoSchema = withJsonSupport(baseSeoSchema, {
  allowEmpty: true,
}).optional();

const coverImageSchema = Joi.string()
  .uri()
  .allow("", null)
  .empty("")
  .messages({ "string.uri": "Cover image must be a valid URL" })
  .label("Cover image");

export const createBlogSchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Blog title"),
    description: i18nDescriptionSchema.label("Blog description"),
    seo: seoSchema.label("SEO"),
    coverImage: coverImageSchema.optional(),
    isActive: Joi.boolean().optional().default(true).label("Is Active"),
    authorId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .allow(null)
      .label("Author ID")
      .messages({ "string.pattern.base": "Invalid author ID" }),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
  })
).label("CreateBlogPayload");

export const updateBlogSchema = Joi.object(
  withFieldLabels({
    title: withJsonSupport(baseI18nStringSchema, { allowEmpty: true })
      .optional()
      .label("Blog title"),
    description: i18nDescriptionSchema.label("Blog description"),
    seo: seoSchema.label("SEO"),
    coverImage: coverImageSchema.optional(),
    isActive: Joi.boolean().optional().label("Is Active"),
    authorId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .allow(null)
      .label("Author ID")
      .messages({ "string.pattern.base": "Invalid author ID" }),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
  })
)
  .label("UpdateBlogPayload")
  .min(1);

export const blogIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid blog ID",
      "any.required": "Blog ID is required",
    }),
  })
);

export const updateBlogStatusSchema = Joi.object(
  withFieldLabels({
    isActive: Joi.boolean().required().label("Is Active"),
  })
).label("UpdateBlogStatusPayload");

/**
 * Get Blogs Query Validation Schema
 */
export const getBlogsSchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    category: Joi.string().optional(),
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    lang: getLanguageQuerySchema().label("Language"),
  })
)
  .unknown(false)
  .label("BlogListQuery");

export const getBlogDetailsSchema = Joi.object(
  withFieldLabels({
    slugOrId: Joi.string().required().messages({
      "any.required": "Blog slug or ID is required",
    }),
  })
)
  .unknown(false)
  .label("BlogDetailsParams");

export const getBlogDetailsQuerySchema = Joi.object(
  withFieldLabels({
    lang: getLanguageQuerySchema().label("Language"),
  })
)
  .unknown(false)
  .label("BlogDetailsQuery");

export const getBlogCategoriesQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string().valid("active", "all").default("active"),
    lang: getLanguageQuerySchema().label("Language"),
  })
)
  .unknown(false)
  .label("BlogCategoriesQuery");

export const getPopularBlogsSchema = Joi.object(
  withFieldLabels({
    limit: Joi.number().integer().min(3).max(5).optional(),
    type: Joi.string().valid("popular", "latest").optional(),
    lang: getLanguageQuerySchema().label("Language"),
  })
)
  .unknown(false)
  .label("PopularBlogsQuery");

export const incrementBlogViewsSchema = Joi.object(
  withFieldLabels({
    slugOrId: Joi.string().required().messages({
      "any.required": "Blog slug or ID is required",
    }),
  })
)
  .unknown(false)
  .label("IncrementBlogViewsParams");
