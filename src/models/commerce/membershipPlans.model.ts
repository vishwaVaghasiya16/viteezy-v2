import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  I18nString,
  I18nText,
  PriceType,
  I18nStringType,
  I18nTextType,
  AuditSchema,
  SoftDelete,
} from "../common.model";
import { MembershipInterval, MEMBERSHIP_INTERVAL_VALUES } from "../enums";

export interface IMembershipPlan extends Document {
  name: string;
  slug: string;
  shortDescription?: I18nStringType;
  description?: I18nTextType;
  price: PriceType;
  interval: MembershipInterval;
  durationDays: number;
  benefits: string[];
  isActive: boolean;
  isAutoRenew: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipPlanSchema = new Schema<IMembershipPlan>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    shortDescription: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    price: {
      type: PriceSchema,
      required: true,
    },
    interval: {
      type: String,
      enum: MEMBERSHIP_INTERVAL_VALUES,
      required: true,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    benefits: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isAutoRenew: {
      type: Boolean,
      default: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
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

MembershipPlanSchema.index({ isActive: 1, interval: 1 });

export const MembershipPlans = mongoose.model<IMembershipPlan>(
  "membership_plans",
  MembershipPlanSchema
);
