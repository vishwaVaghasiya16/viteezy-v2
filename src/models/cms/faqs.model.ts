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

export interface IFAQ extends Document, AuditType {
  question: I18nStringType;
  answer: I18nTextType;
  category?: string;
  categoryId?: mongoose.Types.ObjectId;
  tags: string[];
  sortOrder: number;
  status: FAQStatus;
  isActive?: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>(
  {
    question: {
      type: I18nString,
      default: () => ({}),
    },
    answer: {
      type: I18nText,
      default: () => ({}),
    },
    category: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "faq_categories",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    sortOrder: {
      type: Number,
      default: 0,
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
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notHelpfulCount: {
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
FAQSchema.index({
  "question.en": "text",
  "question.nl": "text",
  "answer.en": "text",
  "answer.nl": "text",
});

// Other indexes
FAQSchema.index({ category: 1, status: 1, sortOrder: 1 });
FAQSchema.index({ categoryId: 1, status: 1, sortOrder: 1 });
FAQSchema.index({ status: 1, sortOrder: 1 });

export const FAQs = mongoose.model<IFAQ>("faqs", FAQSchema);
