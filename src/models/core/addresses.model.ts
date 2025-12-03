import mongoose, { Schema, Document } from "mongoose";
import { SoftDelete, AuditSchema } from "../common.model";
import { AddressType, ADDRESS_TYPE_VALUES } from "../enums";

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  zip: string;
  addressLine1: string;
  addressLine2?: string;
  houseNumber?: string;
  houseNumberAddition?: string;
  isDefault: boolean;
  type?: AddressType;
  label?: string;
  instructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    zip: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },
    addressLine2: {
      type: String,
      trim: true,
    },
    houseNumber: {
      type: String,
      trim: true,
    },
    houseNumberAddition: {
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
    label: {
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
