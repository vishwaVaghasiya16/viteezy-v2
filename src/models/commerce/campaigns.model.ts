import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  PriceSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
  PriceType,
} from "../common.model";
import {
  CampaignType,
  CampaignStatus,
  DiscountType,
  CAMPAIGN_TYPE_VALUES,
  CAMPAIGN_STATUS_VALUES,
  DISCOUNT_TYPE_VALUES,
} from "../enums";

export interface ICampaign extends Document {
  name: string;
  title: I18nStringType;
  description: I18nTextType;
  type: CampaignType;
  status: CampaignStatus;
  startDate: Date;
  endDate: Date;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  applicableProducts: mongoose.Types.ObjectId[];
  applicableCategories: mongoose.Types.ObjectId[];
  bannerImage?: MediaType;
  terms: I18nTextType;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    name: {
      type: String,
      trim: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    type: {
      type: String,
      enum: CAMPAIGN_TYPE_VALUES,
    },
    status: {
      type: String,
      enum: CAMPAIGN_STATUS_VALUES,
      default: CampaignStatus.DRAFT,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    discountType: {
      type: String,
      enum: DISCOUNT_TYPE_VALUES,
    },
    discountValue: {
      type: Number,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    bannerImage: {
      type: MediaSchema,
    },
    terms: {
      type: I18nText,
      default: () => ({}),
    },
    ...SoftDelete,
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
CampaignSchema.index({ status: 1, startDate: 1, endDate: 1 });
CampaignSchema.index({ type: 1, status: 1 });
CampaignSchema.index({ applicableProducts: 1 });
CampaignSchema.index({ applicableCategories: 1 });

export const Campaigns = mongoose.model<ICampaign>("campaigns", CampaignSchema);
