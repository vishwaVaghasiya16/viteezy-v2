import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  SeoSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
  SeoType,
} from "../common.model";
import {
  PageType,
  PageStatus,
  PAGE_TYPE_VALUES,
  PAGE_STATUS_VALUES,
} from "../enums";

export interface IPage extends Document {
  slug: string;
  title: I18nStringType;
  content: I18nTextType;
  pageType: PageType;
  template?: string;
  parentId?: mongoose.Types.ObjectId;
  children: mongoose.Types.ObjectId[];
  sortOrder: number;
  isActive: boolean;
  isHomePage: boolean;
  featuredImage?: MediaType;
  seo: SeoType;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPage>(
  {
    slug: {
      type: String,
      lowercase: true,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    content: {
      type: I18nText,
      default: () => ({}),
    },
    pageType: {
      type: String,
      enum: PAGE_TYPE_VALUES,
      default: PageType.STATIC,
    },
    template: {
      type: String,
      trim: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "pages",
    },
    children: [
      {
        type: Schema.Types.ObjectId,
        ref: "pages",
      },
    ],
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isHomePage: {
      type: Boolean,
      default: false,
    },
    featuredImage: {
      type: MediaSchema,
    },
    seo: {
      type: SeoSchema,
      default: () => ({}),
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
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

// Text search index
PageSchema.index({
  "title.en": "text",
  "title.nl": "text",
  "content.en": "text",
  "content.nl": "text",
});

// Other indexes
PageSchema.index({ parentId: 1, isActive: 1, sortOrder: 1 });
PageSchema.index({ isActive: 1, isHomePage: 1 });
PageSchema.index({ pageType: 1, isActive: 1 });

export const Pages = mongoose.model<IPage>("pages", PageSchema);
