import mongoose, { Schema, Document } from 'mongoose';
import { I18nString, PriceSchema, MediaSchema, AuditSchema, SoftDelete, I18nStringType, PriceType, MediaType } from '../common.model';

export interface IProductVariant extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  name: I18nStringType;
  attributes: Record<string, any>;
  price: PriceType;
  compareAtPrice?: PriceType;
  costPrice?: PriceType;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  inventory: {
    quantity: number;
    reserved: number;
    trackQuantity: boolean;
    allowBackorder: boolean;
  };
  images: MediaType[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>({
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'products', 
    required: true
  },
  sku: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true
  },
  name: { 
    type: I18nString, 
    default: () => ({}) 
  },
  attributes: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  price: { 
    type: PriceSchema, 
    required: true 
  },
  compareAtPrice: { 
    type: PriceSchema 
  },
  costPrice: { 
    type: PriceSchema 
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
  inventory: {
    quantity: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    reserved: { 
      type: Number, 
      default: 0, 
      min: 0 
    },
    trackQuantity: { 
      type: Boolean, 
      default: true 
    },
    allowBackorder: { 
      type: Boolean, 
      default: false 
    }
  },
  images: [{ 
    type: MediaSchema 
  }],
  isActive: { 
    type: Boolean, 
    default: true
  },
  sortOrder: { 
    type: Number, 
    default: 0
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available quantity
ProductVariantSchema.virtual('availableQuantity').get(function() {
  return this.inventory.quantity - this.inventory.reserved;
});

// Indexes
ProductVariantSchema.index({ productId: 1, isActive: 1 });
ProductVariantSchema.index({ sku: 1 });
ProductVariantSchema.index({ 'inventory.quantity': 1, isActive: 1 });

export const ProductVariants = mongoose.model<IProductVariant>('product_variants', ProductVariantSchema);