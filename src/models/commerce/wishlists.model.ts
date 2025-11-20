import mongoose, { Schema, Document } from "mongoose";

export interface IWishlistItem extends Document {
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema = new Schema<IWishlistItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxLength: 500,
    },
  },
  {
    timestamps: true,
  }
);

WishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Wishlists = mongoose.model<IWishlistItem>(
  "wishlists",
  WishlistSchema
);
