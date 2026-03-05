import mongoose, { Schema } from "mongoose";
import { Document, Types } from "mongoose";

export interface IReminder extends Document {
  reminderSetBy: Types.ObjectId;
  time: string;
  note: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    reminderSetBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    time: {
      type: String,
      required: true,
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Reminders = mongoose.model<IReminder>(
  "Reminder",
  ReminderSchema
);