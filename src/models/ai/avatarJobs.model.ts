import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  MediaSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  MediaType,
} from "../common.model";
import {
  AIJobType,
  AIJobStatus,
  AI_JOB_TYPE_VALUES,
  AI_JOB_STATUS_VALUES,
} from "../enums";

export interface IAvatarJob extends Document {
  userId: mongoose.Types.ObjectId;
  jobType: AIJobType;
  prompt: string;
  style?: string;
  status: AIJobStatus;
  result?: {
    imageUrl: string;
    thumbnailUrl?: string;
    metadata?: Record<string, any>;
  };
  error?: {
    message: string;
    code?: string;
  };
  processingTime?: number; // in milliseconds
  createdAt: Date;
  updatedAt: Date;
}

const AvatarJobSchema = new Schema<IAvatarJob>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    jobType: {
      type: String,
      enum: AI_JOB_TYPE_VALUES,
      required: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    style: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: AI_JOB_STATUS_VALUES,
      default: AIJobStatus.PENDING,
    },
    result: {
      imageUrl: { type: String, trim: true },
      thumbnailUrl: { type: String, trim: true },
      metadata: { type: Schema.Types.Mixed, default: {} },
    },
    error: {
      message: { type: String, trim: true },
      code: { type: String, trim: true },
    },
    processingTime: {
      type: Number,
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

// Indexes for better performance
AvatarJobSchema.index({ userId: 1, status: 1 });
AvatarJobSchema.index({ jobType: 1, status: 1 });
AvatarJobSchema.index({ createdAt: -1 });

export const AvatarJobs = mongoose.model<IAvatarJob>(
  "avatar_jobs",
  AvatarJobSchema
);
