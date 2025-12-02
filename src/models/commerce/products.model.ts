import mongoose, { Schema, Document } from "mongoose";
import { PriceSchema, PriceType, SeoSchema, SeoType } from "../common.model";
import {
  ProductStatus,
  ProductVariant,
  PRODUCT_STATUS_VALUES,
  PRODUCT_VARIANT_VALUES,
} from "../enums";

// Extended price type for subscription periods with additional metadata
// amount is optional here as it will be calculated from totalAmount
export interface SubscriptionPriceWithMetadata extends Omit<PriceType, 'amount'> {
  amount?: number; // Optional - will be calculated from totalAmount if not provided
  totalAmount?: number; // Total price for the entire subscription period (e.g., $163.38 for 6 months)
  durationDays?: number; // Duration in days (e.g., 30, 60, 90, 180)
  capsuleCount?: number; // Number of capsules for this subscription period
  savingsPercentage?: number; // Savings percentage (e.g., 30 for "Save 30%")
  features?: string[]; // Features like "Free shipping", "Can be cancelled at any time"
  icon?: string; // URL to icon/image for this subscription option
}

const SubscriptionPriceWithMetadataSchema = new Schema<SubscriptionPriceWithMetadata>(
  {
    currency: { type: String, default: "EUR" },
    amount: { type: Number, optional: true }, // Optional - will be calculated from totalAmount
    taxRate: { type: Number, default: 0 },
    totalAmount: { type: Number, optional: true },
    durationDays: { type: Number, optional: true },
    capsuleCount: { type: Number, optional: true },
    savingsPercentage: { type: Number, optional: true },
    features: [{ type: String, trim: true }],
    icon: { type: String, trim: true, optional: true },
  },
  { _id: false }
);

// Price structure for subscription periods (for Sachets)
export interface SachetOneTimeCapsuleOptions {
  count30: PriceType & { capsuleCount?: number }; // 30 count price
  count60: PriceType & { capsuleCount?: number }; // 60 count price
}

const SachetOneTimeCapsuleOptionsSchema = new Schema<SachetOneTimeCapsuleOptions>(
  {
    count30: {
      type: new Schema({
        currency: { type: String, default: "EUR" },
        amount: { type: Number, required: true },
        taxRate: { type: Number, default: 0 },
        capsuleCount: { type: Number, optional: true },
      }, { _id: false }),
    },
    count60: {
      type: new Schema({
        currency: { type: String, default: "EUR" },
        amount: { type: Number, required: true },
        taxRate: { type: Number, default: 0 },
        capsuleCount: { type: Number, optional: true },
      }, { _id: false }),
    },
  },
  { _id: false }
);

export interface SachetPricesType {
  thirtyDays: SubscriptionPriceWithMetadata;
  sixtyDays: SubscriptionPriceWithMetadata;
  ninetyDays: SubscriptionPriceWithMetadata;
  oneEightyDays: SubscriptionPriceWithMetadata;
  oneTime: SachetOneTimeCapsuleOptions; // One-time purchase with capsule options (30/60 count)
}

const SachetPricesSchema = new Schema<SachetPricesType>(
  {
    thirtyDays: { type: SubscriptionPriceWithMetadataSchema },
    sixtyDays: { type: SubscriptionPriceWithMetadataSchema },
    ninetyDays: { type: SubscriptionPriceWithMetadataSchema },
    oneEightyDays: { type: SubscriptionPriceWithMetadataSchema },
    oneTime: { type: SachetOneTimeCapsuleOptionsSchema },
  },
  { _id: false }
);

// Legacy subscription price type (kept for backward compatibility)
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

export interface ComparisonRow {
  label: string;
  values: boolean[]; // yes/no per comparison column
}

export interface ComparisonSection {
  title: string; // Main title (e.g. "How Green tea extract Compares:")
  columns: string[]; // Comparison titles (e.g. ["Green tea extract", "Most Melatonin Sleep Aids", ...])
  rows: ComparisonRow[]; // Each row with label + yes/no per column
}

export interface IProduct extends Document {
  title: string;
  slug: string;
  description: string;
  productImage: string;
  benefits: string[];
  ingredients: string[];
  productIngredients?: mongoose.Types.ObjectId[];
  categories?: mongoose.Types.ObjectId[];
  healthGoals?: string[];
  nutritionInfo: string;
  nutritionTable?: NutritionTableItem[];
  howToUse: string;
  status: ProductStatus;
  price: PriceType; // Base price (for Sachets - default)
  variant: ProductVariant;
  hasStandupPouch: boolean;
  // Sachet prices (subscription + one-time with capsule options)
  sachetPrices?: SachetPricesType;
  sachetImages?: string[]; // Separate images for sachet variant
  // Stand-up pouch: only one-time purchase (no subscription)
  standupPouchPrice?: PriceType | SachetOneTimeCapsuleOptions; // Single one-time price or oneTime structure with count30/count60
  standupPouchImages?: string[]; // Separate images for stand-up pouch variant
  // Legacy field (kept for backward compatibility)
  standupPouchPrices?: SubscriptionPriceType;
  meta?: SeoType;
  sourceInfo?: SourceInfo;
  // New fields for admin Add Product screen
  shortDescription?: string;
  galleryImages?: string[]; // Additional product images
  isFeatured?: boolean; // Featured product checkbox
  comparisonSection?: ComparisonSection; // Comparison section data
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
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    shortDescription: {
      type: String,
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
      type: String,
      trim: true,
    },
    galleryImages: [
      {
        type: String,
        trim: true,
      },
    ],
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
      type: String,
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
    sachetPrices: {
      type: SachetPricesSchema,
    },
    sachetImages: [
      {
        type: String,
        trim: true,
      },
    ],
    standupPouchPrice: {
      type: Schema.Types.Mixed, // Can be PriceSchema or SachetOneTimeCapsuleOptionsSchema
    },
    standupPouchImages: [
      {
        type: String,
        trim: true,
      },
    ],
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
    comparisonSection: {
      title: { type: String, trim: true },
      columns: [
        {
          type: String,
          trim: true,
        },
      ],
      rows: [
        {
          label: { type: String, trim: true },
          values: [
            {
              type: Boolean,
            },
          ],
          _id: false,
        },
      ],
      _id: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
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
