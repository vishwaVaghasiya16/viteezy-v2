import mongoose, { Schema, Document } from "mongoose";
import { I18nString, SoftDelete, I18nStringType } from "../common.model";

export interface IBlog extends Document {
  title: I18nStringType;
  description: I18nStringType;
  seo: {
    metaTitle?: string;
    metaSlug?: string;
    metaDescription?: string;
  };
  coverImage?: string | null;
  isActive: boolean;
  authorId?: mongoose.Types.ObjectId | null;
  categoryId: mongoose.Types.ObjectId;
  viewCount: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    title: {
      type: I18nString,
      default: () => ({}),
    },
    description: {
      type: I18nString,
      default: () => ({}),
    },
    seo: {
      metaTitle: {
        type: String,
        trim: true,
        default: null,
      },
      metaSlug: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
      },
      metaDescription: {
        type: String,
        trim: true,
        default: null,
      },
    },
    coverImage: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "blog_categories",
      required: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    ...SoftDelete,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Text search index
BlogSchema.index({
  "title.en": "text",
  "title.nl": "text",
});

// Other indexes
BlogSchema.index({ "seo.metaSlug": 1 });
BlogSchema.index({ authorId: 1, isActive: 1 });
BlogSchema.index({ categoryId: 1, isActive: 1 });
BlogSchema.index({ viewCount: -1 });
BlogSchema.index({ isActive: 1, isDeleted: 1 });

export const Blogs = mongoose.model<IBlog>("blogs", BlogSchema);
