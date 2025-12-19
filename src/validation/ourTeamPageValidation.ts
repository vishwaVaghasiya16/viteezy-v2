import Joi from "joi";

// I18n string schema for multilingual fields
const i18nStringSchema = Joi.object({
  en: Joi.string().allow("", null).optional(),
  nl: Joi.string().allow("", null).optional(),
  de: Joi.string().allow("", null).optional(),
  fr: Joi.string().allow("", null).optional(),
  es: Joi.string().allow("", null).optional(),
}).optional();

// Banner image schema
const bannerImageSchema = Joi.object({
  alt: i18nStringSchema,
})
  .allow(null)
  .optional();

// Banner section schema
const bannerSchema = Joi.object({
  banner_image: bannerImageSchema,
  title: i18nStringSchema,
  subtitle: i18nStringSchema,
}).optional();

/**
 * Validation schema for updating Our Team Page settings
 */
export const updateOurTeamPageSchema = Joi.object({
  banner: bannerSchema,
});

/**
 * Query schema for public Our Team Page API
 */
export const getOurTeamPageQuerySchema = Joi.object({
  lang: Joi.string().valid("en", "nl", "de", "fr", "es").optional(),
});
