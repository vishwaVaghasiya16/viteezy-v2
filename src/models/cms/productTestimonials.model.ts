import mongoose, { Schema, Document } from "mongoose";
import { AuditSchema, SoftDelete, AuditType } from "../common.model";

export interface IProductTestimonial extends Document, AuditType {
  videoUrl: string; // Video/reel URL (stored in cloud storage)
  videoThumbnail?: string; // Optional thumbnail image
  products: mongoose.Types.ObjectId[]; // Array of product IDs
  isVisibleOnHomepage: boolean; // Show on homepage or not
  isActive: boolean;
  displayOrder?: number; // For ordering testimonials
  metadata?: Record<string, any>;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProductTestimonialSchema = new Schema<IProductTestimonial>(
  {
    videoUrl: {
      type: String,
      required: [true, "Video URL is required"],
      trim: true,
    },
    videoThumbnail: {
      type: String,
      trim: true,
      default: null,
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: "products",
        required: true,
      },
    ],
    isVisibleOnHomepage: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ...SoftDelete,
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
ProductTestimonialSchema.index({ isActive: 1, isVisibleOnHomepage: 1 });
ProductTestimonialSchema.index({ products: 1 });
ProductTestimonialSchema.index({ displayOrder: 1 });
ProductTestimonialSchema.index({ isDeleted: 1 });

export const ProductTestimonials = mongoose.model<IProductTestimonial>(
  "product_testimonials",
  ProductTestimonialSchema
);
