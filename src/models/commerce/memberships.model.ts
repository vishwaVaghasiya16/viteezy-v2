import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  PriceType,
  AuditSchema,
  SoftDelete,
} from "../common.model";
import {
  MembershipStatus,
  MembershipInterval,
  MEMBERSHIP_STATUS_VALUES,
  MEMBERSHIP_INTERVAL_VALUES,
  PaymentMethod,
  PAYMENT_METHOD_VALUES,
} from "../enums";

interface PlanSnapshot {
  planId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  interval: MembershipInterval;
  durationDays: number;
  price: PriceType;
  benefits?: string[];
}

export interface IMembership extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planSnapshot: PlanSnapshot;
  status: MembershipStatus;
  paymentMethod?: PaymentMethod;
  paymentId?: mongoose.Types.ObjectId;
  purchasedByUserId?: mongoose.Types.ObjectId;
  isAutoRenew: boolean;
  startedAt?: Date;
  expiresAt?: Date;
  nextBillingDate?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: "membership_plans",
      required: true,
      index: true,
    },
    planSnapshot: {
      planId: {
        type: Schema.Types.ObjectId,
        ref: "membership_plans",
        required: true,
      },
      name: { type: String, required: true },
      slug: { type: String, required: true },
      interval: {
        type: String,
        enum: MEMBERSHIP_INTERVAL_VALUES,
        required: true,
      },
      durationDays: { type: Number, required: true },
      price: { type: PriceSchema, required: true },
      benefits: [{ type: String, trim: true }],
    },
    status: {
      type: String,
      enum: MEMBERSHIP_STATUS_VALUES,
      default: MembershipStatus.PENDING,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "payments",
    },
    purchasedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    isAutoRenew: {
      type: Boolean,
      default: true,
    },
    startedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    nextBillingDate: {
      type: Date,
      index: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
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

MembershipSchema.index({ userId: 1, status: 1, expiresAt: 1 });
MembershipSchema.index({ planId: 1, status: 1 });

export const Memberships = mongoose.model<IMembership>(
  "memberships",
  MembershipSchema
);
