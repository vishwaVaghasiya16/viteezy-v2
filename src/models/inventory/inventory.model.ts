import mongoose, { Schema, Document } from "mongoose";

/**
 * Inventory model — the live stock state for one SKU at one Location.
 */
export interface IInventory extends Document {
  skuId: mongoose.Types.ObjectId;            // → inventory_skus
  locationId: mongoose.Types.ObjectId;       // → inventory_locations
  stockQuantity: number;                     // Physical units confirmed at location
  reservedQuantity: number;                  // Units held for placed but unshipped orders
  lowStockThreshold: number;                 // Alert fires when available falls at or below this
  // Virtual
  availableQuantity: number;                 // stockQuantity - reservedQuantity (computed)
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InventorySchema = new Schema<IInventory>(
  {
    skuId: {
      type: Schema.Types.ObjectId,
      ref: "inventory_skus",
      required: [true, "SKU reference is required"],
    },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: "inventory_locations",
      required: [true, "Location reference is required"],
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
    },
    reservedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Reserved quantity cannot be negative"],
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 50,
      min: [0, "Low stock threshold cannot be negative"],
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

// ─── Virtual ────────────────────────────────────────────────────────────────

/**
 * availableQuantity is computed on every read.
 * Never stored — removes any risk of drift between stock and reserved counts.
 */
InventorySchema.virtual("availableQuantity").get(function (this: IInventory) {
  return this.stockQuantity - this.reservedQuantity;
});

/**
 * isLowStock virtual — true when available has hit the threshold.
 * Useful for frontend badge rendering without extra computation.
 */
InventorySchema.virtual("isLowStock").get(function (this: IInventory) {
  return this.stockQuantity - this.reservedQuantity <= this.lowStockThreshold;
});

// ─── Indexes ────────────────────────────────────────────────────────────────

// Primary lookup: one inventory record per SKU-Location pair
InventorySchema.index({ skuId: 1, locationId: 1 }, { unique: true });

// Dashboard queries — all stock at a location, all locations for a SKU
InventorySchema.index({ locationId: 1, isDeleted: 1 });
InventorySchema.index({ skuId: 1, isDeleted: 1 });

// Low stock monitoring — find all records at or below threshold
InventorySchema.index({ stockQuantity: 1, reservedQuantity: 1 });
InventorySchema.index({ isDeleted: 1 });

// ─── Pre-save guard ─────────────────────────────────────────────────────────

/**
 * Prevents reservedQuantity from ever exceeding stockQuantity.
 * Acts as a last-resort guard — the service layer should catch this first.
 */
InventorySchema.pre("save", function (next) {
  if (this.reservedQuantity > this.stockQuantity) {
    return next(
      new Error(
        `Reserved quantity (${this.reservedQuantity}) cannot exceed stock quantity (${this.stockQuantity}) for SKU ${this.skuId} at location ${this.locationId}`
      )
    );
  }
  next();
});

export const Inventory = mongoose.model<IInventory>(
  "inventory",
  InventorySchema
);