import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";

export interface IIngredientComposition extends Document {
  product: mongoose.Types.ObjectId;
  ingredient: mongoose.Types.ObjectId;
  quantity: string;
  driPercentage: number | string; // Can be numeric, "*", or "**"
  isDeleted?: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientCompositionSchema = new Schema<IIngredientComposition>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    ingredient: {
      type: Schema.Types.ObjectId,
      ref: "product_ingredients",
      required: true,
    },
    quantity: {
      type: String,
      required: true,
      trim: true,
    },
    driPercentage: {
      type: Schema.Types.Mixed, // Can be number or string ("*" or "**")
      required: true,
      validate: {
        validator: function(value: any) {
          // Allow numbers, "*", or "**"
          if (typeof value === 'number') {
            return value >= 0;
          }
          if (typeof value === 'string') {
            return value === '*' || value === '**';
          }
          return false;
        },
        message: 'DRI percentage must be a positive number, "*", or "**"'
      }
    },
    ...(SoftDelete as Record<string, any>),
    ...(AuditSchema.obj as Record<string, any>),
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient queries
IngredientCompositionSchema.index({ product: 1 });
IngredientCompositionSchema.index({ ingredient: 1 });
IngredientCompositionSchema.index({ product: 1, ingredient: 1 }, { unique: true });
IngredientCompositionSchema.index({ isDeleted: 1 });
IngredientCompositionSchema.index({ createdAt: -1 });

export const IngredientComposition = mongoose.model<IIngredientComposition>(
  "ingredient_compositions",
  IngredientCompositionSchema
);
