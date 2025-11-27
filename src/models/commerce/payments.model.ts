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
  orderId: mongoose.Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
    },
    membershipId: {
      type: Schema.Types.ObjectId,
      ref: "memberships",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PaymentStatus.PENDING,
    },
    amount: {
      type: PriceSchema,
    },
    currency: {
      type: String,
      uppercase: true,
    },
    transactionId: {
      type: String,
      trim: true,
      sparse: true,
    },
    gatewayTransactionId: {
      type: String,
      trim: true,
    },
    gatewaySessionId: {
      type: String,
      trim: true,
    },
    gatewayResponse: {
      type: Schema.Types.Mixed,
      default: {},
    },
    failureReason: {
      type: String,
      trim: true,
    },
    refundAmount: {
      type: PriceSchema,
    },
    refundReason: {
      type: String,
      trim: true,
    },
    refundedAt: {
      type: Date,
    },
    processedAt: {
      type: Date,
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
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ paymentMethod: 1, status: 1 });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ gatewaySessionId: 1 });
PaymentSchema.index({ membershipId: 1, status: 1 });
PaymentSchema.index({ createdAt: -1 });

export const Payments = mongoose.model<IPayment>("payments", PaymentSchema);
