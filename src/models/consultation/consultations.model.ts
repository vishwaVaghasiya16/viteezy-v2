import mongoose, { Schema, Document } from "mongoose";
import {
  ConsultationStatus,
  PaymentMethod,
  PaymentStatus,
  Currency,
  CONSULTATION_STATUS_VALUES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUS_VALUES,
  CURRENCY_VALUES,
} from "../enums";

export interface IConsultation extends Document {
  bookingNo: string;
  userId: mongoose.Types.ObjectId;
  expertId: mongoose.Types.ObjectId;
  scheduledAt: Date;
  durationMins: number;
  status: ConsultationStatus;
  intakeForm: {
    goals: string;
    currentSupplements: string;
    notes: string;
  };
  payment: {
    provider: PaymentMethod;
    status: PaymentStatus;
    txnId?: string;
    amount: number;
    currency: Currency;
  };
  rescheduleHistory: Array<{
    from: Date;
    to: Date;
    at: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationSchema = new Schema<IConsultation>(
  {
    bookingNo: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    expertId: { type: Schema.Types.ObjectId, ref: "experts" },
    scheduledAt: { type: Date },
    durationMins: { type: Number, default: 30 },
    status: {
      type: String,
      enum: CONSULTATION_STATUS_VALUES,
      default: ConsultationStatus.BOOKED,
    },
    intakeForm: {
      goals: { type: String, trim: true },
      currentSupplements: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    payment: {
      provider: {
        type: String,
        enum: PAYMENT_METHOD_VALUES,
      },
      status: {
        type: String,
        enum: PAYMENT_STATUS_VALUES,
        default: PaymentStatus.PENDING,
      },
      txnId: {
        type: String,
        trim: true,
      },
      amount: {
        type: Number,
        min: 0,
      },
      currency: {
        type: String,
        default: Currency.EUR,
        uppercase: true,
        enum: CURRENCY_VALUES,
      },
    },
    rescheduleHistory: [
      {
        from: { type: Date },
        to: { type: Date },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// Indexes
ConsultationSchema.index({ bookingNo: 1 });
ConsultationSchema.index({ userId: 1, status: 1 });
ConsultationSchema.index({ expertId: 1, scheduledAt: 1 });
ConsultationSchema.index({ scheduledAt: 1 });
ConsultationSchema.index({ status: 1 });

export const Consultations = mongoose.model<IConsultation>(
  "consultations",
  ConsultationSchema
);
