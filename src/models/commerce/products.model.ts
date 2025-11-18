import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  SeoSchema,
  I18nStringType,
  I18nTextType,
  MediaType,
  SeoType,
} from "../common.model";
import { ProductStatus, PRODUCT_STATUS_VALUES } from "../enums";

export interface IProduct extends Document {
  slug: string;
  skuRoot?: string;
  status: ProductStatus;
  title: I18nStringType;
  subtitle: I18nStringType;
  description: I18nTextType;
  categories: mongoose.Types.ObjectId[];
  tags: string[];
  labels: string[];
  media: MediaType[];
  ingredientLinks: Array<{
    ingredientId: mongoose.Types.ObjectId;
    amount: number;
    unit: string;
  }>;
  seo: SeoType;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    slug: { type: String, lowercase: true },
    skuRoot: { type: String, trim: true },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: ProductStatus.DRAFT,
    },
    title: { type: I18nString, default: () => ({}) },
    subtitle: { type: I18nString, default: () => ({}) },
    description: { type: I18nText, default: () => ({}) },
    categories: [{ type: Schema.Types.ObjectId, ref: "categories" }],
    tags: [{ type: String, trim: true }],
    labels: [{ type: String, trim: true }],
    media: { type: [MediaSchema], default: [] },
    ingredientLinks: [
      {
        ingredientId: { type: Schema.Types.ObjectId, ref: "ingredients" },
        amount: Number,
        unit: String,
        _id: false,
      },
    ],
    seo: { type: SeoSchema, default: () => ({}) },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Text search index
ProductSchema.index({
  "title.en": "text",
  "title.nl": "text",
  "description.en": "text",
  "description.nl": "text",
});

// Other indexes
ProductSchema.index({ slug: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ isDeleted: 1 });

export const Products = mongoose.model<IProduct>("products", ProductSchema);
