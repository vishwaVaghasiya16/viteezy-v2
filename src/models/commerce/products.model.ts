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
  features?: (I18nStringType | string)[]; // Features like "Free shipping", "Can be cancelled at any time" - Array of I18n strings or plain strings
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
      features: [{ type: Schema.Types.Mixed }], // Support both I18nString array and String array
      icon: { type: String, trim: true, optional: true },
    },
    { _id: false }
  );

// Price structure for subscription periods (for Sachets)
export interface SachetOneTimeCapsuleOptions {
  count30: PriceType & { capsuleCount?: number; features?: (I18nStringType | string)[] }; // 30 count price
  count60: PriceType & { capsuleCount?: number; features?: (I18nStringType | string)[] }; // 60 count price
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
            features: [{ type: Schema.Types.Mixed }], // Support both I18nString array and String array
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
            features: [{ type: Schema.Types.Mixed }], // Support both I18nString array and String array
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
  title: I18nStringType | string; // Support both I18n and plain string
  descr: I18nTextType | string; // Support both I18n and plain string
  image: string;
  imageMobile?: string;
}

export interface Specification {
  main_title: I18nStringType | string; // Support both I18n and plain string
  bg_image: string;
  items: SpecificationItem[]; // 4 items
}

export interface ComparisonRow {
  label: I18nStringType | string; // Support both I18n and plain string
  values: boolean[]; // yes/no per comparison column
}

export interface ComparisonSection {
  title: I18nStringType | string; // Main title (e.g. "How Green tea extract Compares:") - Support both I18n and plain string
  columns: (I18nStringType | string)[]; // Comparison titles - Array of I18n strings or plain strings
  rows: ComparisonRow[]; // Each row with label + yes/no per column
}

export interface IProduct extends Document {
  title: I18nStringType | string; // Support both I18n and plain string for backward compatibility
  slug: string;
  description: I18nTextType | string;
  productImage: string;
  benefits?: (I18nStringType | string)[]; // Array of I18n strings or plain strings
  ingredients: mongoose.Types.ObjectId[]; // Array of product ingredient ObjectIds
  categories?: mongoose.Types.ObjectId[];
  healthGoals?: (I18nStringType | string)[]; // Array of I18n strings or plain strings
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
  shortDescription?: I18nStringType | string; // Support both I18n and plain string
  galleryImages?: string[]; // Additional product images
  isFeatured?: boolean; // Featured product checkbox
  comparisonSection?: ComparisonSection; // Comparison section data (with I18n support)
  specification?: Specification; // Product specification section (with I18n support)
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
      type: Schema.Types.Mixed, // Support both I18nString and String
      default: null,
    },
    productImage: {
      type: String,
      trim: true,
      default: null,
    },
    benefits: {
      type: [Schema.Types.Mixed], // Support both I18nString array and String array
      default: [],
    },
    ingredients: [
      {
        type: Schema.Types.ObjectId,
        ref: "product_ingredients",
      },
    ],
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "product_categories",
      },
    ],
    healthGoals: {
      type: [Schema.Types.Mixed], // Support both I18nString array and String array
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
        title: { type: Schema.Types.Mixed, default: null }, // Support both I18nString and String
        columns: {
          type: [Schema.Types.Mixed], // Support both I18nString array and String array
          default: [],
        },
        rows: [
          {
            label: { type: Schema.Types.Mixed, default: null }, // Support both I18nString and String
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
        main_title: { type: Schema.Types.Mixed, default: null }, // Support both I18nString and String
        bg_image: { type: String, trim: true, default: null },
        items: [
          {
            title: { type: Schema.Types.Mixed, default: null }, // Support both I18nString and String
            descr: { type: Schema.Types.Mixed, default: null }, // Support both I18nText and String
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

// Text search index - support both multilingual and plain string fields
ProductSchema.index({
  title: "text",
  "title.en": "text",
  "title.nl": "text",
  "title.de": "text",
  "title.fr": "text",
  "title.es": "text",
  description: "text",
  "description.en": "text",
  "description.nl": "text",
  "description.de": "text",
  "description.fr": "text",
  "description.es": "text",
  shortDescription: "text",
  slug: "text",
});

export const Products = mongoose.model<IProduct>("products", ProductSchema);
