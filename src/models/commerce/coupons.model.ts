import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  PriceSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  AuditType,
} from "../common.model";
import { CouponType, COUPON_TYPE_VALUES } from "../enums";

export interface ICoupon extends Document, AuditType {
  code: string;
  name: I18nStringType;
  description: I18nStringType;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  userUsageLimit?: number;
  applicableProducts: mongoose.Types.ObjectId[];
  applicableCategories: mongoose.Types.ObjectId[];
  excludedProducts: mongoose.Types.ObjectId[];
  validFrom?: Date;
  validUntil?: Date;
  isActive: boolean;
  isRecurring?: boolean;
  oneTimeUse?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [1, "Coupon code must be at least 1 character"],
      maxlength: [50, "Coupon code cannot exceed 50 characters"],
    },
    name: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nString,
      default: () => ({}),
    },
    type: {
      type: String,
      required: [true, "Coupon type is required"],
      enum: COUPON_TYPE_VALUES,
    },
    value: {
      type: Number,
      required: [true, "Coupon value is required"],
      min: [0, "Coupon value must be greater than or equal to 0"],
      validate: {
        validator: function (this: ICoupon, value: number) {
          // For percentage type, value should be between 0 and 100
          if (this.type === CouponType.PERCENTAGE) {
            return value >= 0 && value <= 100;
          }
          return value >= 0;
        },
        message: "Percentage coupon value must be between 0 and 100",
      },
    },
    minOrderAmount: {
      type: Number,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    userUsageLimit: {
      type: Number,
      min: 1,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    excludedProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
      },
    ],
    validFrom: {
      type: Date,
    },
    validUntil: {
      type: Date,
      validate: {
        validator: function (this: ICoupon, value: Date) {
          // If both validFrom and validUntil are set, validUntil must be after validFrom
          if (this.validFrom && value) {
            return value > this.validFrom;
          }
          return true;
        },
        message: "Valid until date must be after valid from date",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
      description: "If true, coupon can be used again on subscription renewals",
    },
    oneTimeUse: {
      type: Boolean,
      default: false,
      description:
        "If true, customer can use this coupon only once in their lifetime",
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save validation hook
CouponSchema.pre("save", function (next) {
  // Validate percentage value
  if (
    this.type === CouponType.PERCENTAGE &&
    (this.value < 0 || this.value > 100)
  ) {
    return next(new Error("Percentage coupon value must be between 0 and 100"));
  }

  // Validate date range
  if (this.validFrom && this.validUntil && this.validUntil <= this.validFrom) {
    return next(new Error("Valid until date must be after valid from date"));
  }

  // Validate maxDiscountAmount for percentage coupons
  if (
    this.type === CouponType.PERCENTAGE &&
    this.maxDiscountAmount &&
    this.maxDiscountAmount < 0
  ) {
    return next(new Error("Max discount amount cannot be negative"));
  }

  next();
});

// Indexes
CouponSchema.index({ code: 1, isActive: 1 });
CouponSchema.index({ validFrom: 1, validUntil: 1, isActive: 1 });
CouponSchema.index({ applicableProducts: 1 });
CouponSchema.index({ applicableCategories: 1 });
CouponSchema.index({ isDeleted: 1, isActive: 1 }); // For soft delete queries

export const Coupons = mongoose.model<ICoupon>("coupons", CouponSchema);
