import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  AuditSchema,
  I18nStringType,
  I18nTextType,
  MediaType,
  AuditType,
} from "../common.model";

// Banner Section for Our Team Page
export interface IOurTeamPageBanner {
  banner_image?: MediaType;
  title: I18nStringType;
  subtitle: I18nTextType;
}

const OurTeamPageBannerSchema = new Schema<IOurTeamPageBanner>(
  {
    banner_image: {
      type: MediaSchema,
    },
    title: {
      type: I18nString,
      default: () => ({}),
    },
    subtitle: {
      type: I18nText,
      default: () => ({}),
    },
  },
  { _id: false }
);

// Our Team Page Settings Document Interface
export interface IOurTeamPage extends Document, AuditType {
  banner: IOurTeamPageBanner;
  createdAt: Date;
  updatedAt: Date;
}

const OurTeamPageSchema = new Schema<IOurTeamPage>(
  {
    banner: {
      type: OurTeamPageBannerSchema,
      default: () => ({}),
    },
    ...(AuditSchema.obj as Record<string, unknown>),
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const OurTeamPage = mongoose.model<IOurTeamPage>(
  "our_team_page",
  OurTeamPageSchema
);
