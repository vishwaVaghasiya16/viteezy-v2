import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

export interface ISubscriptionChange extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "UPDATE_PLAN";
  newPlanSnapshot: Array<{
    productId: mongoose.Types.ObjectId;
    name: string;
    price: number;
    quantity: number;
  }>;
  effectiveDate: Date;
  status: "PENDING" | "APPLIED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionChangeSchema = new Schema<ISubscriptionChange>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["UPDATE_PLAN"],
      default: "UPDATE_PLAN",
    },
    newPlanSnapshot: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "products", required: true },
        name: { type: String, required: true, trim: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    effectiveDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPLIED", "CANCELLED"],
      default: "PENDING",
    },
    ...SoftDelete,
    ...AuditSchema.obj,
  },
  {
    timestamps: true,
  }
);

SubscriptionChangeSchema.index({
  subscriptionId: 1,
  status: 1,
  effectiveDate: 1,
});

export const SubscriptionChanges = mongoose.model<ISubscriptionChange>(
  "subscription_changes",
  SubscriptionChangeSchema
);


