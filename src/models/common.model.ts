import mongoose, { Schema } from "mongoose";
import { MEDIA_TYPE_VALUES, CURRENCY_VALUES } from "./enums";

// Type definitions
export interface I18nStringType {
  en?: string;
  nl?: string;
}

export interface I18nTextType {
  en?: string;
  nl?: string;
}

export interface MediaType {
  type: "image" | "video";
  url: string;
  alt?: I18nStringType;
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
  taxRate: number;
}

export interface AuditType {
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Schema definitions
export const I18nString = new Schema<I18nStringType>(
  { en: { type: String, trim: true }, nl: { type: String, trim: true } },
  { _id: false }
);
export const I18nText = new Schema<I18nTextType>(
  { en: { type: String, trim: true }, nl: { type: String, trim: true } },
  { _id: false }
);

export const MediaSchema = new Schema<MediaType>(
  {
    type: { type: String, enum: MEDIA_TYPE_VALUES },
    url: { type: String, trim: true },
    alt: { type: I18nString, default: () => ({}) },
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
    taxRate: { type: Number, min: 0, max: 1, default: 0 },
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
