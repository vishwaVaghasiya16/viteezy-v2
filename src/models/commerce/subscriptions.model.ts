import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";
import {
  SubscriptionStatus,
  SubscriptionCycle,
  OrderPlanType,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_CYCLE_VALUES,
  ORDER_PLAN_TYPE_VALUES,
} from "../enums";

export interface ISubscriptionActivity {
  action: "pause" | "cancel" | "resume" | "status-update";
  performedBy?: mongoose.Types.ObjectId;
  performedByRole?: "User" | "Admin" | "System";
  reason?: string;
  fromStatus?: SubscriptionStatus;
  toStatus?: SubscriptionStatus;
  planCycleDays?: number;
  planPriceTotal?: number;
  planCurrency?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ISubscription extends Document {
  subscriptionNumber: string;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId; // Initial order that created this subscription
  status: SubscriptionStatus;
  planType: OrderPlanType; // Plan type (One-Time or Subscription)
  cycleDays: SubscriptionCycle; // 60, 90, or 180 days
  subscriptionStartDate: Date; // Subscription start date
  subscriptionEndDate?: Date; // Subscription end date
  items: Array<{
    productId: mongoose.Types.ObjectId;
    name: string;
    planDays?: number; // Plan days for this specific item
    capsuleCount?: number; // Capsule count for this specific item
    // Additional pricing and plan details
    amount: number; // Original amount
    discountedPrice: number; // Discounted price
    taxRate: number; // Tax rate
    totalAmount: number; // Total amount
    durationDays?: number; // Duration in days (for subscription plans)
    savingsPercentage?: number; // Savings percentage
    features?: string[]; // Plan features
  }>;
  // Delivery & Billing Dates
  initialDeliveryDate: Date; // First shipment date (immediate)
  nextDeliveryDate: Date; // Next scheduled delivery
  nextBillingDate: Date; // Next billing/charge date
  lastBilledDate?: Date; // Last successful billing date
  lastDeliveredDate?: Date; // Last delivery date
  // Cancellation
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId; // User or admin who cancelled
  cancellationReason?: string;
  // Pause/Resume
  pausedAt?: Date;
  pausedUntil?: Date; // Resume date if paused temporarily
  // Auto-Renewal
  isAutoRenew: boolean; // Auto-renew subscription until cancelled or paused
  renewalCount: number; // Number of times subscription has been renewed
  // Gateway Integration
  gateway?: "stripe" | "mollie";
  gatewaySubscriptionId?: string; // Stripe/Mollie subscription ID
  gatewayCustomerId?: string; // Stripe/Mollie customer ID
  gatewayPaymentMethodId?: string; // Saved payment method ID
  cancelAtPeriodEnd?: boolean; // Cancel at end of current period
  retryCount?: number; // Number of payment retry attempts
  lastRetryDate?: Date; // Last payment retry date
  nextRetryDate?: Date; // Next payment retry date
  // Pricing breakdown for SACHETS items only
  pricing?: {
    subTotal: number;
    discountedPrice: number;
    membershipDiscountAmount: number;
    subscriptionPlanDiscountAmount: number;
    taxAmount: number;
    total: number;
    currency: string;
  };
  // Metadata
  activePlanSnapshot?: any;
  metadata?: Record<string, any>;
  activityLog?: ISubscriptionActivity[];
  createdAt: Date;
  updatedAt: Date;
}

const generateSubscriptionNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `SUB-${timestamp}-${random}`;
};

