import mongoose, { Schema, Document } from "mongoose";
import {
  AuditSchema,
  SoftDelete,
  I18nString,
  I18nStringType,
} from "../common.model";
import { LANGUAGE_VALIDATION, DEFAULT_LANGUAGE_CONFIG } from "@/constants/languageConstants";

export interface ISocialMediaLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  tiktok?: string;
}

export interface ILanguageSetting {
  code: string; // e.g., "en", "nl", "de", "fr", "es"
  name: string; // e.g., "English", "Dutch", "German", "French", "Spanish"
  isEnabled: boolean;
}

export interface IGeneralSettings extends Document {
  // Branding
  logoLight?: string; // URL for light theme logo
  logoDark?: string; // URL for dark theme logo
  tagline?: I18nStringType; // Short description or tagline (multi-language)

  // Contact Information
  supportEmail?: string;
  supportPhone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };

  // Social Media Links
  socialMedia?: ISocialMediaLinks;

  // Language Settings
  languages?: ILanguageSetting[]; // List of supported languages with enable/disable

  // Metadata
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialMediaLinksSchema = new Schema<ISocialMediaLinks>(
  {
    facebook: { type: String, trim: true, default: null },
    instagram: { type: String, trim: true, default: null },
    youtube: { type: String, trim: true, default: null },
    linkedin: { type: String, trim: true, default: null },
    tiktok: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const AddressSchema = new Schema(
  {
    street: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    zip: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: null },
    addressLine1: { type: String, trim: true, default: null },
    addressLine2: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const LanguageSettingSchema = new Schema<ILanguageSetting>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      // No enum - allows any language code for flexibility
      validate: {
        validator: function (v: string) {
          // ISO 639-1 language codes (2 letters)
          return /^[A-Z]{2}$/.test(v);
        },
        message:
          "Language code must be a valid 2-letter ISO 639-1 code (e.g., EN, NL, DE, FR, ES, IT, PT, etc.)",
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      // No enum - allows any language name for flexibility
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const GeneralSettingsSchema = new Schema<IGeneralSettings>(
  {
    // Branding
    logoLight: {
      type: String,
      trim: true,
      default: null,
    },
    logoDark: {
      type: String,
      trim: true,
      default: null,
    },
    tagline: {
      type: I18nString,
      default: () => ({}),
    },

    // Contact Information
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address",
      ],
      default: null,
    },
    supportPhone: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: AddressSchema,
      default: null,
    },

    // Social Media Links
    socialMedia: {
      type: SocialMediaLinksSchema,
      default: () => ({}),
    },

    // Language Settings
    languages: {
      type: [LanguageSettingSchema],
      default: () => DEFAULT_LANGUAGE_CONFIG.map((lang) => ({
        code: lang.code.toUpperCase(),
        name: lang.name,
        isEnabled: lang.isEnabled,
      })),
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one general settings document exists
GeneralSettingsSchema.index({ isDeleted: 1 });
GeneralSettingsSchema.index({ createdAt: -1 });

export const GeneralSettings = mongoose.model<IGeneralSettings>(
  "general_settings",
  GeneralSettingsSchema
);
