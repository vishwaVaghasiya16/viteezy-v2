import Joi from "joi";
import { BLOG_STATUS_VALUES } from "@/models/enums";
import { withFieldLabels } from "./helpers";

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

const baseI18nStringSchema = Joi.object({
  en: Joi.string().trim().min(3).required().messages({
    "any.required": "English content is required",
    "string.min": "English content must be at least 3 characters",
  }),
  nl: Joi.string().trim().allow("", null),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null),
  nl: Joi.string().trim().allow("", null),
});

const mediaSchema = Joi.object({
  type: Joi.string().valid("Image", "Video").default("Image"),
  url: Joi.string().uri().required().messages({
    "string.uri": "Media URL must be valid",
    "any.required": "Media URL is required",
  }),
  alt: baseI18nStringSchema.optional(),
  sortOrder: Joi.number().integer().min(0).optional(),
}).optional();

const baseSeoSchema = Joi.object({
  title: Joi.string().trim().allow("", null),
  description: Joi.string().trim().allow("", null),
  keywords: Joi.string().trim().allow("", null),
});

const baseGallerySchema = Joi.array().items(mediaSchema);
const baseTagsSchema = Joi.array().items(Joi.string().trim().min(1));

const i18nStringSchema = withJsonSupport(baseI18nStringSchema).required();
const i18nTextSchema = withJsonSupport(baseI18nTextSchema, {
  allowEmpty: true,
}).optional();
const seoSchema = withJsonSupport(baseSeoSchema, {
  allowEmpty: true,
}).optional();
const gallerySchema = withJsonSupport(baseGallerySchema, {
  allowEmpty: true,
}).optional();
const tagsSchema = withJsonSupport(baseTagsSchema, {
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
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    excerpt: i18nTextSchema.label("Blog excerpt"),
    content: i18nStringSchema.label("Blog content"),
    authorId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .label("Author ID")
      .messages({ "string.pattern.base": "Invalid author ID" }),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .required()
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
    tags: tagsSchema.label("Tags"),
    coverImage: coverImageSchema.optional(),
    gallery: gallerySchema.label("Gallery"),
    seo: seoSchema,
    status: Joi.string()
      .valid(...BLOG_STATUS_VALUES)
      .optional()
      .label("Blog status"),
    publishedAt: Joi.date().optional().allow(null).label("Published at"),
  })
).label("CreateBlogPayload");

export const updateBlogSchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Blog title"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    excerpt: i18nTextSchema.label("Blog excerpt"),
    content: i18nStringSchema.label("Blog content"),
    authorId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .label("Author ID")
      .messages({ "string.pattern.base": "Invalid author ID" }),
    categoryId: Joi.string()
      .pattern(objectIdRegex)
      .optional()
      .label("Category ID")
      .messages({ "string.pattern.base": "Invalid category ID" }),
    tags: tagsSchema.label("Tags"),
    coverImage: coverImageSchema.optional(),
    gallery: gallerySchema.label("Gallery"),
    seo: seoSchema,
    status: Joi.string()
      .valid(...BLOG_STATUS_VALUES)
      .optional()
      .label("Blog status"),
    publishedAt: Joi.date().optional().allow(null).label("Published at"),
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
    status: Joi.string()
      .valid(...BLOG_STATUS_VALUES)
      .required()
      .label("Status"),
    publishedAt: Joi.date().optional().allow(null).label("Published at"),
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
    tag: Joi.string().optional(),
    search: Joi.string().optional(),
    lang: Joi.string().valid("en", "nl").optional(),
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
    lang: Joi.string().valid("en", "nl").optional(),
  })
)
  .unknown(false)
  .label("BlogDetailsQuery");

export const getBlogCategoriesQuerySchema = Joi.object(
  withFieldLabels({
    status: Joi.string().valid("active", "all").default("active"),
  })
)
  .unknown(false)
  .label("BlogCategoriesQuery");

export const getPopularBlogsSchema = Joi.object(
  withFieldLabels({
    limit: Joi.number().integer().min(3).max(5).optional(),
    type: Joi.string().valid("popular", "latest").optional(),
    lang: Joi.string().valid("en", "nl").optional(),
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
