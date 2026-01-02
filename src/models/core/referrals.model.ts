import mongoose, { Schema, Document } from "mongoose";
import { ReferralStatus, REFERRAL_STATUS_VALUES } from "../enums";
import { AuditSchema, SoftDelete } from "../common.model";

/**
 * Referral Model
 * Tracks referral code usage and rewards
 */
export interface IReferral extends Document {
  fromUserId: mongoose.Types.ObjectId; // Customer 1 - Referrer (whose code was used)
  toUserId: mongoose.Types.ObjectId; // Customer 2 - Referred (who used the code)
  referralCode: string; // The referral code that was used
  orderId?: mongoose.Types.ObjectId; // Order where referral code was used
  paymentId?: mongoose.Types.ObjectId; // Payment ID for Customer 2's first payment
  status: ReferralStatus; // PENDING → PAID → COMPLETED
  discountAmount: {
    amount: number;
    currency: string;
  }; // Discount amount (default: €10)
  minOrderAmount: {
    amount: number;
    currency: string;
  }; // Minimum order amount required (default: €19.99)
  referredDiscountApplied: boolean; // Whether Customer 2 got discount on first order
  referrerDiscountApplied: boolean; // Whether Customer 1 got discount on recurring payment
  referredOrderAmount?: {
    amount: number;
    currency: string;
  }; // Customer 2's order amount
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referralCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    status: {
      type: String,
      enum: REFERRAL_STATUS_VALUES,
      default: ReferralStatus.PENDING,
      index: true,
    },
    discountAmount: {
      amount: {
        type: Number,
        required: true,
        default: 10, // Default: €10
      },
      currency: {
        type: String,
        required: true,
        default: "EUR",
      },
    },
    minOrderAmount: {
      amount: {
        type: Number,
        required: true,
        default: 19.99, // Default: €19.99
      },
      currency: {
        type: String,
        required: true,
        default: "EUR",
      },
    },
    referredDiscountApplied: {
      type: Boolean,
      default: false,
    },
    referrerDiscountApplied: {
      type: Boolean,
      default: false,
    },
    referredOrderAmount: {
      amount: {
        type: Number,
        default: null,
      },
      currency: {
        type: String,
        default: "EUR",
      },
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
ReferralSchema.index({ fromUserId: 1, status: 1 });
ReferralSchema.index({ toUserId: 1, status: 1 });
ReferralSchema.index({ referralCode: 1, status: 1 });
ReferralSchema.index({ paymentId: 1 });
ReferralSchema.index({ status: 1, createdAt: -1 });

// Ensure one referral per order (if orderId is provided)
// This unique index also serves as a regular index for orderId queries
ReferralSchema.index(
  { orderId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { isDeleted: false } }
);

export const Referrals = mongoose.model<IReferral>(
  "referrals",
  ReferralSchema
);

