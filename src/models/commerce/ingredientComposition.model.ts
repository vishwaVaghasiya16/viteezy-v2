import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema } from "../common.model";

// DRI value can be numeric (decimal), "*" or "**"
export type DriValueType = number | "*" | "**";

export interface IIngredientComposition extends Document {
  product: mongoose.Types.ObjectId; // Reference to the product
  ingredient: mongoose.Types.ObjectId; // Reference to the ingredient
  quantity: number; // Quantity of the ingredient
  driPercentage: DriValueType; // DRI % - can be number, "*", or "**"
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
      type: Number,
      required: true,
      min: 0,
    },
    driPercentage: {
      type: Schema.Types.Mixed, // Mixed type to support number, "*", or "**"
      required: true,
      validate: {
        validator: function(value: DriValueType) {
          // Allow: number (>= 0), "*", or "**"
          if (typeof value === 'number') {
            return value >= 0;
          }
          return value === "*" || value === "**";
        },
        message: "DRI percentage must be a positive number, '*', or '**'"
      }
    },
    ...(AuditSchema.obj as Record<string, any>),
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for efficient querying
IngredientCompositionSchema.index({ product: 1 });
IngredientCompositionSchema.index({ ingredient: 1 });
IngredientCompositionSchema.index({ product: 1, ingredient: 1 }, { unique: true }); // Unique combination
IngredientCompositionSchema.index({ isDeleted: 1 });

// Ensure soft delete works
IngredientCompositionSchema.index({ isDeleted: 1, deletedAt: 1 });

export const IngredientCompositions = mongoose.model<IIngredientComposition>(
  "ingredient_compositions",
  IngredientCompositionSchema
);
