import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

export interface IProductIngredient extends Document {
  name: string;
  slug: string;
  description?: string;
  benefits?: string;
  precautions?: string;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductIngredientSchema = new Schema<IProductIngredient>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      // Note: unique constraint is handled in schema.index() below with partialFilterExpression
    },
    description: {
      type: String,
      trim: true,
    },
    benefits: {
      type: String,
      trim: true,
    },
    precautions: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ...(SoftDelete as Record<string, any>),
    ...(AuditSchema.obj as Record<string, any>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ProductIngredientSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);
ProductIngredientSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);
ProductIngredientSchema.index({ isActive: 1, isDeleted: 1 });
ProductIngredientSchema.index({ createdAt: -1 });

export const ProductIngredients = mongoose.model<IProductIngredient>(
  "product_ingredients",
  ProductIngredientSchema
);
