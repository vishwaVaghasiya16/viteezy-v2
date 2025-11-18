import mongoose, { Schema, Document } from "mongoose";
import { SoftDelete, AuditSchema } from "../common.model";
import { AddressType, ADDRESS_TYPE_VALUES } from "../enums";

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
  isDefault: boolean;
  type: AddressType;
  phone?: string;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    label: {
      type: String,
      trim: true,
    },
    line1: {
      type: String,
      trim: true,
    },
    line2: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    zip: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ADDRESS_TYPE_VALUES,
      default: AddressType.HOME,
    },
    phone: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
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
AddressSchema.index({ userId: 1 });
AddressSchema.index({ country: 1 });
AddressSchema.index({ isDefault: 1 });
AddressSchema.index({ type: 1 });
AddressSchema.index({ userId: 1, isDefault: 1 });
AddressSchema.index({ userId: 1, type: 1 });
AddressSchema.index({ country: 1, city: 1 });

export const Addresses = mongoose.model<IAddress>("addresses", AddressSchema);
