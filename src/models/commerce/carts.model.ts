import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  AuditSchema,
  SoftDelete,
  PriceType,
} from "../common.model";

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId?: string;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    price: PriceType;
    addedAt: Date;
  }>;
  subtotal: PriceType;
  tax: PriceType;
  shipping: PriceType;
  discount: PriceType;
  total: PriceType;
  couponCode?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    sessionId: {
      type: String,
      trim: true,
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
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    subtotal: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    tax: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    shipping: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    discount: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    total: {
      type: PriceSchema,
      default: () => ({ currency: "EUR", amount: 0, taxRate: 0 }),
    },
    couponCode: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
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
CartSchema.index({ userId: 1 });
CartSchema.index({ sessionId: 1 });
CartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Carts = mongoose.model<ICart>("carts", CartSchema);
