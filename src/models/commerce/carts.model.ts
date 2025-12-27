import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  AuditSchema,
  SoftDelete,
  PriceType,
} from "../common.model";
import { ProductVariant } from "../enums";

export interface ICart extends Document {
  userId: mongoose.Types.ObjectId;
  sessionId?: string;
  variantType?: ProductVariant; // Variant type for all items in cart (SACHETS or STAND_UP_POUCH)
  items: Array<{
    productId: mongoose.Types.ObjectId;
    price: PriceType;
    addedAt: Date;
  }>;
  subtotal: number; // Sum of all product amounts
  tax: number; // Sum of all taxRate values converted to amount
  shipping: number;
  discount: number; // Sum of all discountedPrice values
  total: number; // subtotal + tax - discount - couponDiscountAmount
  currency: string; // Currency code (e.g., "EUR")
  couponCode?: string;
  couponDiscountAmount: number; // Calculated coupon discount (fixed or percentage)
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    sessionId: {
      type: String,
      trim: true,
    },
    variantType: {
      type: String,
      enum: Object.values(ProductVariant),
      default: null,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
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
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: "EUR",
      trim: true,
    },
    couponCode: {
      type: String,
      trim: true,
      default: null,
    },
    couponDiscountAmount: {
      type: Number,
      default: 0,
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
