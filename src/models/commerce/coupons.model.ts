import mongoose, { Schema, Document } from 'mongoose';
import { I18nString, PriceSchema, AuditSchema, SoftDelete, I18nStringType } from '../common.model';
import { CouponType, COUPON_TYPE_VALUES } from '../enums';

export interface ICoupon extends Document {
  code: string;
  name: I18nStringType;
  description: I18nStringType;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  userUsageLimit?: number;
  applicableProducts: mongoose.Types.ObjectId[];
  applicableCategories: mongoose.Types.ObjectId[];
  excludedProducts: mongoose.Types.ObjectId[];
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>({
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true, 
    trim: true
  },
  name: { 
    type: I18nString, 
    required: true, 
    default: () => ({}) 
  },
  description: { 
    type: I18nString, 
    default: () => ({}) 
  },
  type: { 
    type: String, 
    enum: COUPON_TYPE_VALUES, 
    required: true
  },
  value: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  minOrderAmount: { 
    type: Number, 
    min: 0 
  },
  maxDiscountAmount: { 
    type: Number, 
    min: 0 
  },
  usageLimit: { 
    type: Number, 
    min: 1 
  },
  usageCount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  userUsageLimit: { 
    type: Number, 
    min: 1 
  },
  applicableProducts: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'products' 
  }],
  applicableCategories: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'categories' 
  }],
  excludedProducts: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'products' 
  }],
  validFrom: { 
    type: Date, 
    required: true
  },
  validUntil: { 
    type: Date, 
    required: true
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
CouponSchema.index({ code: 1, isActive: 1 });
CouponSchema.index({ validFrom: 1, validUntil: 1, isActive: 1 });
CouponSchema.index({ applicableProducts: 1 });
CouponSchema.index({ applicableCategories: 1 });

export const Coupons = mongoose.model<ICoupon>('coupons', CouponSchema);