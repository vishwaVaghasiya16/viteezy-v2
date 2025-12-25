import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import {
  UserRole,
  USER_ROLE_VALUES,
  Gender,
  GENDER_VALUES,
  MembershipStatus,
  MEMBERSHIP_STATUS_VALUES,
  SessionStatus,
  SESSION_STATUS_VALUES,
} from "../enums";

export interface IUserSessionInfo {
  sessionId: string;
  status: SessionStatus;
  revoked: boolean;
  deviceInfo?: string;
}

export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode?: string;
  password: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  avatar?: string;
  profileImage?: string;
  gender?: Gender;
  age?: number;
  language?: string; // User's preferred language (default: "English")
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
  registeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [1, "First name must be at least 1 character long"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: false, // Optional for social logins (Apple, Google)
      trim: true,
      default: "",
      maxlength: [50, "Last name cannot exceed 50 characters"],
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
      default: null,
    },
    countryCode: {
      type: String,
      trim: true,
      default: null,
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
    language: {
      type: String,
      trim: true,
      default: "English",
      enum: [
        "English",
        "Dutch",
        "German",
        "French",
        "Spanish",
        "Italian",
        "Portuguese",
      ],
    },
    registeredAt: {
      type: Date,
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
      default: MembershipStatus.NONE, // New users haven't purchased membership yet
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
          enum: SESSION_STATUS_VALUES,
          default: SessionStatus.ACTIVE,
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

// Set registeredAt to createdAt if not already set (for new users)
userSchema.pre("save", function (next) {
  // Only set registeredAt if it's a new document and registeredAt is not set
  if (this.isNew && !this.registeredAt) {
    this.registeredAt = new Date();
  }
  next();
});

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
