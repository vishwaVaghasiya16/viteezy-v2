import mongoose, { Schema, Document } from 'mongoose';
import { I18nString, I18nText, AuditSchema, SoftDelete, I18nStringType, I18nTextType } from '../common.model';
import { ReviewStatus, REVIEW_STATUS_VALUES } from '../enums';

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  serviceId?: mongoose.Types.ObjectId;
  rating: number;
  title: I18nStringType;
  content: I18nTextType;
  images: string[];
  isVerified: boolean;
  isPublic: boolean;
  helpfulCount: number;
  notHelpfulCount: number;
  status: ReviewStatus;
  moderatorNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'products'
  },
  serviceId: {
    type: Schema.Types.ObjectId,
    ref: 'services'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: I18nString,
    default: () => ({})
  },
  content: {
    type: I18nText,
    required: true,
    default: () => ({})
  },
  images: [{
    type: String,
    trim: true
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
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
  status: {
    type: String,
    enum: REVIEW_STATUS_VALUES,
    default: ReviewStatus.PENDING
  },
  moderatorNotes: {
    type: String,
    trim: true
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Text search index
ReviewSchema.index({
  'title.en': 'text',
  'title.nl': 'text',
  'content.en': 'text',
  'content.nl': 'text'
});

// Other indexes
ReviewSchema.index({ userId: 1 });
ReviewSchema.index({ productId: 1 });
ReviewSchema.index({ serviceId: 1 });
ReviewSchema.index({ rating: 1 });
ReviewSchema.index({ isVerified: 1 });
ReviewSchema.index({ isPublic: 1 });
ReviewSchema.index({ status: 1 });
ReviewSchema.index({ productId: 1, status: 1, isPublic: 1 });
ReviewSchema.index({ serviceId: 1, status: 1, isPublic: 1 });
ReviewSchema.index({ userId: 1, status: 1 });
ReviewSchema.index({ rating: 1, status: 1, isPublic: 1 });
ReviewSchema.index({ createdAt: -1 });

export const Reviews = mongoose.model<IReview>('reviews', ReviewSchema);
