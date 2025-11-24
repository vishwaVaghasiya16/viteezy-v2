import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete } from "../common.model";
import { PaymentMethod, PAYMENT_METHOD_VALUES } from "../enums";

export interface ISavedCard extends Document {
  userId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  // Card display information (safe to store)
  last4: string; // Last 4 digits of card
  cardType: string; // Visa, Mastercard, Amex, etc.
  cardholderName?: string;
  expiryMonth: number; // 1-12
  expiryYear: number; // YYYY
  // Payment gateway tokenization
  gatewayToken?: string; // Payment method ID from gateway (Stripe, Mollie, etc.)
  gatewayCustomerId?: string; // Customer ID in payment gateway
  // Card metadata
  isDefault: boolean;
  isActive: boolean;
  billingAddressId?: mongoose.Types.ObjectId; // Link to billing address
  // Additional metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SavedCardSchema = new Schema<ISavedCard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHOD_VALUES,
      required: true,
    },
    last4: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}$/, // Exactly 4 digits
    },
    cardType: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "Visa",
        "Mastercard",
        "American Express",
        "Discover",
        "Diners Club",
        "JCB",
        "UnionPay",
        "Other",
      ],
    },
    cardholderName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    expiryMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    expiryYear: {
      type: Number,
      required: true,
      min: new Date().getFullYear(),
      max: new Date().getFullYear() + 20,
    },
    gatewayToken: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple nulls but enforce uniqueness when present
    },
    gatewayCustomerId: {
      type: String,
      trim: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    billingAddressId: {
      type: Schema.Types.ObjectId,
      ref: "addresses",
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
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

// Virtual for masked card number
SavedCardSchema.virtual("maskedCardNumber").get(function () {
  return `**** **** **** ${this.last4}`;
});

// Virtual for formatted expiry
SavedCardSchema.virtual("formattedExpiry").get(function () {
  const month = this.expiryMonth.toString().padStart(2, "0");
  return `${month}/${this.expiryYear}`;
});

// Virtual for isExpired
SavedCardSchema.virtual("isExpired").get(function () {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11

  if (this.expiryYear < currentYear) {
    return true;
  }
  if (this.expiryYear === currentYear && this.expiryMonth < currentMonth) {
    return true;
  }
  return false;
});

// Indexes
SavedCardSchema.index({ userId: 1, isActive: 1 });
SavedCardSchema.index({ userId: 1, isDefault: 1 });
SavedCardSchema.index({ userId: 1, paymentMethod: 1 });
SavedCardSchema.index({ gatewayToken: 1 }, { unique: true, sparse: true });
SavedCardSchema.index({ gatewayCustomerId: 1 });

// Pre-save hook: Ensure only one default card per user
SavedCardSchema.pre("save", async function (next) {
  if (this.isDefault && this.isModified("isDefault")) {
    // Unset other default cards for this user
    await SavedCards.updateMany(
      {
        userId: this.userId,
        _id: { $ne: this._id },
        isDeleted: false,
      },
      { $set: { isDefault: false } }
    );
  }
  next();
});

export const SavedCards = mongoose.model<ISavedCard>(
  "saved_cards",
  SavedCardSchema
);
