import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  SeoSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
  SeoType,
} from "../common.model";

export interface IProductCategory extends Document {
  slug: string;
  name: I18nStringType;
  description: I18nTextType;
  sortOrder: number;
  icon?: string;
  image?: MediaType;
  seo: SeoType;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductCategorySchema = new Schema<IProductCategory>(
  {
    slug: {
      type: String,
      lowercase: true,
      default: null,
    },
    name: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    icon: {
      type: String,
      trim: true,
      default: null,
    },
    image: {
      type: MediaSchema,
      default: null,
    },
    seo: {
      type: SeoSchema,
      default: () => ({}),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    productCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Text search index
ProductCategorySchema.index({
  "name.en": "text",
  "name.nl": "text",
  "description.en": "text",
  "description.nl": "text",
});

// Other indexes
ProductCategorySchema.index({ isActive: 1, sortOrder: 1 });
ProductCategorySchema.index({ isActive: 1, productCount: -1 });

export const ProductCategory = mongoose.model<IProductCategory>(
  "product_categories",
  ProductCategorySchema
);
