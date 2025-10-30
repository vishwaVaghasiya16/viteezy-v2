import mongoose, { Schema } from "mongoose";
import { I18nString, SoftDelete } from "../common.model";

const BlogCategorySchema = new Schema(
  {
    slug: { type: String, lowercase: true },
    title: { type: I18nString, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
    ...SoftDelete,
  },
  { timestamps: true }
);

export const BlogCategories = mongoose.model(
  "blog_categories",
  BlogCategorySchema
);
