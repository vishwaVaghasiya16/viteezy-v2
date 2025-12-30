import Joi from "joi";
import { withFieldLabels } from "./helpers";

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
  addressLine1: Joi.string().trim().optional().allow(null, "").label("Address Line 1"),
  addressLine2: Joi.string().trim().optional().allow(null, "").label("Address Line 2"),
}).label("Address");

const languageSettingSchema = Joi.object({
  code: Joi.string()
    .valid("EN", "NL", "DE", "FR", "ES")
    .required()
    .label("Language Code"),
  name: Joi.string()
    .valid("English", "Dutch", "German", "French", "Spanish")
    .required()
    .label("Language Name"),
  isEnabled: Joi.boolean().required().label("Is Enabled"),
}).label("LanguageSetting");

export const updateGeneralSettingsSchema = Joi.object(
  withFieldLabels({
    // Branding
    tagline: Joi.string()
      .trim()
      .max(200)
      .optional()
      .allow(null, "")
      .label("Tagline"),

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
      .max(5)
      .optional()
      .label("Languages"),
  })
)
  .min(1)
  .label("UpdateGeneralSettingsPayload");

export const updateLanguageStatusSchema = Joi.object(
  withFieldLabels({
    code: Joi.string()
      .valid("EN", "NL", "DE", "FR", "ES")
      .required()
      .label("Language Code"),
    isEnabled: Joi.boolean().required().label("Is Enabled"),
  })
).label("UpdateLanguageStatusPayload");
