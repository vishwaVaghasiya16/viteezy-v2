import mongoose, { Schema, Document } from "mongoose";

/**
 * Variant Type Interface
 * Manages product variant types like Sachet, Stand-up Pouch, etc.
 */
export interface IVariantType extends Document {
  createdBy: mongoose.Types.ObjectId;
  title: string; // e.g., "Sachet", "Stand-up Pouch"
  description?: string; // Optional description of the variant type
  icon?: string; // Optional icon URL or path
  isActive: boolean; // true = Active, false = Inactive
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Variant Type Schema
 */
const VariantTypeSchema = new Schema<IVariantType>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    icon: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true, // true = Active, false = Inactive
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
VariantTypeSchema.index({ title: 1 });
VariantTypeSchema.index({ isActive: 1 });

// Export the model
const VariantType = mongoose.model<IVariantType>(
  "variant_types",
  VariantTypeSchema
);

export default VariantType;
