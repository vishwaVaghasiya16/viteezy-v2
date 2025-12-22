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
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  ORDER_PLAN_TYPE_VALUES,
} from "../enums";

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  status: OrderStatus;
  planType: OrderPlanType;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    price: PriceType;
    name: string;
    sku?: string;
  }>;
  subtotal: PriceType;
  tax: PriceType;
  shipping: PriceType;
  discount: PriceType;
  couponDiscount: PriceType;
  membershipDiscount: PriceType;
  subscriptionPlanDiscount: PriceType;
  total: PriceType;
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
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
        },
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "product_variants",
        },
        quantity: {
          type: Number,
          min: 1,
        },
        price: {
          type: PriceSchema,
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
    subtotal: {
      type: PriceSchema,
      default: null,
    },
    tax: {
      type: PriceSchema,
      default: null,
    },
    shipping: {
      type: PriceSchema,
      default: null,
    },
    discount: {
      type: PriceSchema,
      default: null,
    },
    couponDiscount: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    membershipDiscount: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    subscriptionPlanDiscount: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    total: {
      type: PriceSchema,
      default: null,
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
