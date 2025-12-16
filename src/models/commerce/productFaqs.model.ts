import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  AuditType,
} from "../common.model";
import { FAQStatus, FAQ_STATUS_VALUES } from "../enums";

export interface IProductFAQ extends Document, AuditType {
  productId: mongoose.Types.ObjectId;
  question: I18nStringType;
  answer: I18nTextType;
  sortOrder: number;
  status: FAQStatus;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductFAQSchema = new Schema<IProductFAQ>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
      index: true,
    },
    question: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    answer: {
      type: I18nText,
      default: () => ({}),
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: FAQ_STATUS_VALUES,
      default: FAQStatus.ACTIVE,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text search index
ProductFAQSchema.index({
  "question.en": "text",
  "question.nl": "text",
  "answer.en": "text",
  "answer.nl": "text",
});

// Indexes for efficient queries
ProductFAQSchema.index({ productId: 1, isActive: 1, status: 1 });
ProductFAQSchema.index({ productId: 1, sortOrder: 1 });
ProductFAQSchema.index({ productId: 1, isDeleted: 1 });

export const ProductFAQs = mongoose.model<IProductFAQ>(
  "product_faqs",
  ProductFAQSchema
);
