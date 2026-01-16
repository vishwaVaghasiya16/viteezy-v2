import mongoose, { Schema } from "mongoose";
import { MEDIA_TYPE_VALUES, CURRENCY_VALUES } from "./enums";
import {
  DEFAULT_LANGUAGE as DEFAULT_LANG_CONST,
  DEFAULT_SUPPORTED_LANGUAGES,
} from "@/constants/languageConstants";

// Supported languages - now dynamic, but keeping type for backward compatibility
export type SupportedLanguage = string; // Changed from union type to string for flexibility
export const DEFAULT_LANGUAGE_CODE: SupportedLanguage = DEFAULT_LANG_CONST.CODE;

// Legacy constant for backward compatibility (will be deprecated)
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  ...DEFAULT_SUPPORTED_LANGUAGES,
] as string[];

// Re-export for backward compatibility (alias to DEFAULT_LANGUAGE_CODE)
export const DEFAULT_LANGUAGE: SupportedLanguage = DEFAULT_LANGUAGE_CODE;

// Type definitions - now flexible to accept any language codes
export interface I18nStringType {
  en?: string; // English is always required
  [key: string]: string | undefined; // Allow any other language codes
}

export interface I18nTextType {
  en?: string; // English is recommended
  [key: string]: string | undefined; // Allow any other language codes
}

export interface MediaType {
  type: "image" | "video" | "Image" | "Video";
  url: string;
  sortOrder?: number;
}

export interface SeoType {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  hreflang?: Array<{ lang: string; url: string }>;
}

export interface AddressSnapshotType {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface PriceType {
  currency: string;
  amount: number;
  discountedPrice?: number;
  taxRate: number;
}

export interface AuditType {
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Schema definitions - flexible to accept any language codes
// Mongoose will accept additional fields even if not explicitly defined
export const I18nString = new Schema<I18nStringType>(
  {
    en: { type: String, trim: true }, // English is always present
    // Other languages are dynamically added - Mongoose accepts them
    // We define common ones for type safety, but any 2-letter code will work
    nl: { type: String, trim: true },
    de: { type: String, trim: true },
    fr: { type: String, trim: true },
    es: { type: String, trim: true },
  },
  { _id: false, strict: false } // strict: false allows additional fields (other language codes)
);
export const I18nText = new Schema<I18nTextType>(
  {
    en: { type: String, trim: true }, // English is recommended
    // Other languages are dynamically added - Mongoose accepts them
    nl: { type: String, trim: true },
    de: { type: String, trim: true },
    fr: { type: String, trim: true },
    es: { type: String, trim: true },
  },
  { _id: false, strict: false } // strict: false allows additional fields (other language codes)
);

export const MediaSchema = new Schema<MediaType>(
  {
    type: { type: String, enum: MEDIA_TYPE_VALUES },
    url: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

export const SeoSchema = new Schema<SeoType>(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    keywords: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    hreflang: [
      {
        lang: { type: String, trim: true },
        url: { type: String, trim: true },
        _id: false,
      },
    ],
  },
  { _id: false }
);

export const AddressSnapshotSchema = new Schema<AddressSnapshotType>(
  {
    name: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String,
    country: String,
  },
  { _id: false }
);

export const PriceSchema = new Schema<PriceType>(
  {
    currency: {
      type: String,
      default: "EUR",
      enum: CURRENCY_VALUES,
      uppercase: true,
    },
    amount: { type: Number, min: 0, default: 0 },
    discountedPrice: { type: Number, min: 0, optional: true },
    taxRate: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

export const AuditSchema = new Schema<AuditType>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

export const SoftDelete = {
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
};

export default mongoose;
