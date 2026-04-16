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
  items: Array<{
    productId: mongoose.Types.ObjectId;
    variantType: ProductVariant; // Variant type for this item (SACHETS or STAND_UP_POUCH)
    quantity?: number; // Quantity for STAND_UP_POUCH items (default: 1, always 1 for SACHETS)
    isOneTime?: boolean; // Whether this is a one-time purchase (for SACHETS: true = one-time, false = subscription)
    planDays?: number; // For STAND_UP_POUCH only: treated as capsuleCount (30 or 60). NOT used for SACHETS.
    price: PriceType;
    totalAmount?: number; // Total amount (unit price * quantity) for STAND_UP_POUCH items
    isSubscriptionChange?: boolean; // Flag to indicate this item was added from subscription-change flow
    profileId?: mongoose.Types.ObjectId; // Profile ID this item is for (commerce context)
    addedAt: Date;
  }>;
  cartType?: "NORMAL" | "SUBSCRIPTION_UPDATE" ;
  linkedSubscriptionId?: mongoose.Types.ObjectId | null;
  subtotal: number; // Sum of all product amounts
  tax: number; // Sum of all taxRate values converted to amount
  shipping: number;
  discount: number; // Sum of all discountedPrice values
  total: number; // subtotal + tax - discount - couponDiscountAmount
  currency: string; // Currency code (e.g., "USD")
  couponCode?: string;
  couponDiscountAmount: number; // Calculated coupon discount (fixed or percentage)
  membershipDiscount?: number; // Membership discount percentage for the user
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
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
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
        isOneTime: {
          type: Boolean,
          default: false,
        },
        planDays: {
          type: Number,
          default: null,
        },
        price: {
          type: PriceSchema,
        },
        totalAmount: {
          type: Number,
          default: null,
        },
        isSubscriptionChange: {
          type: Boolean,
          default: false,
        },
        profileId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    cartType: {
      type: String,
      enum: ["NORMAL", "SUBSCRIPTION_UPDATE"],
      default: "NORMAL",
    },
    linkedSubscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
      default: null,
    },
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
      default: "USD",
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
    membershipDiscount: {
      type: Number,
      default: null,
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
