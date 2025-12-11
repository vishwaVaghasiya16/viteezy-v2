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

export interface ITeamMember extends Document, AuditType {
  image?: string | null; // User image URL
  name: I18nStringType; // Name in multiple languages
  designation: I18nStringType; // Designation/Job title in multiple languages
  content: I18nTextType; // Content/About in multiple languages
  isDeleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    image: {
      type: String,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      trim: true,
    },
    designation: {
      type: I18nString,
      default: () => ({}),
      required: true,
    },
    content: {
      type: I18nText,
      default: () => ({}),
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

// Text search index for name and designation
TeamMemberSchema.index({
  "name.en": "text",
  "name.nl": "text",
  "designation.en": "text",
  "designation.nl": "text",
});

// Index for efficient queries
TeamMemberSchema.index({ isDeleted: 1, createdAt: -1 });

export const TeamMembers = mongoose.model<ITeamMember>(
  "team_members",
  TeamMemberSchema
);
