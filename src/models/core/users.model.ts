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
  referralCode?: string; // Unique referral code (e.g., JOHN12345)
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
  // Push notification device tokens with metadata
  deviceTokens?: string[]; // Array of device tokens (backward compatibility)
  deviceTokenMetadata?: Array<{
    token: string;
    platform: "mobile" | "web";
    provider: "onesignal" | "firebase";
    addedAt?: Date;
  }>; // Device tokens with platform and provider info
  // Family member fields
  isSubMember?: boolean; // Indicates if this is a family/sub-member
  parentMemberId?: Schema.Types.ObjectId; // Reference to parent/main member
  relationshipToParent?: string; // e.g., "Child", "Spouse", "Parent", "Sibling", "Other"
  parentId?: Schema.Types.ObjectId; // Parent user ID for sub-members
  // Soft delete fields
  isDeleted?: boolean;
  deletedAt?: Date;
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
      required: function (this: IUser) {
        // Email is not required for sub-members (family members)
        return !this.isSubMember;
      },
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
      default: null,
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
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but ensure uniqueness when present
      trim: true,
      uppercase: true,
      index: true,
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
    // Push notification device tokens (backward compatibility)
    deviceTokens: {
      type: [String],
      default: [],
      select: false, // Don't include in queries by default for security
    },
    // Device tokens with metadata (platform and provider)
    deviceTokenMetadata: {
      type: [
        {
          token: {
            type: String,
            required: true,
            trim: true,
          },
          platform: {
            type: String,
            enum: ["mobile", "web"],
            required: true,
          },
          provider: {
            type: String,
            enum: ["onesignal", "firebase"],
            required: true,
          },
          addedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
      select: false, // Don't include in queries by default for security
    },
    // Family member fields
    isSubMember: {
      type: Boolean,
      default: false,
    },
    parentMemberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    relationshipToParent: {
      type: String,
      enum: ["Child", "Spouse", "Parent", "Sibling", "Other"],
      default: null,
    },
    // Soft delete fields
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
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
userSchema.index({ parentMemberId: 1 }); // Index for family member queries

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

// Pre-save hook for memberId generation
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.memberId) {
    try {
      // Inline memberId generation to avoid circular dependency
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        let result = 'MEM-';
        for (let i = 0; i < 7; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const existing = await User.findOne({ memberId: result });
        if (!existing) {
          this.memberId = result;
          return next();
        }
        
        attempts++;
      }
      
      throw new Error('Failed to generate unique member ID');
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export const User = mongoose.model<IUser>("User", userSchema);
