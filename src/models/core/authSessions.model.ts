import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

export interface IAuthSession extends Document {
  userId: mongoose.Types.ObjectId;
  deviceInfo?: string;
  ip?: string;
  userAgent?: string;
  sessionId: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    deviceInfo: {
      type: String,
      trim: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    sessionId: {
      type: String,
    },
    expiresAt: {
      type: Date,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
    },
    lastUsedAt: {
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
AuthSessionSchema.index({ userId: 1, isRevoked: 1 });
AuthSessionSchema.index({ sessionId: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ userId: 1, lastUsedAt: -1 });

export const AuthSessions = mongoose.model<IAuthSession>(
  "auth_sessions",
  AuthSessionSchema
);
