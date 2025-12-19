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

// Extended price type for subscription periods with additional metadata
// amount is optional here as it will be calculated from totalAmount
export interface SubscriptionPriceWithMetadata
  extends Omit<PriceType, "amount"> {
  amount?: number; // Optional - will be calculated from totalAmount if not provided
  totalAmount?: number; // Total price for the entire subscription period (e.g., $163.38 for 6 months)
  durationDays?: number; // Duration in days (e.g., 30, 60, 90, 180)
  capsuleCount?: number; // Number of capsules for this subscription period
  savingsPercentage?: number; // Savings percentage (e.g., 30 for "Save 30%")
  features?: string[]; // Features like "Free shipping", "Can be cancelled at any time"
  icon?: string; // URL to icon/image for this subscription option
}

const SubscriptionPriceWithMetadataSchema =
  new Schema<SubscriptionPriceWithMetadata>(
    {
      currency: { type: String, default: "EUR" },
      amount: { type: Number, optional: true }, // Optional - will be calculated from totalAmount
      discountedPrice: { type: Number, min: 0, optional: true },
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

const SachetOneTimeCapsuleOptionsSchema =
  new Schema<SachetOneTimeCapsuleOptions>(
    {
      count30: {
        type: new Schema(
          {
            currency: { type: String, default: "EUR" },
            amount: { type: Number, required: true },
            discountedPrice: { type: Number, min: 0, optional: true },
            taxRate: { type: Number, default: 0 },
            capsuleCount: { type: Number, optional: true },
          },
          { _id: false }
        ),
      },
      count60: {
        type: new Schema(
          {
            currency: { type: String, default: "EUR" },
            amount: { type: Number, required: true },
            discountedPrice: { type: Number, min: 0, optional: true },
            taxRate: { type: Number, default: 0 },
            capsuleCount: { type: Number, optional: true },
          },
          { _id: false }
        ),
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

export interface SpecificationItem {
  title: string;
  descr: string;
  image: string;
  imageMobile?: string;
}

export interface Specification {
  main_title: string;
  bg_image: string;
  items: SpecificationItem[]; // 4 items
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
  title: I18nStringType | string; // Support both I18n and plain string for backward compatibility
  slug: string;
  description: I18nTextType | string;
  productImage: string;
  benefits: string[]; // Array of strings (can be translated individually)
  ingredients: string[]; // Array of strings
  categories?: mongoose.Types.ObjectId[];
  healthGoals?: string[];
  nutritionInfo: I18nTextType | string;
  howToUse: I18nTextType | string;
  status: boolean; // true = Active, false = Inactive
  price: PriceType; // Base price (for Sachets - default)
  variant: ProductVariant;
  hasStandupPouch: boolean;
  // Sachet prices (subscription + one-time with capsule options)
  sachetPrices?: SachetPricesType;
  // Stand-up pouch: only one-time purchase (no subscription)
  standupPouchPrice?: PriceType | SachetOneTimeCapsuleOptions; // Single one-time price or oneTime structure with count30/count60
  standupPouchImages?: string[]; // Separate images for stand-up pouch variant
  // New fields for admin Add Product screen
  shortDescription?: string;
  galleryImages?: string[]; // Additional product images
  isFeatured?: boolean; // Featured product checkbox
  comparisonSection?: ComparisonSection; // Comparison section data
  specification?: Specification; // Product specification section
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
      default: null,
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    description: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
      default: null,
    },
    shortDescription: {
      type: String,
      trim: true,
      default: null,
    },
    productImage: {
      type: String,
      trim: true,
      default: null,
    },
    benefits: {
      type: [String],
      default: [],
    },
    ingredients: {
      type: [String],
      default: [],
    },
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "product_categories",
      },
    ],
    healthGoals: {
      type: [String],
      default: [],
    },
    nutritionInfo: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
      default: null,
    },
    galleryImages: {
      type: [String],
      default: [],
    },
    howToUse: {
      type: Schema.Types.Mixed, // Support both I18nText and String
      trim: true,
      default: null,
    },
    status: {
      type: Boolean,
      default: true, // true = Active, false = Inactive
    },
    price: {
      type: PriceSchema,
      default: null,
    },
    variant: {
      type: String,
      enum: PRODUCT_VARIANT_VALUES,
      default: null,
    },
    hasStandupPouch: {
      type: Boolean,
      default: false,
    },
    sachetPrices: {
      type: SachetPricesSchema,
      default: null,
    },
    standupPouchPrice: {
      type: Schema.Types.Mixed, // Can be PriceSchema or SachetOneTimeCapsuleOptionsSchema
      default: null,
    },
    standupPouchImages: {
      type: [String],
      default: [],
    },
    comparisonSection: {
      type: {
        title: { type: String, trim: true, default: null },
        columns: {
          type: [String],
          default: [],
        },
        rows: [
          {
            label: { type: String, trim: true, default: null },
            values: {
              type: [Boolean],
              default: [],
            },
            _id: false,
          },
        ],
      },
      _id: false,
      default: null,
    },
    specification: {
      type: {
        main_title: { type: String, trim: true, default: null },
        bg_image: { type: String, trim: true, default: null },
        items: [
          {
            title: { type: String, trim: true, default: null },
            descr: { type: String, trim: true, default: null },
            image: { type: String, trim: true, default: null },
            imageMobile: { type: String, trim: true, default: null },
            _id: false,
          },
        ],
      },
      _id: false,
      default: null,
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
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
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

// Text search index
ProductSchema.index({ title: "text", description: "text" });

export const Products = mongoose.model<IProduct>("products", ProductSchema);