const SubscriptionSchema = new Schema<ISubscription>(
  {
    subscriptionNumber: {
      type: String,
      unique: true,
      trim: true,
      default: generateSubscriptionNumber,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUS_VALUES,
      default: SubscriptionStatus.ACTIVE,
    },
    planType: {
      type: String,
      enum: ORDER_PLAN_TYPE_VALUES,
      required: true,
    },
    cycleDays: {
      type: Number,
      enum: SUBSCRIPTION_CYCLE_VALUES,
      required: true,
      validate: {
        validator: function (value: number) {
          // Allow 30, 60, 90, or 180 days
          return [30, 60, 90, 180].includes(value);
        },
        message: "Cycle days must be 30, 60, 90, or 180",
      },
    },
    subscriptionStartDate: {
      type: Date,
      required: true,
    },
    subscriptionEndDate: {
      type: Date,
      default: null,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        name: {
          type: String,
          trim: true,
          default: null,
        },
        planDays: {
          type: Number,
          default: null,
        },
        capsuleCount: {
          type: Number,
          default: null,
        },
        // Additional pricing and plan details
        amount: {
          type: Number,
          default: 0,
        },
        discountedPrice: {
          type: Number,
          default: 0,
        },
        taxRate: {
          type: Number,
          default: 0,
        },
        totalAmount: {
          type: Number,
          default: 0,
        },
        durationDays: {
          type: Number,
          default: null,
        },
        savingsPercentage: {
          type: Number,
          default: null,
        },
        features: {
          type: [String],
          default: [],
        },
      },
    ],
    initialDeliveryDate: {
      type: Date,
      required: true,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    lastBilledDate: {
      type: Date,
      default: null,
    },
    lastDeliveredDate: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    pausedUntil: {
      type: Date,
      default: null,
    },
    // Auto-Renewal
    isAutoRenew: {
      type: Boolean,
      default: true, // Default to auto-renew
    },
    renewalCount: {
      type: Number,
      default: 0, // Initial subscription is not a renewal
      min: 0,
    },
    // Gateway Integration
    gateway: {
      type: String,
      enum: ["stripe", "mollie"],
      default: null,
    },
    gatewaySubscriptionId: {
      type: String,
      trim: true,
      default: undefined, // Use undefined instead of null to avoid sparse index conflicts
      sparse: true,
    },
    gatewayCustomerId: {
      type: String,
      trim: true,
      default: null,
      sparse: true,
    },
    gatewayPaymentMethodId: {
      type: String,
      trim: true,
      default: null,
      sparse: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRetryDate: {
      type: Date,
      default: null,
    },
    nextRetryDate: {
      type: Date,
      default: null,
    },
    pricing: {
      type: {
        subTotal: { type: Number, default: 0 },
        discountedPrice: { type: Number, default: 0 },
        membershipDiscountAmount: { type: Number, default: 0 },
        subscriptionPlanDiscountAmount: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        currency: { type: String, default: "EUR" },
      },
      required: false,
    },
    activePlanSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    activityLog: [
      {
        action: {
          type: String,
          enum: ["pause", "cancel", "resume", "status-update"],
          required: true,
        },
        performedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        performedByRole: {
          type: String,
          enum: ["User", "Admin", "System"],
          default: "User",
        },
        reason: {
          type: String,
          trim: true,
          maxlength: 500,
          default: null,
        },
        fromStatus: {
          type: String,
          enum: SUBSCRIPTION_STATUS_VALUES,
          default: null,
        },
        toStatus: {
          type: String,
          enum: SUBSCRIPTION_STATUS_VALUES,
          default: null,
        },
        planCycleDays: {
          type: Number,
          enum: SUBSCRIPTION_CYCLE_VALUES,
          default: null,
        },
        planPriceTotal: {
          type: Number,
          default: null,
        },
        planCurrency: {
          type: String,
          default: null,
        },
        metadata: {
          type: Schema.Types.Mixed,
          default: () => ({}),
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    ...SoftDelete,
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for days until next delivery
SubscriptionSchema.virtual("daysUntilNextDelivery").get(function () {
  if (!this.nextDeliveryDate) return null;
  const now = new Date();
  const diff = this.nextDeliveryDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for days until next billing
SubscriptionSchema.virtual("daysUntilNextBilling").get(function () {
  if (!this.nextBillingDate) return null;
  const now = new Date();
  const diff = this.nextBillingDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for cycle count (how many cycles completed)
SubscriptionSchema.virtual("cycleCount").get(function () {
  if (!this.lastDeliveredDate || !this.initialDeliveryDate) return 0;
  const diff =
    this.lastDeliveredDate.getTime() - this.initialDeliveryDate.getTime();
  const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.floor(daysDiff / this.cycleDays);
});

// Indexes
SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ orderId: 1 });
SubscriptionSchema.index({ status: 1, nextBillingDate: 1 });
SubscriptionSchema.index({ status: 1, nextDeliveryDate: 1 });
// Sparse unique index: allows multiple null values, but ensures unique non-null values
SubscriptionSchema.index(
  { gatewaySubscriptionId: 1 },
  { sparse: true, unique: true }
);
SubscriptionSchema.index({ gatewayCustomerId: 1 }, { sparse: true });
SubscriptionSchema.index({ createdAt: -1 });

export const Subscriptions = mongoose.model<ISubscription>(
  "subscriptions",
  SubscriptionSchema
);
