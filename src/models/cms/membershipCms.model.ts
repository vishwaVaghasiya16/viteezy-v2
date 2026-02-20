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

export interface IMembershipBenefit {
  title: I18nStringType;
  subtitle: I18nStringType;
  image: string;
}

export interface IMembershipCms extends Document, AuditType {
  coverImage: string | null;
  heading: I18nStringType;
  description: I18nTextType;
  membershipBenefits: IMembershipBenefit[];
  ctaButtonText: I18nStringType;
  note: I18nTextType;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipBenefitSchema = new Schema<IMembershipBenefit>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subtitle: {
      type: I18nString,
      default: () => ({}),
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false }
);

const MembershipCmsSchema = new Schema<IMembershipCms>(
  {
    coverImage: {
      type: String,
      trim: true,
      default: null,
    },
    heading: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    membershipBenefits: {
      type: [MembershipBenefitSchema],
      default: [],
      validate: {
        validator: function (v: IMembershipBenefit[]) {
          return v.length <= 3;
        },
        message: "Membership benefits cannot exceed 3 items",
      },
    },
    ctaButtonText: {
      type: I18nString,
      default: () => ({}),
    },
    note: {
      type: I18nText,
      default: () => ({}),
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
MembershipCmsSchema.index({
  "heading.en": "text",
  "heading.nl": "text",
  "description.en": "text",
  "description.nl": "text",
});

// Other indexes
MembershipCmsSchema.index({ isActive: 1, isDeleted: 1 });

export const MembershipCms = mongoose.model<IMembershipCms>(
  "membership_cms",
  MembershipCmsSchema
);

