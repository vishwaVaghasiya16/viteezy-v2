import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

/**
 * Member Referral/Connection Model
 * Tracks parent-child relationships between members
 */
export interface IMemberReferral extends Document {
  childUserId: mongoose.Types.ObjectId; // User who registered using parent's member ID
  parentUserId: mongoose.Types.ObjectId; // User whose member ID was used
  parentMemberId: string; // Parent's member ID (for quick reference)
  registeredAt: Date; // When the child registered
  registrationSource?: "registration" | "quiz"; // How the user registered
  isActive: boolean; // Whether the referral relationship is active
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MemberReferralSchema = new Schema<IMemberReferral>(
  {
    childUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    parentMemberId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    registrationSource: {
      type: String,
      enum: ["registration", "quiz"],
      default: "registration",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Indexes
MemberReferralSchema.index({ childUserId: 1, isActive: 1 });
MemberReferralSchema.index({ parentUserId: 1, isActive: 1 });
MemberReferralSchema.index({ parentMemberId: 1, isActive: 1 });
MemberReferralSchema.index({ registeredAt: -1 });

// Ensure one referral per child user
MemberReferralSchema.index(
  { childUserId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export const MemberReferrals = mongoose.model<IMemberReferral>(
  "member_referrals",
  MemberReferralSchema
);
