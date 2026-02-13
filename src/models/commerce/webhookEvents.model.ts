import mongoose, { Schema, Document } from "mongoose";
import { PaymentMethod } from "../enums";
import { AuditSchema, SoftDelete } from "../common.model";

export interface IWebhookEvent extends Document {
  eventId: string; // Gateway event ID (Stripe event.id, Mollie payment.id, etc.)
  gateway: PaymentMethod; // Payment gateway
  eventType: string; // Event type (invoice.paid, invoice.payment_failed, etc.)
  processed: boolean; // Whether this event has been processed
  processedAt?: Date; // When the event was processed
  payload: Record<string, any>; // Full event payload
  error?: string; // Error message if processing failed
  retryCount: number; // Number of retry attempts
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    gateway: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    processed: {
      type: Boolean,
      default: false,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    error: {
      type: String,
      trim: true,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Compound index for efficient lookups
WebhookEventSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
WebhookEventSchema.index({ processed: 1, createdAt: -1 });
WebhookEventSchema.index({ eventType: 1, processed: 1 });

export const WebhookEvents = mongoose.model<IWebhookEvent>(
  "webhookEvents",
  WebhookEventSchema
);

