import mongoose, { Schema, Document, Model } from "mongoose";
import {
  SUBSCRIPTION_PLAN_STATUS_VALUE,
  SubscriptionPlanStatusEnum,
} from "../enums";

/**
 * Subscription Plan document interface
 */
export interface ISubscriptionPlan extends Document {
  title: string;
  durationInDays: number;
  status: SubscriptionPlanStatusEnum;
  hasDiscount: boolean;
  discountPercentage?: number | null;
  freeShipping: boolean;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Subscription Plan schema
 */
const subscriptionPlanSchema: Schema<ISubscriptionPlan> = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: SUBSCRIPTION_PLAN_STATUS_VALUE,
      default: SubscriptionPlanStatusEnum.ACTIVE,
      index: true,
    },

    // --- Discount management ---
    hasDiscount: {
      type: Boolean,
      default: false,
    },

    discountPercentage: {
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },

    // --- Benefits ---
    freeShipping: {
      type: Boolean,
      default: false,
    },

    // --- Soft Delete ---
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Conditional validation
 * discountPercentage required only when hasDiscount === true
 */
subscriptionPlanSchema.pre("save", function (next) {
  if (this.hasDiscount && !this.discountPercentage) {
    return next(
      new Error("discountPercentage is required when hasDiscount is enabled")
    );
  }

  if (!this.hasDiscount) {
    this.discountPercentage = null;
  }

  next();
});

const SubscriptionPlanModel: Model<ISubscriptionPlan> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlan>("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlanModel;
