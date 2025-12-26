import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  AuditSchema,
  SoftDelete,
  PriceType,
} from "../common.model";
import {
  OrderStatus,
  PaymentStatus,
  OrderPlanType,
  ProductVariant,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  ORDER_PLAN_TYPE_VALUES,
} from "../enums";

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  status: OrderStatus;
  planType: OrderPlanType;
  variantType?: ProductVariant; // Variant type selected by user (SACHETS or STAND_UP_POUCH)
  selectedPlanDays?: number; // Selected plan days (30, 60, 90, 180 for subscription)
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
  // Pricing stored as numbers with separate currency field
  subTotal: number; // Sum of all product amounts
  discountedPrice: number; // Discounted price after plan discounts
  couponDiscountAmount: number; // Coupon discount amount
  membershipDiscountAmount: number; // Membership discount amount
  subscriptionPlanDiscountAmount: number; // Subscription plan discount (e.g., 90-day 15% discount)
  taxAmount: number; // Tax amount
  grandTotal: number; // Final total after all discounts and tax
  currency: string; // Currency code (e.g., "EUR")
  shippingAddressId: mongoose.Types.ObjectId; // Reference to Address model
  billingAddressId?: mongoose.Types.ObjectId; // Reference to Address model
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  couponCode?: string;
  couponMetadata?: Record<string, any>;
  membershipMetadata?: Record<string, any>;
  notes?: string;
  metadata?: Record<string, any>;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: OrderStatus.PENDING,
    },
    planType: {
      type: String,
      enum: ORDER_PLAN_TYPE_VALUES,
      default: OrderPlanType.ONE_TIME,
    },
    variantType: {
      type: String,
      enum: Object.values(ProductVariant),
      default: null,
    },
    selectedPlanDays: {
      type: Number,
      default: null,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
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
    // Pricing stored as numbers with separate currency field
    subTotal: {
      type: Number,
      default: 0,
    },
    discountedPrice: {
      type: Number,
      default: 0,
    },
    couponDiscountAmount: {
      type: Number,
      default: 0,
    },
    membershipDiscountAmount: {
      type: Number,
      default: 0,
    },
    subscriptionPlanDiscountAmount: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "EUR",
      trim: true,
    },
    shippingAddressId: {
      type: Schema.Types.ObjectId,
      ref: "addresses",
      required: true,
    },
    billingAddressId: {
      type: Schema.Types.ObjectId,
      ref: "addresses",
      default: null,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PaymentStatus.PENDING,
    },
    paymentId: {
      type: String,
      trim: true,
      default: null,
    },
    couponCode: {
      type: String,
      trim: true,
      default: null,
    },
    couponMetadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    membershipMetadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    trackingNumber: {
      type: String,
      trim: true,
      default: null,
    },
    shippedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
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
OrderSchema.index({ userId: 1, status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ trackingNumber: 1 });
OrderSchema.index({ shippingAddressId: 1 });
OrderSchema.index({ billingAddressId: 1 });

export const Orders = mongoose.model<IOrder>("orders", OrderSchema);
