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
  orderType?: "NORMAL" | "SUBSCRIPTION_INITIAL" | "SUBSCRIPTION_RENEWAL";
  subscriptionId?: mongoose.Types.ObjectId | null;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    name: string;
    variantType: ProductVariant; // Variant type for this item (SACHETS or STAND_UP_POUCH)
    quantity?: number; // Quantity for STAND_UP_POUCH items (default: 1)
    planDays?: number; // Plan days for this specific item (SACHETS subscription)
    capsuleCount?: number; // Capsule count for this specific item (STAND_UP_POUCH)
    // Additional pricing and plan details
    amount: number; // Original amount per unit
    discountedPrice: number; // Discounted price per unit
    taxRate: number; // Tax rate per unit
    totalAmount: number; // Total amount (amount * quantity)
    durationDays?: number; // Duration in days (for subscription plans)
    savingsPercentage?: number; // Savings percentage
    features?: string[]; // Plan features
  }>;
  // Pricing breakdown by variant type
  pricing?: {
    sachets?: {
      subTotal: number;
      discountedPrice: number;
      membershipDiscountAmount: number;
      subscriptionPlanDiscountAmount: number;
      taxAmount: number;
      total: number;
      currency: string;
    };
    standUpPouch?: {
      subTotal: number;
      discountedPrice: number;
      membershipDiscountAmount: number;
      taxAmount: number;
      total: number;
      currency: string;
    };
    overall: {
      subTotal: number;
      discountedPrice: number;
      couponDiscountAmount: number;
      membershipDiscountAmount: number;
      subscriptionPlanDiscountAmount: number;
      taxAmount: number;
      grandTotal: number;
      currency: string;
    };
  };
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
    orderType: {
      type: String,
      enum: ["NORMAL", "SUBSCRIPTION_INITIAL", "SUBSCRIPTION_RENEWAL"],
      default: "NORMAL",
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
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
        variantType: {
          type: String,
          enum: Object.values(ProductVariant),
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
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
    pricing: {
      type: {
        sachets: {
          type: {
            subTotal: { type: Number, default: 0 },
            discountedPrice: { type: Number, default: 0 },
            membershipDiscountAmount: { type: Number, default: 0 },
            subscriptionPlanDiscountAmount: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            currency: { type: String, default: "USD" },
          },
          required: false,
        },
        standUpPouch: {
          type: {
            subTotal: { type: Number, default: 0 },
            discountedPrice: { type: Number, default: 0 },
            membershipDiscountAmount: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            total: { type: Number, default: 0 },
            currency: { type: String, default: "USD" },
          },
          required: false,
        },
        overall: {
          type: {
            subTotal: { type: Number, default: 0 },
            discountedPrice: { type: Number, default: 0 },
            couponDiscountAmount: { type: Number, default: 0 },
            membershipDiscountAmount: { type: Number, default: 0 },
            subscriptionPlanDiscountAmount: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            grandTotal: { type: Number, default: 0 },
            currency: { type: String, default: "USD" },
          },
          required: true,
        },
      },
      required: false,
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
