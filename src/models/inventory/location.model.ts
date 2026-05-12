import mongoose, { Schema, Document } from "mongoose";
import { LocationType, LOCATION_TYPE_VALUES } from "../enums";

const AddressSchema = new Schema({
    street: { type: String, trim: true, default: null },
    street2: { type: String, trim: true, default: null }, // apartment, unit, etc.
    postalCode: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null }, // VERY useful (India, US, etc.)
    country: { type: String, trim: true, default: null },
    countryCode: { type: String, trim: true, uppercase: true, default: null },
}, { _id: false });

const ContactSchema = new Schema({
    name: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
    phoneCountryCode: { type: String, trim: true, default: null }, // +91, +31
    email: { type: String, trim: true, lowercase: true, default: null , match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"],},
    designation: { type: String, trim: true, default: null }, // manager, warehouse head
}, { _id: false });

export interface ILocation extends Document {
  name: string;
  type: LocationType;
  /** When type is CUSTOMER — links to commerce `addresses._id` (order shipping) for stable routing in movements */
  linkedAddressId?: mongoose.Types.ObjectId | null;
  address: {
    street?: string;
    street2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
  contactPerson: {
    name?: string;
    phone?: string;
    email?: string;
    designation?: string;
  };
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: {        
      type: String,
      required: [true, "Location name is required"],
      trim: true,
      lowercase: true,
    },
    type: {
      type: String,
      enum: LOCATION_TYPE_VALUES,
      required: [true, "Location type is required"],
    },
    linkedAddressId: {
      type: Schema.Types.ObjectId,
      ref: "addresses",
      default: null,
    },
    address: {
      type: AddressSchema,
      default: null,
    },
    contactPerson: {
      type: ContactSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ────────────────────────────────────────────────────────────────
LocationSchema.index({ type: 1, isActive: 1 });
LocationSchema.index({ isDeleted: 1 });
LocationSchema.index(
  { linkedAddressId: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: false, linkedAddressId: { $exists: true } },
  }
);
LocationSchema.index(
  { name: 1, type: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

LocationSchema.pre("validate", function (next) {
  if (this.contactPerson) {
    const { phone, email } = this.contactPerson;

    if (!phone && !email) {
      return next(
        new Error("Contact must have at least phone or email")
      );
    }
  }

  next();
});

export const Locations = mongoose.model<ILocation>(
  "inventory_locations",
  LocationSchema
);