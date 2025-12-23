import mongoose, { Schema, Document } from "mongoose";
import { SoftDelete, AuditSchema } from "../common.model";

export interface ICountry extends Document {
  name: string;
  alpha2: string; // ISO 3166-1 alpha-2 code (e.g., "US", "NL", "BE")
  alpha3?: string; // ISO 3166-1 alpha-3 code (e.g., "USA", "NLD", "BEL") - Optional
  numeric: string; // ISO 3166-1 numeric code (e.g., "840", "528", "056")
  region?: string; // Region (e.g., "Europe", "Americas")
  subRegion?: string; // Sub-region (e.g., "Western Europe", "Northern America")
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CountrySchema = new Schema<ICountry>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    alpha2: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      length: 2,
    },
    alpha3: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
      length: 3,
    },
    numeric: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    region: {
      type: String,
      trim: true,
    },
    subRegion: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Indexes (only for non-unique fields - unique fields already have indexes from unique: true)
// Note: unique: true automatically creates indexes, so we don't need to define them again
CountrySchema.index({ isActive: 1 });
CountrySchema.index({ region: 1 });

export const Countries = mongoose.model<ICountry>("countries", CountrySchema);
