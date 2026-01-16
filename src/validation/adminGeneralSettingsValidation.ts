import Joi from "joi";
import { withFieldLabels } from "./helpers";
import { LANGUAGE_VALIDATION } from "@/constants/languageConstants";
import { getI18nStringSchema } from "@/utils/i18nValidationHelper";

// Use dynamic I18n schema that supports any configured languages
const i18nStringSchema = getI18nStringSchema({
  required: false,
  maxLength: 200,
  allowEmpty: true,
});

const socialMediaLinksSchema = Joi.object({
  facebook: Joi.string().uri().optional().allow(null, "").label("Facebook URL"),
  instagram: Joi.string()
    .uri()
    .optional()
    .allow(null, "")
    .label("Instagram URL"),
  youtube: Joi.string().uri().optional().allow(null, "").label("YouTube URL"),
  linkedin: Joi.string().uri().optional().allow(null, "").label("LinkedIn URL"),
  tiktok: Joi.string().uri().optional().allow(null, "").label("TikTok URL"),
}).label("SocialMediaLinks");

const addressSchema = Joi.object({
  street: Joi.string().trim().optional().allow(null, "").label("Street"),
  city: Joi.string().trim().optional().allow(null, "").label("City"),
  state: Joi.string().trim().optional().allow(null, "").label("State"),
  zip: Joi.string().trim().optional().allow(null, "").label("ZIP Code"),
  country: Joi.string().trim().optional().allow(null, "").label("Country"),
  addressLine1: Joi.string()
    .trim()
    .optional()
    .allow(null, "")
    .label("Address Line 1"),
  addressLine2: Joi.string()
    .trim()
    .optional()
    .allow(null, "")
    .label("Address Line 2"),
}).label("Address");

const languageSettingSchema = Joi.object({
  code: Joi.string()
    .pattern(LANGUAGE_VALIDATION.CODE_PATTERN)
    .required()
    .label("Language Code")
    .messages({
      "string.pattern.base":
        "Language code must be a valid 2-letter ISO 639-1 code (e.g., EN, NL, DE, FR, ES, IT, PT, etc.)",
    }),
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .label("Language Name"),
  isEnabled: Joi.boolean().required().label("Is Enabled"),
}).label("LanguageSetting");

export const updateGeneralSettingsSchema = Joi.object(
  withFieldLabels({
    // Branding
    tagline: i18nStringSchema.label("Tagline"),

    // Contact Information
    supportEmail: Joi.string()
      .email()
      .optional()
      .allow(null, "")
      .label("Support Email"),
    supportPhone: Joi.string()
      .trim()
      .optional()
      .allow(null, "")
      .label("Support Phone"),
    address: addressSchema.optional().allow(null),

    // Social Media Links
    socialMedia: socialMediaLinksSchema.optional().allow(null),

    // Language Settings
    languages: Joi.array()
      .items(languageSettingSchema)
      .min(1)
      .optional()
      .label("Languages"),
  })
)
  .min(1)
  .label("UpdateGeneralSettingsPayload");

export const updateLanguageStatusSchema = Joi.object(
  withFieldLabels({
  code: Joi.string()
    .pattern(LANGUAGE_VALIDATION.CODE_PATTERN)
    .required()
    .label("Language Code")
    .messages({
      "string.pattern.base":
        "Language code must be a valid 2-letter ISO 639-1 code",
    }),
    isEnabled: Joi.boolean().required().label("Is Enabled"),
  })
).label("UpdateLanguageStatusPayload");
