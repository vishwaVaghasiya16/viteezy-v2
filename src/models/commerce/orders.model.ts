import mongoose, { Schema, Document } from "mongoose";
import {
  AddressSnapshotSchema,
  PriceSchema,
  AuditSchema,
  SoftDelete,
  AddressSnapshotType,
  PriceType,
} from "../common.model";
import {
  OrderStatus,
  PaymentStatus,
  ORDER_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../enums";

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  status: OrderStatus;
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
  total: PriceType;
  shippingAddress: AddressSnapshotType;
  billingAddress: AddressSnapshotType;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentId?: string;
  couponCode?: string;
  notes?: string;
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
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    status: {
      type: String,
      enum: ORDER_STATUS_VALUES,
      default: OrderStatus.PENDING,
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
        },
        sku: {
          type: String,
          trim: true,
        },
      },
    ],
    subtotal: {
      type: PriceSchema,
    },
    tax: {
      type: PriceSchema,
    },
    shipping: {
      type: PriceSchema,
    },
    discount: {
      type: PriceSchema,
    },
    total: {
      type: PriceSchema,
    },
    shippingAddress: {
      type: AddressSnapshotSchema,
    },
    billingAddress: {
      type: AddressSnapshotSchema,
    },
    paymentMethod: {
      type: String,

      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_VALUES,
      default: PaymentStatus.PENDING,
    },
    paymentId: {
      type: String,
      trim: true,
    },
    couponCode: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    trackingNumber: {
      type: String,
      trim: true,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
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

export const Orders = mongoose.model<IOrder>("orders", OrderSchema);
