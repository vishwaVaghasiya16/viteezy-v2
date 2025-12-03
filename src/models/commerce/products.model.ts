import mongoose, { Schema, Document } from "mongoose";
import {
  PriceSchema,
  PriceType,
  SeoSchema,
  SeoType,
  I18nString,
  I18nText,
  I18nStringType,
  I18nTextType,
} from "../common.model";
import {
  ProductStatus,
  ProductVariant,
  PRODUCT_STATUS_VALUES,
  PRODUCT_VARIANT_VALUES,
} from "../enums";

// Price structure for subscription periods
export interface SubscriptionPriceType {
  oneTime: PriceType;
  thirtyDays: PriceType;
  sixtyDays: PriceType;
  ninetyDays: PriceType;
  oneEightyDays: PriceType;
}

const SubscriptionPriceSchema = new Schema<SubscriptionPriceType>(
  {
    oneTime: { type: PriceSchema },
    thirtyDays: { type: PriceSchema },
    sixtyDays: { type: PriceSchema },
    ninetyDays: { type: PriceSchema },
    oneEightyDays: { type: PriceSchema },
  },
  { _id: false }
);

export interface NutritionTableItem {
  nutrient: string;
  amount: string;
  unit?: string;
  dailyValue?: string;
}

export interface SourceInfo {
  manufacturer?: string;
  countryOfOrigin?: string;
  certification?: string[];
  batchNumber?: string;
  expiryDate?: Date;
}

export interface IProduct extends Document {
  title: I18nStringType | string; // Support both I18n and plain string for backward compatibility
  slug: string;
  description: I18nTextType | string;
  productImage: string;
  benefits: string[]; // Array of strings (can be translated individually)
  ingredients: string[]; // Array of strings
  productIngredients?: mongoose.Types.ObjectId[];
  categories?: mongoose.Types.ObjectId[];
  healthGoals?: string[];
  nutritionInfo: I18nTextType | string;
  nutritionTable?: NutritionTableItem[];
  howToUse: I18nTextType | string;
  status: ProductStatus;
  price: PriceType;
  variant: ProductVariant;
  hasStandupPouch: boolean;
  standupPouchPrices?: SubscriptionPriceType;
  meta?: SeoType;
  sourceInfo?: SourceInfo;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    title: {
      type: Schema.Types.Mixed, // Support both I18nString and String
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    description: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
    benefits: [
      {
        type: String,
        trim: true,
      },
    ],
    ingredients: [
      {
        type: String,
        trim: true,
      },
    ],
    productIngredients: [
      {
        type: Schema.Types.ObjectId,
        ref: "product_ingredients",
      },
    ],
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "categories",
      },
    ],
    healthGoals: [
      {
        type: String,
        trim: true,
      },
    ],
    nutritionInfo: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
    },
    nutritionTable: [
      {
        nutrient: { type: String, trim: true },
        amount: { type: String, trim: true },
        unit: { type: String, trim: true },
        dailyValue: { type: String, trim: true },
        _id: false,
      },
    ],
    howToUse: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
    },
    status: {
      type: String,
      enum: PRODUCT_STATUS_VALUES,
      default: ProductStatus.DRAFT,
    },
    price: {
      type: PriceSchema,
    },
    variant: {
      type: String,
      enum: PRODUCT_VARIANT_VALUES,
    },
    hasStandupPouch: {
      type: Boolean,
      default: false,
    },
    standupPouchPrices: {
      type: SubscriptionPriceSchema,
    },
    meta: {
      type: SeoSchema,
    },
    sourceInfo: {
      manufacturer: { type: String, trim: true },
      countryOfOrigin: { type: String, trim: true },
      certification: [{ type: String, trim: true }],
      batchNumber: { type: String, trim: true },
      expiryDate: { type: Date },
      _id: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
    },
    updatedBy: {
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

// Indexes
ProductSchema.index({ slug: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ variant: 1 });
ProductSchema.index({ hasStandupPouch: 1 });
ProductSchema.index({ isDeleted: 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ healthGoals: 1 });
ProductSchema.index({ productIngredients: 1 });

// Text search index
ProductSchema.index({ title: "text", description: "text" });

export const Products = mongoose.model<IProduct>("products", ProductSchema);
