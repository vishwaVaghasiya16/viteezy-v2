import mongoose, { Schema, Document } from "mongoose";
import {
  MovementType,
  MOVEMENT_TYPE_VALUES,
  MovementStatus,
} from "../enums";
/**
 * InventoryMovement model — the append-only audit log.
 */
export interface IInventoryMovement extends Document {
  movementType: MovementType;
  status: MovementStatus;
  skuId: mongoose.Types.ObjectId;              // → inventory_skus
  fromLocationId?: mongoose.Types.ObjectId;    // → inventory_locations (null for PURCHASE/RETURN/positive ADJUSTMENT)
  toLocationId?: mongoose.Types.ObjectId;      // → inventory_locations (null for SALE/negative ADJUSTMENT)
  quantity: number;                            // Always positive — direction from movementType
  // Order / subscription linkage
  orderId?: mongoose.Types.ObjectId;           // → orders (for SALE movements)
  subscriptionId?: mongoose.Types.ObjectId;    // → subscriptions (for subscription renewals)
  customerId?: mongoose.Types.ObjectId;        // → users (for customer identification instead of location)
  referenceCode?: string;                      // Free-text PO number, shipment ref, etc.
  // Adjustment metadata
  reason?: string;                             // Required when movementType === ADJUSTMENT
  note?: string;                               // Optional extra detail for adjustments
  // Snapshot — denormalised at write time so history is readable even if
  // the SKU or Location document is later renamed or soft-deleted
  snapshot: {
    skuCode: string;
    skuDisplayName: string;
    fromLocationName?: string;
    toLocationName?: string;
  };
  performedBy: mongoose.Types.ObjectId;        // → users (staff member who created this)
  // Stock state after this movement — recorded for fast historical reads
  // without having to replay the entire movement log
  // Idempotency Protection
  idempotencyKey?: string;
  // Stock state snapshots for auditing
  stockBefore: {
    fromLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
    toLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
  };
  stockDelta: {
    fromLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
    toLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
  };
  stockAfter: {
    fromLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
    toLocation?: {
      stockQuantity: number;
      reservedQuantity: number;
    };
  };
  createdAt: Date;                             // Immutable — set once on insert
}
const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    movementType: {
      type: String,
      enum: MOVEMENT_TYPE_VALUES,
      required: [true, "Movement type is required"],
    },
    status: {
      type: String,
      enum: Object.values(MovementStatus),
      default: MovementStatus.COMPLETED,
    },
    skuId: {
      type: Schema.Types.ObjectId,
      ref: "inventory_skus",
      required: [true, "SKU reference is required"],
    },
    fromLocationId: {
      type: Schema.Types.ObjectId,
      ref: "inventory_locations",
      default: null,
    },
    toLocationId: {
      type: Schema.Types.ObjectId,
      ref: "inventory_locations",
      default: null,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      default: null,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "subscriptions",
      default: null,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    referenceCode: {
      type: String,
      trim: true,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: null,
    },
    // ── Snapshot (denormalised) ──────────────────────────────────────────
    snapshot: {
      skuCode: {
        type: String,
        required: true,
      },
      skuDisplayName: {
        type: String,
        required: true,
      },
      fromLocationName: {
        type: String,
        default: null,
      },
      toLocationName: {
        type: String,
        default: null,
      },
      _id: false,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Performed by is required"],
    },
    // ── Stock state after movement ───────────────────────────────────────
    idempotencyKey: {
      type: String,
      sparse: true,
      unique: true,
    },
    // ── Stock state snapshots ───────────────────────────────────────
    stockBefore: {
      fromLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      toLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      _id: false,
    },
    stockDelta: {
      fromLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      toLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      _id: false,
    },
    stockAfter: {
      fromLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      toLocation: {
        stockQuantity: { type: Number, default: null },
        reservedQuantity: { type: Number, default: null },
        _id: false,
      },
      _id: false,
    },
  },
  {
    // updatedAt intentionally omitted — movements are immutable after creation
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// ─── Indexes ────────────────────────────────────────────────────────────────
// Primary audit trail queries
InventoryMovementSchema.index({ skuId: 1, createdAt: -1 });
InventoryMovementSchema.index({ fromLocationId: 1, createdAt: -1 });
InventoryMovementSchema.index({ toLocationId: 1, createdAt: -1 });
InventoryMovementSchema.index({ movementType: 1, createdAt: -1 });
// Order / subscription linkage
InventoryMovementSchema.index({ orderId: 1 });
InventoryMovementSchema.index({ subscriptionId: 1 });
// Staff activity queries
InventoryMovementSchema.index({ performedBy: 1, createdAt: -1 });
// Date range scans (reports, low-stock history)
InventoryMovementSchema.index({ createdAt: -1 });
// ─── Pre-save validation ─────────────────────────────────────────────────────
/**
 * Business rule validations applied before every insert.
 * These are the last line of defence — the service layer validates first.
 */
InventoryMovementSchema.pre("save", function (this: IInventoryMovement, next) {
  // ADJUSTMENT movements must always include a reason
  if (this.movementType === MovementType.ADJUSTMENT && !this.reason?.trim()) {
    return next(new Error("Reason is required for ADJUSTMENT movements"));
  }
  // PURCHASE and RETURN must have a toLocation (destination)
  if (
    [MovementType.PURCHASE, MovementType.RETURN].includes(this.movementType) &&
    !this.toLocationId
  ) {
    return next(
      new Error(`toLocationId is required for ${this.movementType} movements`)
    );
  }
  // SALE must have a fromLocation (source)
  if (this.movementType === MovementType.SALE && !this.fromLocationId) {
    return next(new Error("fromLocationId is required for SALE movements"));
  }
  // TRANSFER must have both from and to
  if (this.movementType === MovementType.TRANSFER) {
    if (!this.fromLocationId || !this.toLocationId) {
      return next(
        new Error("Both fromLocationId and toLocationId are required for TRANSFER movements")
      );
    }
    if (this.fromLocationId.equals(this.toLocationId)) {
      return next(new Error("fromLocationId and toLocationId must be different for TRANSFER movements"));
    }
  }
  next();
});
/**
 * Block any update attempts — movements are immutable.
 * findOneAndUpdate, updateOne, updateMany are all blocked.
 */
InventoryMovementSchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  function (next) {
    next(new Error("InventoryMovement documents are immutable and cannot be updated"));
  }
);
export const InventoryMovements = mongoose.model<IInventoryMovement>(
  "inventory_movements",
  InventoryMovementSchema
);