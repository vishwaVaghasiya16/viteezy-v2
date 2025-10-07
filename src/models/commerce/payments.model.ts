import mongoose, { Schema, Document } from 'mongoose';
import { PriceSchema, AuditSchema, SoftDelete, PriceType } from '../common.model';
import { PaymentMethod, PaymentStatus, PAYMENT_METHOD_VALUES, PAYMENT_STATUS_VALUES } from '../enums';

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  amount: PriceType;
  currency: string;
  transactionId?: string;
  gatewayTransactionId?: string;
  gatewayResponse?: Record<string, any>;
  failureReason?: string;
  refundAmount?: PriceType;
  refundReason?: string;
  refundedAt?: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'orders', 
    required: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'users', 
    required: true
  },
  paymentMethod: { 
    type: String, 
    enum: PAYMENT_METHOD_VALUES, 
    required: true
  },
  status: { 
    type: String, 
    enum: PAYMENT_STATUS_VALUES, 
    default: PaymentStatus.PENDING
  },
  amount: { 
    type: PriceSchema, 
    required: true 
  },
  currency: { 
    type: String, 
    required: true, 
    uppercase: true
  },
  transactionId: { 
    type: String, 
    trim: true, 
    unique: true, 
    sparse: true 
  },
  gatewayTransactionId: { 
    type: String, 
    trim: true
  },
  gatewayResponse: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  failureReason: { 
    type: String, 
    trim: true 
  },
  refundAmount: { 
    type: PriceSchema 
  },
  refundReason: { 
    type: String, 
    trim: true 
  },
  refundedAt: { 
    type: Date 
  },
  processedAt: { 
    type: Date 
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
PaymentSchema.index({ orderId: 1, status: 1 });
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ paymentMethod: 1, status: 1 });
PaymentSchema.index({ gatewayTransactionId: 1 });
PaymentSchema.index({ createdAt: -1 });

export const Payments = mongoose.model<IPayment>('payments', PaymentSchema);