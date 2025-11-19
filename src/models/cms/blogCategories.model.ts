import mongoose, { Schema } from "mongoose";
import { I18nString, SoftDelete } from "../common.model";

const BlogCategorySchema = new Schema(
  {
    slug: { type: String, lowercase: true },
    title: { type: I18nString, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    ...SoftDelete,
  },
  { timestamps: true }
);

BlogCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const BlogCategories = mongoose.model(
  "blog_categories",
  BlogCategorySchema
);
