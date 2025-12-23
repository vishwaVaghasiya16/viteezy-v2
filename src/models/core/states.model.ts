import mongoose, { Schema, Document } from "mongoose";
import { SoftDelete, AuditSchema } from "../common.model";

export interface IState extends Document {
  name: string;
  code: string; // State code (e.g., "CA", "NY", "NH" for US states)
  countryId: mongoose.Types.ObjectId; // Reference to Country
  countryCode: string; // ISO alpha-2 country code (for quick lookup)
  type?: string; // Type: "state", "province", "region", etc.
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StateSchema = new Schema<IState>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    countryId: {
      type: Schema.Types.ObjectId,
      ref: "countries",
      required: true,
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      length: 2,
    },
    type: {
      type: String,
      trim: true,
      default: "state",
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

// Compound indexes
// Note: Fields with index: true in definition are already indexed
StateSchema.index({ countryId: 1, code: 1 }, { unique: true });
StateSchema.index({ countryCode: 1, code: 1 });
StateSchema.index({ countryId: 1, isActive: 1 });
StateSchema.index({ countryCode: 1, isActive: 1 });
StateSchema.index({ name: 1, countryCode: 1 });

export const States = mongoose.model<IState>("states", StateSchema);
