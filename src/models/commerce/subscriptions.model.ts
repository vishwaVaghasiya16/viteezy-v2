import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  AuditSchema,
  SoftDelete,
  PriceType,
} from "../common.model";
import {
  SubscriptionStatus,
  SubscriptionCycle,
  PaymentMethod,
  SUBSCRIPTION_STATUS_VALUES,
  SUBSCRIPTION_CYCLE_VALUES,
  PAYMENT_METHOD_VALUES,
} from "../enums";

export interface ISubscription extends Document {
  subscriptionNumber: string;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId; // Initial order that created this subscription
  status: SubscriptionStatus;
  cycleDays: SubscriptionCycle; // 60, 90, or 180 days
  items: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    price: PriceType;
    name: string;
    sku?: string;
  }>;
  amount: PriceType; // Recurring billing amount
  // Payment Gateway Information
  paymentMethod: PaymentMethod;
  gatewaySubscriptionId?: string; // Stripe subscription ID or Mollie subscription ID
  gatewayCustomerId?: string; // Customer ID in payment gateway
  gatewayPaymentMethodId?: string; // Saved payment method ID
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
  // Metadata
  metadata?: Record<string, any>;
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
    cycleDays: {
      type: Number,
      enum: SUBSCRIPTION_CYCLE_VALUES,
      required: true,
      validate: {
        validator: function (value: number) {
          // Only allow 60, 90, or 180 days (30 is disabled)
          return [60, 90, 180].includes(value);
        },
        message: "Cycle days must be 60, 90, or 180",
      },
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
          required: true,
        },
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "product_variants",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: PriceSchema,
          required: true,
        },
        name: {
          type: String,
          trim: true,
          default: null,
        },
        sku: {
          type: String,
          trim: true,
          default: null,
        },
      },
    ],
    amount: {
      type: PriceSchema,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
    },
    gatewaySubscriptionId: {
      type: String,
      trim: true,
      default: null,
      // Note: sparse and unique are handled in schema.index() below
    },
    gatewayCustomerId: {
      type: String,
      trim: true,
      default: null,
    },
    gatewayPaymentMethodId: {
      type: String,
      trim: true,
      default: null,
    },
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
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
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
SubscriptionSchema.index(
  { gatewaySubscriptionId: 1 },
  { unique: true, sparse: true }
);
SubscriptionSchema.index({ createdAt: -1 });

export const Subscriptions = mongoose.model<ISubscription>(
  "subscriptions",
  SubscriptionSchema
);
