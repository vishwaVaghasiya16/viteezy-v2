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
  icon?: string;
  isActive: boolean;
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
    icon: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
  }
);

FaqCategorySchema.index({ slug: 1 }, { unique: true, sparse: true });
FaqCategorySchema.index({ isActive: 1 });

export const FaqCategories = mongoose.model<IFaqCategory>(
  "faq_categories",
  FaqCategorySchema
);
