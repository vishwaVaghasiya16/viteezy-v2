import Joi from "joi";

// I18n string schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nStringSchema = Joi.alternatives()
  .try(
    Joi.string().trim().allow("", null), // Plain string (before auto-translation)
    Joi.object({
      // I18n object (after auto-translation middleware or direct input)
      en: Joi.string().trim().allow("", null).optional(),
      nl: Joi.string().trim().allow("", null).optional(),
      de: Joi.string().trim().allow("", null).optional(),
      fr: Joi.string().trim().allow("", null).optional(),
      es: Joi.string().trim().allow("", null).optional(),
    })
  )
  .optional()
  .allow(null);

// I18n text schema - accepts either a plain string (will be converted to I18n by middleware) or an I18n object
const i18nTextSchema = Joi.alternatives()
  .try(
    Joi.string().trim().allow("", null), // Plain string (before auto-translation)
    Joi.object({
      // I18n object (after auto-translation middleware or direct input)
      en: Joi.string().trim().allow("", null).optional(),
      nl: Joi.string().trim().allow("", null).optional(),
      de: Joi.string().trim().allow("", null).optional(),
      fr: Joi.string().trim().allow("", null).optional(),
      es: Joi.string().trim().allow("", null).optional(),
    })
  )
  .optional()
  .allow(null);

// Banner image schema
const bannerImageSchema = Joi.object({}).allow(null).optional();

// Banner section schema
const bannerSchema = Joi.object({
  banner_image: bannerImageSchema,
  title: i18nStringSchema,
  subtitle: i18nTextSchema,
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
