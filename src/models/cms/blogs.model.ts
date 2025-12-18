import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  SeoSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
  SeoType,
  AuditType,
} from "../common.model";
import { BlogStatus, BLOG_STATUS_VALUES } from "../enums";

export interface IBlog extends Document, AuditType {
  slug: string;
  title: I18nStringType;
  excerpt: I18nTextType;
  content: I18nTextType;
  authorId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  tags: string[];
  coverImage?: string | null;
  gallery?: MediaType[];
  status: BlogStatus;
  publishedAt?: Date;
  seo: SeoType;
  viewCount: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    slug: {
      type: String,
      lowercase: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    excerpt: {
      type: I18nText,
      default: () => ({}),
    },
    content: {
      type: I18nText,
      default: () => ({}),
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "blog_categories",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    coverImage: {
      type: String,
      trim: true,
      default: null,
    },
    gallery: [
      {
        type: MediaSchema,
      },
    ],
    status: {
      type: String,
      enum: BLOG_STATUS_VALUES,
      default: BlogStatus.DRAFT,
    },
    publishedAt: {
      type: Date,
    },
    seo: {
      type: SeoSchema,
      default: () => ({}),
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
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
BlogSchema.index({
  "title.en": "text",
  "title.nl": "text",
  "content.en": "text",
  "content.nl": "text",
});

// Other indexes
BlogSchema.index({ authorId: 1, status: 1 });
BlogSchema.index({ categoryId: 1, status: 1 });
BlogSchema.index({ publishedAt: -1 });
BlogSchema.index({ viewCount: -1 });

export const Blogs = mongoose.model<IBlog>("blogs", BlogSchema);
