import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  SeoSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  SeoType,
  AuditType,
} from "../common.model";
import { StaticPageStatus, STATIC_PAGE_STATUS_VALUES } from "../enums";

export interface IStaticPage extends Document, AuditType {
  slug: string;
  title: I18nStringType;
  content: I18nTextType;
  status: StaticPageStatus;
  seo: SeoType;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaticPageSchema = new Schema<IStaticPage>(
  {
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    content: {
      type: I18nText,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: STATIC_PAGE_STATUS_VALUES,
      default: StaticPageStatus.UNPUBLISHED,
    },
    seo: {
      type: SeoSchema,
      default: () => ({}),
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text search index
StaticPageSchema.index({
  "title.en": "text",
  "title.nl": "text",
  "content.en": "text",
  "content.nl": "text",
});

// Unique slug index (excluding soft-deleted documents)
StaticPageSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Status and slug index for efficient queries
StaticPageSchema.index({ status: 1, slug: 1 });

export const StaticPages = mongoose.model<IStaticPage>(
  "static_pages",
  StaticPageSchema
);
