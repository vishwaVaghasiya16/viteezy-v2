import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  AuditType,
} from "../common.model";
import { DeviceType, DEVICE_TYPE_VALUES } from "../enums";

/**
 * Header Banner document interface
 */
export interface IHeaderBanner extends Document, AuditType {
  text: I18nStringType; // Banner text (separate for web and mobile)
  deviceType: DeviceType; // WEB or MOBILE
  isActive: boolean; // Only one banner per device type can be active
  isDeleted?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Header Banner schema
 */
const headerBannerSchema: Schema<IHeaderBanner> = new Schema(
  {
    text: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    deviceType: {
      type: String,
      enum: DEVICE_TYPE_VALUES,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
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

// Compound index to ensure only one active banner per device type
headerBannerSchema.index(
  { deviceType: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true, isDeleted: { $ne: true } },
  }
);

// Indexes
headerBannerSchema.index({ isDeleted: 1, deviceType: 1, isActive: 1 });
headerBannerSchema.index({ createdAt: -1 });

export const HeaderBanner = mongoose.model<IHeaderBanner>(
  "header_banner",
  headerBannerSchema
);

