import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

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
  tagline?: string; // Short description or tagline

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
      enum: ["EN", "NL", "DE", "FR", "ES"], // Fixed 5 languages
    },
    name: {
      type: String,
      required: true,
      trim: true,
      enum: ["English", "Dutch", "German", "French", "Spanish"],
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
      type: String,
      trim: true,
      maxlength: [200, "Tagline cannot exceed 200 characters"],
      default: null,
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
      default: () => [
        { code: "EN", name: "English", isEnabled: true },
        { code: "NL", name: "Dutch", isEnabled: true },
        { code: "DE", name: "German", isEnabled: false },
        { code: "FR", name: "French", isEnabled: false },
        { code: "ES", name: "Spanish", isEnabled: false },
      ],
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
