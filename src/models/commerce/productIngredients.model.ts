import mongoose, { Schema, Document } from "mongoose";
import {
  AuditSchema,
  SoftDelete,
  MediaSchema,
  MediaType,
  I18nString,
  I18nText,
  I18nStringType,
  I18nTextType,
} from "../common.model";

export interface IProductIngredient extends Document {
  products: mongoose.Types.ObjectId[];
  name: I18nStringType;
  description?: I18nTextType; // HTML content
  image?: MediaType;
  isActive: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductIngredientSchema = new Schema<IProductIngredient>(
  {
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
        required: true,
      },
    ],
    name: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    image: {
      type: MediaSchema,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ...(SoftDelete as Record<string, any>),
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

ProductIngredientSchema.index({ products: 1 });
// Text search index for name and description across all languages
ProductIngredientSchema.index({
  "name.en": "text",
  "name.nl": "text",
  "name.de": "text",
  "name.fr": "text",
  "name.es": "text",
  "description.en": "text",
  "description.nl": "text",
  "description.de": "text",
  "description.fr": "text",
  "description.es": "text",
});
ProductIngredientSchema.index({ "name.en": 1 });
ProductIngredientSchema.index(
  { "name.en": 1 },
  { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } }
);
ProductIngredientSchema.index({ isActive: 1, isDeleted: 1 });
ProductIngredientSchema.index({ createdAt: -1 });

export const ProductIngredients = mongoose.model<IProductIngredient>(
  "product_ingredients",
  ProductIngredientSchema
);
