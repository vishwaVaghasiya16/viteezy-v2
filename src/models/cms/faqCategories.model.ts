import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nStringType,
  SoftDelete,
  AuditSchema,
  AuditType,
} from "../common.model";

export interface IFaqCategory extends Document, AuditType {
  title: I18nStringType;
  slug?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FaqCategorySchema = new Schema<IFaqCategory>(
  {
    title: {
      type: I18nString,
      required: true,
      default: () => ({}),
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      // Note: sparse and unique are handled in schema.index() below
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
  }
);

FaqCategorySchema.index({ slug: 1 }, { unique: true, sparse: true });
FaqCategorySchema.index({ isActive: 1, sortOrder: 1 });

export const FaqCategories = mongoose.model<IFaqCategory>(
  "faq_categories",
  FaqCategorySchema
);
