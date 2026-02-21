import mongoose, { Schema, Document } from "mongoose";
import {
  AddressSnapshotSchema,
  AuditSchema,
  SoftDelete,
  AddressSnapshotType,
} from "../common.model";
import { ShipmentStatus, SHIPMENT_STATUS_VALUES } from "../enums";

export interface IShipment extends Document {
  orderId: mongoose.Types.ObjectId; // Required, ref Order
  carrier: string; // e.g. "PostNL"
  trackingCode: string; // Barcode
  trackingUrl: string; // Track & trace link
  shipmentStatus: ShipmentStatus; // Carrier status
  statusHistory: Array<{
    status: ShipmentStatus;
    timestamp: Date;
  }>;
  pharmacistOrderNumber?: string; // Optional
  pickedUpAt?: Date;
  deliveredAt?: Date;
  // Legacy fields (kept for backward compatibility)
  trackingNumber?: string; // Alias for trackingCode
  service?: string;
  status?: ShipmentStatus; // Alias for shipmentStatus
  items?: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    sku: string;
  }>;
  shippingAddress?: AddressSnapshotType;
  estimatedDelivery?: Date;
  actualDelivery?: Date; // Alias for deliveredAt
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  trackingEvents?: Array<{
    status: string;
    description: string;
    location?: string;
    timestamp: Date;
  }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "orders",
      required: true,
    },
    carrier: {
      type: String,
      trim: true,
      required: true,
      default: "PostNL",
    },
    trackingCode: {
      type: String,
      trim: true,
    },
    trackingUrl: {
      type: String,
      trim: true,
    },
    shipmentStatus: {
      type: String,
      enum: SHIPMENT_STATUS_VALUES,
      default: ShipmentStatus.PENDING,
      required: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: SHIPMENT_STATUS_VALUES,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
          required: true,
        },
      },
    ],
    pharmacistOrderNumber: {
      type: String,
      trim: true,
    },
    pickedUpAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    // Legacy fields (for backward compatibility)
    trackingNumber: {
      type: String,
      trim: true,
    },
    service: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: SHIPMENT_STATUS_VALUES,
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: "products",
        },
        variantId: {
          type: Schema.Types.ObjectId,
          ref: "product_variants",
        },
        quantity: {
          type: Number,
          min: 1,
        },
        sku: {
          type: String,
          trim: true,
        },
      },
    ],
    shippingAddress: {
      type: AddressSnapshotSchema,
    },
    estimatedDelivery: {
      type: Date,
    },
    actualDelivery: {
      type: Date,
    }, // Alias for deliveredAt
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, default: "cm" },
    },
    trackingEvents: [
      {
        status: {
          type: String,
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        location: {
          type: String,
          trim: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: {
      type: String,
      trim: true,
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

// Pre-save middleware to sync fields for backward compatibility
ShipmentSchema.pre("save", function (next) {
  // Sync trackingCode <-> trackingNumber
  if (this.trackingCode && !this.trackingNumber) {
    this.trackingNumber = this.trackingCode;
  } else if (this.trackingNumber && !this.trackingCode) {
    this.trackingCode = this.trackingNumber;
  }
  
  // Sync shipmentStatus <-> status
  if (this.shipmentStatus && !this.status) {
    this.status = this.shipmentStatus;
  } else if (this.status && !this.shipmentStatus) {
    this.shipmentStatus = this.status;
  }
  
  // Sync deliveredAt <-> actualDelivery
  if (this.deliveredAt && !this.actualDelivery) {
    this.actualDelivery = this.deliveredAt;
  } else if (this.actualDelivery && !this.deliveredAt) {
    this.deliveredAt = this.actualDelivery;
  }
  
  next();
});

// Indexes
ShipmentSchema.index({ orderId: 1, shipmentStatus: 1 });
ShipmentSchema.index({ trackingCode: 1 });
ShipmentSchema.index({ trackingNumber: 1 }); // Legacy
ShipmentSchema.index({ carrier: 1, shipmentStatus: 1 });
ShipmentSchema.index({ shipmentStatus: 1, estimatedDelivery: 1 });
ShipmentSchema.index({ pharmacistOrderNumber: 1 });

export const Shipments = mongoose.model<IShipment>("shipments", ShipmentSchema);
