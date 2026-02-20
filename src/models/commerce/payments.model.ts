import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  AuditSchema,
  SoftDelete,
  PriceType,
} from "../common.model";
import {
  PaymentMethod,
  PaymentStatus,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../enums";

export interface IPayment extends Document {
  orderId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId; // For subscription renewal payments
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amount: PriceType;
  currency: string;
  transactionId?: string;
  gatewayTransactionId?: string;
  gatewaySessionId?: string;
  gatewayResponse?: Record<string, any>;
  failureReason?: string;
  refundAmount?: PriceType;
  refundReason?: string;
  refundedAt?: Date;
  processedAt?: Date;
  membershipId?: mongoose.Types.ObjectId;
  isRenewalPayment?: boolean; // Flag to identify renewal payments
  renewalCycleNumber?: number; // Which renewal cycle this payment is for
  metadata?: Record<string, any>; // Additional metadata for payments
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
      default: null,
    },
    membershipId: {
      type: Schema.Types.ObjectId,
      ref: "memberships",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      default: null,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PaymentStatus.PENDING,
    },
    amount: {
      type: PriceSchema,
      default: null,
    },
    currency: {
      type: String,
      uppercase: true,
      default: null,
    },
    transactionId: {
      type: String,
      trim: true,
      sparse: true,
      default: null,
    },
    gatewayTransactionId: {
      type: String,
      trim: true,
      default: null,
    },
    gatewaySessionId: {
      type: String,
      trim: true,
      default: null,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },
    failureReason: {
      type: String,
      trim: true,
      default: null,
    },
    refundAmount: {
      type: PriceSchema,
      default: null,
    },
    refundReason: {
      type: String,
      trim: true,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    isRenewalPayment: {
      type: Boolean,
      default: false,
    },
    renewalCycleNumber: {
      type: Number,
      default: null,
      min: 1,
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
PaymentSchema.index({ orderId: 1, status: 1 });
PaymentSchema.index({ subscriptionId: 1, status: 1 });
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ paymentMethod: 1, status: 1 });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ gatewaySessionId: 1 });
PaymentSchema.index({ membershipId: 1, status: 1 });
PaymentSchema.index({ isRenewalPayment: 1, createdAt: -1 });
PaymentSchema.index({ createdAt: -1 });

export const Payments = mongoose.model<IPayment>("payments", PaymentSchema);
