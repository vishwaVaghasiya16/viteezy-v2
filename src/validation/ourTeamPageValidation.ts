import Joi from "joi";
import { getLanguageQuerySchema, getI18nStringSchema, getI18nTextSchema } from "@/utils/i18nValidationHelper";

// Use dynamic I18n schemas that support any configured languages
const i18nStringSchema = getI18nStringSchema({
  required: false,
  allowEmpty: true,
});

const i18nTextSchema = getI18nTextSchema({
  required: false,
  allowEmpty: true,
});

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
  lang: getLanguageQuerySchema(),
});
