import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { AuditSchema, SoftDelete } from "../common.model";
import {
  OTPType,
  OTPStatus,
  OTP_STATUS_VALUES,
  OTP_TYPE_VALUES,
} from "../enums";

export interface IOTP extends Document {
  userId: mongoose.Types.ObjectId;
  email?: string;
  phone?: string;
  otpHash: string; // Changed from otp to otpHash for security
  type: OTPType;
  status: OTPStatus;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  compareOTP(candidateOTP: string): Promise<boolean>;
  isExpired(): boolean;
  canAttempt(): boolean;
}

const OTPSchema = new Schema<IOTP>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    otpHash: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: OTP_TYPE_VALUES,
    },
    status: {
      type: String,
      enum: OTP_STATUS_VALUES,
      default: OTPStatus.PENDING,
    },
    expiresAt: {
      type: Date,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
    },
    verifiedAt: {
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

// Pre-save middleware to hash OTP
OTPSchema.pre("save", async function (next) {
  if (!this.isModified("otpHash")) return next();

  try {
    // If otpHash is not already hashed (length < 60), hash it
    if (this.otpHash.length < 60) {
      const salt = await bcrypt.genSalt(12);
      this.otpHash = await bcrypt.hash(this.otpHash, salt);
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance methods
OTPSchema.methods.compareOTP = async function (
  candidateOTP: string
): Promise<boolean> {
  return bcrypt.compare(candidateOTP, this.otpHash);
};

OTPSchema.methods.isExpired = function (): boolean {
  return new Date() > this.expiresAt;
};

OTPSchema.methods.canAttempt = function (): boolean {
  return this.attempts < this.maxAttempts && this.status === "pending";
};

// Static method to create OTP with hashing
OTPSchema.statics.createOTP = async function (otpData: any) {
  const otp = new this(otpData);
  await otp.save();
  return otp;
};

// Indexes
OTPSchema.index({ userId: 1, type: 1, status: 1 });
OTPSchema.index({ email: 1, type: 1, status: 1 });
OTPSchema.index({ phone: 1, type: 1, status: 1 });
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OTPSchema.index({ otpHash: 1, status: 1 });

export const OTP = mongoose.model<IOTP>("otp", OTPSchema);
