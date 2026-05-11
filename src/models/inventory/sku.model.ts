import mongoose, { Schema, Document } from "mongoose";
import {
    ProductVariant,
    PRODUCT_VARIANT_VALUES,
} from "../enums"; // your existing enums file

/**
 * Sku model — bridges your existing product catalog to the inventory module.
 */
export interface ISku extends Document {
    skuCode: string;                               // Unique identifier, e.g. "MV-SACHET-30"
    productId: mongoose.Types.ObjectId;            // → products (denormalised for query performance)
    variantType: ProductVariant;                   // SACHETS | STAND_UP_POUCH (from your existing enum)
    displayName: string;                           // Human-readable, e.g. "Viteezy Sachet 30-day"
    unit: string;                                  // "sachet" | "pouch" | "box"
    weightGrams?: number;                          // Optional — useful for shipping cost calc later
    isActive: boolean;
    isDeleted: boolean;
    deletedAt?: Date;
    createdBy?: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const SkuSchema = new Schema<ISku>(
    {
        skuCode: {
            type: String,
            required: [true, "SKU code is required"],
            trim: true,
            uppercase: true,
        },

        productId: {
            type: Schema.Types.ObjectId,
            ref: "products",
            required: [true, "Product reference is required"],
        },
        variantType: {
            type: String,
            enum: PRODUCT_VARIANT_VALUES,              // ['SACHETS', 'STAND_UP_POUCH']
            required: [true, "Variant type is required"],
        },
        displayName: {
            type: String,
            required: [true, "Display name is required"],
            trim: true,
        },
        unit: {
            type: String,
            required: [true, "Unit is required"],
            trim: true,
            lowercase: true,
        },
        weightGrams: {
            type: Number,
            min: 0,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
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

// ─── Indexes ────────────────────────────────────────────────────────────────
SkuSchema.index({ skuCode: 1 }, { unique: true });

SkuSchema.index({ productId: 1, variantType: 1 });
SkuSchema.index({ variantType: 1, isActive: 1 });
SkuSchema.index({ isDeleted: 1 });

// ─── Virtuals ───────────────────────────────────────────────────────────────

/**
 * Populated product — available after .populate('productId')
 * Usage: const sku = await Skus.findOne(...).populate('productId')
 */
SkuSchema.virtual("product", {
    ref: "products",
    localField: "productId",
    foreignField: "_id",
    justOne: true,
});

/**
 * Live inventory across all locations — available after .populate('inventoryRecords')
 * Usage: const sku = await Skus.findOne(...).populate('inventoryRecords')
 */
SkuSchema.virtual("inventoryRecords", {
    ref: "inventory",
    localField: "_id",
    foreignField: "skuId",
    match: { isDeleted: false },
});

export const Skus = mongoose.model<ISku>("inventory_skus", SkuSchema);