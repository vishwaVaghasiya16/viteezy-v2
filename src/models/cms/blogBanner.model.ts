import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
  AuditType,
} from "../common.model";

/**
 * Blog Banner document interface
 */
export interface IBlogBanner extends Document, AuditType {
  banner_image?: MediaType | null;
  heading: I18nStringType;
  description: I18nTextType;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Blog Banner schema
 */
const blogBannerSchema: Schema<IBlogBanner> = new Schema(
  {
    banner_image: {
      type: MediaSchema,
      default: null,
    },
    heading: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    description: {
      type: I18nText,
      default: () => ({}),
      required: true,
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

// Indexes
blogBannerSchema.index({ isDeleted: 1, createdAt: -1 });

export const BlogBanner = mongoose.model<IBlogBanner>(
  "blog_banner",
  blogBannerSchema
);
