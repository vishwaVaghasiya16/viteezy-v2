import Joi from "joi";
import { STATIC_PAGE_STATUS_VALUES } from "@/models/enums";
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
  en: Joi.string().trim().min(1).required().messages({
    "any.required": "English content is required",
    "string.min": "English content must be at least 1 character",
  }),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseI18nTextSchema = Joi.object({
  en: Joi.string().trim().allow("", null),
  nl: Joi.string().trim().allow("", null),
  de: Joi.string().trim().allow("", null),
  fr: Joi.string().trim().allow("", null),
  es: Joi.string().trim().allow("", null),
});

const baseSeoSchema = Joi.object({
  title: Joi.string().trim().allow("", null),
  description: Joi.string().trim().allow("", null),
  keywords: Joi.string().trim().allow("", null),
});

// I18n String Schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nStringSchema = Joi.alternatives()
  .try(
    Joi.string().trim().min(1), // Plain string (before auto-translation)
    withJsonSupport(baseI18nStringSchema) // I18n object (after auto-translation middleware or direct input)
  )
  .required();

// I18n Text Schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nTextSchema = Joi.alternatives()
  .try(
    Joi.string().trim().allow("", null), // Plain string (before auto-translation)
    withJsonSupport(baseI18nTextSchema, { allowEmpty: true }) // I18n object (after auto-translation middleware or direct input)
  )
  .optional()
  .allow(null);
const seoSchema = withJsonSupport(baseSeoSchema, {
  allowEmpty: true,
}).optional();

export const createStaticPageSchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Page title"),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    content: i18nTextSchema.label("Page content"),
    status: Joi.string()
      .valid(...STATIC_PAGE_STATUS_VALUES)
      .optional()
      .label("Page status"),
    seo: seoSchema.label("SEO fields"),
  })
).label("CreateStaticPagePayload");

export const updateStaticPageSchema = Joi.object(
  withFieldLabels({
    title: i18nStringSchema.label("Page title").optional(),
    slug: Joi.string()
      .trim()
      .lowercase()
      .pattern(slugRegex)
      .optional()
      .messages({
        "string.pattern.base":
          "Slug must contain only lowercase letters, numbers, and hyphens",
      }),
    content: i18nTextSchema.label("Page content").optional(),
    status: Joi.string()
      .valid(...STATIC_PAGE_STATUS_VALUES)
      .optional()
      .label("Page status"),
    seo: seoSchema.label("SEO fields").optional(),
  })
)
  .label("UpdateStaticPagePayload")
  .min(1);

export const staticPageIdParamsSchema = Joi.object(
  withFieldLabels({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid static page ID",
      "any.required": "Static page ID is required",
    }),
  })
);

export const updateStaticPageStatusSchema = Joi.object(
  withFieldLabels({
    status: Joi.string()
      .valid(...STATIC_PAGE_STATUS_VALUES)
      .required()
      .label("Status"),
  })
).label("UpdateStaticPageStatusPayload");

/**
 * Get Static Pages Query Validation Schema
 */
export const getStaticPagesSchema = Joi.object(
  withFieldLabels({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid("asc", "desc").optional(),
    search: Joi.string().optional(),
    status: Joi.string()
      .valid(...STATIC_PAGE_STATUS_VALUES)
      .optional(),
  })
)
  .unknown(false)
  .label("StaticPageListQuery");
