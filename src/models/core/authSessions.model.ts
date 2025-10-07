import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

export interface IAuthSession extends Document {
  userId: mongoose.Types.ObjectId;
  deviceInfo?: string;
  ip?: string;
  userAgent?: string;
  jwtId: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuthSessionSchema = new Schema<IAuthSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
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
    jwtId: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revoked: {
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
AuthSessionSchema.index({ userId: 1, revoked: 1 });
AuthSessionSchema.index({ jwtId: 1 });
AuthSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AuthSessionSchema.index({ userId: 1, lastUsedAt: -1 });

export const AuthSessions = mongoose.model<IAuthSession>(
  "auth_sessions",
  AuthSessionSchema
);
