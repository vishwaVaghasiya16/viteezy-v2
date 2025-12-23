import mongoose, { Schema, Document } from "mongoose";
import { SoftDelete, AuditSchema } from "../common.model";

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  streetName: string;
  houseNumber?: string;
  houseNumberAddition?: string;
  postalCode: string;
  address: string; // Full address line
  phone?: string;
  country: string;
  city?: string; // Optional, but may be needed for BE validation
  isDefault: boolean;
  note?: string; // Renamed from instructions
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
    streetName: {
      type: String,
      required: true,
      trim: true,
    },
    houseNumber: {
      type: String,
      trim: true,
      default: null,
    },
    houseNumberAddition: {
      type: String,
      trim: true,
      default: null,
    },
    postalCode: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      trim: true,
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
AddressSchema.index({ userId: 1 });
AddressSchema.index({ country: 1 });
AddressSchema.index({ isDefault: 1 });
AddressSchema.index({ userId: 1, isDefault: 1 });
AddressSchema.index({ country: 1, city: 1 });
AddressSchema.index({ postalCode: 1 });

export const Addresses = mongoose.model<IAddress>("addresses", AddressSchema);
