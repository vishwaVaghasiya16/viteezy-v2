import mongoose, { Schema, Document, Types } from "mongoose";
import { ReminderHistoryEventType, ReminderTriggeredBy } from "../enums";

export interface IReminderHistory extends Document {
  reminderId: Types.ObjectId;
  userId: Types.ObjectId;
  eventType: ReminderHistoryEventType;
  oldValue?: any;
  newValue?: any;
  message: string;
  triggeredBy: ReminderTriggeredBy;
  createdAt: Date;
}

const ReminderHistorySchema = new Schema<IReminderHistory>(
  {
    reminderId: {
      type: Schema.Types.ObjectId,
      ref: "Reminder",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(ReminderHistoryEventType),
      required: true,
    },
    oldValue: {
      type: Schema.Types.Mixed,
    },
    newValue: {
      type: Schema.Types.Mixed,
    },
    message: {
      type: String,
      required: true,
    },
    triggeredBy: {
      type: String,
      enum: Object.values(ReminderTriggeredBy),
      required: true,
      default: ReminderTriggeredBy.USER,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // UpdatedAt is disabled for immutability
  }
);

// Index for chronological retrieval
ReminderHistorySchema.index({ reminderId: 1, createdAt: -1 });

/**
 * Immutability Middleware
 * Throws error on any attempt to update or delete a history record.
 */
const preventModification = function (next: any) {
  const error = new Error("ReminderHistory records are immutable and cannot be modified or deleted.");
  next(error);
};

ReminderHistorySchema.pre("save", function (next) {
  if (!this.isNew) {
    return preventModification(next);
  }
  next();
});

ReminderHistorySchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "findOneAndDelete", "deleteOne", "deleteMany" as any], preventModification);

export const ReminderHistory = mongoose.model<IReminderHistory>(
  "ReminderHistory",
  ReminderHistorySchema
);
