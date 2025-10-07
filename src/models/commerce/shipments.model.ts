import mongoose, { Schema, Document } from 'mongoose';
import { AddressSnapshotSchema, AuditSchema, SoftDelete, AddressSnapshotType } from '../common.model';
import { ShipmentStatus, SHIPMENT_STATUS_VALUES } from '../enums';

export interface IShipment extends Document {
  orderId: mongoose.Types.ObjectId;
  trackingNumber: string;
  carrier: string;
  service: string;
  status: ShipmentStatus;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    variantId?: mongoose.Types.ObjectId;
    quantity: number;
    sku: string;
  }>;
  shippingAddress: AddressSnapshotType;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  trackingEvents: Array<{
    status: string;
    description: string;
    location?: string;
    timestamp: Date;
  }>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShipmentSchema = new Schema<IShipment>({
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'orders', 
    required: true
  },
  trackingNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true
  },
  carrier: { 
    type: String, 
    required: true, 
    trim: true
  },
  service: { 
    type: String, 
    required: true, 
    trim: true 
  },
  status: { 
    type: String, 
    enum: SHIPMENT_STATUS_VALUES, 
    default: ShipmentStatus.PENDING
  },
  items: [{
    productId: { 
      type: Schema.Types.ObjectId, 
      ref: 'products', 
      required: true 
    },
    variantId: { 
      type: Schema.Types.ObjectId, 
      ref: 'product_variants' 
    },
    quantity: { 
      type: Number, 
      required: true, 
      min: 1 
    },
    sku: { 
      type: String, 
      required: true, 
      trim: true 
    }
  }],
  shippingAddress: { 
    type: AddressSnapshotSchema, 
    required: true 
  },
  estimatedDelivery: { 
    type: Date
  },
  actualDelivery: { 
    type: Date
  },
  weight: { 
    type: Number, 
    min: 0 
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, default: 'cm' }
  },
  trackingEvents: [{
    status: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      required: true, 
      trim: true 
    },
    location: { 
      type: String, 
      trim: true 
    },
    timestamp: { 
      type: Date, 
      required: true, 
      default: Date.now 
    }
  }],
  notes: { 
    type: String, 
    trim: true 
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ShipmentSchema.index({ orderId: 1, status: 1 });
ShipmentSchema.index({ trackingNumber: 1 });
ShipmentSchema.index({ carrier: 1, status: 1 });
ShipmentSchema.index({ status: 1, estimatedDelivery: 1 });

export const Shipments = mongoose.model<IShipment>('shipments', ShipmentSchema);