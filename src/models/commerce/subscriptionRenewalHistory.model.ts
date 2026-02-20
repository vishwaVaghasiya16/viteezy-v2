import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete, PriceType } from "../common.model";
import { PaymentStatus, PAYMENT_STATUS_VALUES } from "../enums";

export interface ISubscriptionRenewalHistory extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  renewalNumber: number; // 1, 2, 3, etc. (first renewal = 1)
  previousBillingDate: Date; // Previous billing date before renewal
  newBillingDate: Date; // New billing date after renewal
  previousDeliveryDate: Date; // Previous delivery date before renewal
  newDeliveryDate: Date; // New delivery date after renewal
  paymentId: mongoose.Types.ObjectId; // Reference to payment for this renewal
  orderId?: mongoose.Types.ObjectId; // Reference to order created for renewal (if any)
  amount: PriceType; // Amount charged for this renewal
  status: PaymentStatus; // Payment status for this renewal
  renewalDate: Date; // When the renewal was processed
  failureReason?: string; // Reason if renewal failed
  retryCount: number; // Number of retry attempts for failed renewals
  nextRetryDate?: Date; // Next retry date if renewal failed
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionRenewalHistorySchema = new Schema<ISubscriptionRenewalHistory>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    renewalNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    previousBillingDate: {
      type: Date,
      required: true,
    },
    newBillingDate: {
      type: Date,
      required: true,
    },
    previousDeliveryDate: {
      type: Date,
      required: true,
    },
    newDeliveryDate: {
      type: Date,
      required: true,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "payments",
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },
    amount: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      required: true,
    },
    renewalDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextRetryDate: {
      type: Date,
      default: null,
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
SubscriptionRenewalHistorySchema.index({ subscriptionId: 1, renewalNumber: 1 });
SubscriptionRenewalHistorySchema.index({ subscriptionId: 1, createdAt: -1 });
SubscriptionRenewalHistorySchema.index({ userId: 1, createdAt: -1 }); 
SubscriptionRenewalHistorySchema.index({ paymentId: 1 });
SubscriptionRenewalHistorySchema.index({ status: 1, nextRetryDate: 1 });
SubscriptionRenewalHistorySchema.index({ createdAt: -1 });

export const SubscriptionRenewalHistory = mongoose.model<ISubscriptionRenewalHistory>(
  "subscription_renewal_history",
  SubscriptionRenewalHistorySchema
);

