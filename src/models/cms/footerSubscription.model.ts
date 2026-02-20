import mongoose, { Schema, Document } from "mongoose";

export interface IFooterSubscription extends Document {
  email: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const FooterSubscriptionSchema = new Schema<IFooterSubscription>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    source: {
      type: String,
      default: "footer",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

FooterSubscriptionSchema.index({ email: 1 }, { unique: true });
FooterSubscriptionSchema.index({ createdAt: -1 });

export const FooterSubscription = mongoose.model<IFooterSubscription>(
  "footer_subscriptions",
  FooterSubscriptionSchema
);
