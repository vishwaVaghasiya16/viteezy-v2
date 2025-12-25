import mongoose, { Schema, Document } from "mongoose";
import { PriceSchema, PriceType, AuditSchema } from "../common.model";

/**
 * Coupon Usage History Interface
 * Tracks coupon usage by users after successful payment and order placement
 */
export interface ICouponUsageHistory extends Document {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  usageCount: number; // Incremental count if the same user uses the same coupon multiple times
  discountAmount: PriceType; // The actual discount amount received by the user
  couponCode: string; // Store coupon code for easy reference
  orderNumber?: string; // Store order number for easy reference
  createdAt: Date;
  updatedAt: Date;
}

const CouponUsageHistorySchema = new Schema<ICouponUsageHistory>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: "coupons",
      required: [true, "Coupon ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: [true, "Order ID is required"],
      index: true,
    },
    usageCount: {
      type: Number,
      required: true,
      min: [1, "Usage count must be at least 1"],
      default: 1,
    },
    discountAmount: {
      type: PriceSchema,
      required: [true, "Discount amount is required"],
    },
    couponCode: {
      type: String,
      required: [true, "Coupon code is required"],
      uppercase: true,
      trim: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      default: null,
    },
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
CouponUsageHistorySchema.index({ couponId: 1, userId: 1 });
CouponUsageHistorySchema.index({ userId: 1, createdAt: -1 });
CouponUsageHistorySchema.index({ couponId: 1, createdAt: -1 });

// Virtual to populate coupon details
CouponUsageHistorySchema.virtual("coupon", {
  ref: "coupons",
  localField: "couponId",
  foreignField: "_id",
  justOne: true,
});

// Virtual to populate user details
CouponUsageHistorySchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

// Virtual to populate order details
CouponUsageHistorySchema.virtual("order", {
  ref: "orders",
  localField: "orderId",
  foreignField: "_id",
  justOne: true,
});

export const CouponUsageHistory = mongoose.model<ICouponUsageHistory>(
  "coupon_usage_history",
  CouponUsageHistorySchema
);
