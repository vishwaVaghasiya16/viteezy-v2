import mongoose, { Schema, Document } from 'mongoose';
import { I18nString, I18nText, AuditSchema, SoftDelete, I18nStringType, I18nTextType } from '../common.model';

export interface IFAQ extends Document {
  question: I18nStringType;
  answer: I18nTextType;
  category: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const FAQSchema = new Schema<IFAQ>({
  question: {
    type: I18nString,
    required: true,
    default: () => ({})
  },
  answer: {
    type: I18nText,
    required: true,
    default: () => ({})
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  helpfulCount: {
    type: Number,
    default: 0,
    min: 0
  },
  notHelpfulCount: {
    type: Number,
    default: 0,
    min: 0
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Text search index
FAQSchema.index({
  'question.en': 'text',
  'question.nl': 'text',
  'answer.en': 'text',
  'answer.nl': 'text'
});

// Other indexes
FAQSchema.index({ category: 1, isActive: 1, sortOrder: 1 });
FAQSchema.index({ isActive: 1, sortOrder: 1 });

export const FAQs = mongoose.model<IFAQ>('faqs', FAQSchema);
