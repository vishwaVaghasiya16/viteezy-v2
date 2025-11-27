import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";
import { PostponementStatus, POSTPONEMENT_STATUS_VALUES } from "../enums";

export interface IDeliveryPostponement extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  originalDeliveryDate: Date;
  requestedDeliveryDate: Date;
  reason?: string;
  status: PostponementStatus;
  adminNotes?: string;
  processedAt?: Date;
  processedBy?: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryPostponementSchema = new Schema<IDeliveryPostponement>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    originalDeliveryDate: {
      type: Date,
      required: true,
    },
    requestedDeliveryDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: POSTPONEMENT_STATUS_VALUES,
      default: PostponementStatus.PENDING,
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    processedAt: {
      type: Date,
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
DeliveryPostponementSchema.index({ userId: 1, status: 1 });
DeliveryPostponementSchema.index({ orderId: 1, status: 1 });
DeliveryPostponementSchema.index({ requestedDeliveryDate: 1 });
DeliveryPostponementSchema.index({ createdAt: -1 });

export const DeliveryPostponements = mongoose.model<IDeliveryPostponement>(
  "delivery_postponements",
  DeliveryPostponementSchema
);
