import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nStringType,
  SoftDelete,
  AuditSchema,
  AuditType,
} from "../common.model";

export interface IBlogCategory extends Document, AuditType {
  slug: string;
  title: I18nStringType;
  sortOrder: number;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogCategorySchema = new Schema<IBlogCategory>(
  {
    slug: { type: String, lowercase: true, trim: true, required: true },
    title: { type: I18nString, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    ...(SoftDelete as Record<string, unknown>),
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  { timestamps: true }
);

BlogCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const BlogCategories = mongoose.model<IBlogCategory>(
  "blog_categories",
  BlogCategorySchema
);
