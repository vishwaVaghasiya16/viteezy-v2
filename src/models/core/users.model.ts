import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import {
  UserRole,
  USER_ROLE_VALUES,
  Gender,
  GENDER_VALUES,
  MembershipStatus,
  MEMBERSHIP_STATUS_VALUES,
} from "../enums";

export interface IUserSessionInfo {
  sessionId: string;
  status: "Active" | "Revoked";
  revoked: boolean;
  deviceInfo?: string;
}

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  avatar?: string;
  profileImage?: string;
  gender?: Gender;
  age?: number;
  memberId?: string; // Unique member ID (e.g., MEM-A9XK72QD)
  isMember?: boolean;
  membershipStatus?: MembershipStatus;
  membershipPlanId?: Schema.Types.ObjectId;
  membershipExpiresAt?: Date;
  membershipActivatedAt?: Date;
  lastLogin?: Date;
  sessionIds?: IUserSessionInfo[];
  passwordResetToken?: string;
  passwordResetTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[1-9]\d{1,14}$/, "Please enter a valid phone number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
      trim: true,
    },
    gender: {
      type: String,
      enum: GENDER_VALUES,
      default: null,
    },
    age: {
      type: Number,
      min: [1, "Age must be at least 1"],
      max: [150, "Age cannot exceed 150"],
      default: null,
    },
    memberId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
      trim: true,
      uppercase: true,
      match: [/^MEM-[A-Z0-9]{8}$/, "Invalid member ID format"],
      // Note: unique: true automatically creates an index, so index: true is not needed
    },
    isMember: {
      type: Boolean,
      default: false,
    },
    membershipStatus: {
      type: String,
      enum: MEMBERSHIP_STATUS_VALUES,
      default: MembershipStatus.EXPIRED,
    },
    membershipPlanId: {
      type: Schema.Types.ObjectId,
      ref: "membership_plans",
    },
    membershipExpiresAt: {
      type: Date,
    },
    membershipActivatedAt: {
      type: Date,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    sessionIds: [
      {
        sessionId: { type: String, required: true },
        status: {
          type: String,
          enum: ["Active", "Revoked"],
          default: "Active",
        },
        revoked: { type: Boolean, default: false },
        deviceInfo: { type: String, trim: true },
      },
    ],
    passwordResetToken: {
      type: String,
      select: false, // Don't include in queries by default
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export const User = mongoose.model<IUser>("User", userSchema);
