/**
 * @fileoverview Family Mapping Model
 * @description Database model for family member relationships
 * @module models/core/familyMapping.model
 */

import mongoose, { Schema, Document } from "mongoose";

export interface IFamilyMapping extends Document {
  _id: string;
  mainMemberId: mongoose.Types.ObjectId;
  subMemberId: mongoose.Types.ObjectId;
  relationshipToParent?: string; // e.g., "Child", "Spouse", "Parent", "Sibling", "Other"
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean; // Soft delete field
  removedAt?: Date; // Soft delete timestamp
  removedBy?: mongoose.Types.ObjectId; // User who performed removal
}

const familyMappingSchema = new Schema<IFamilyMapping>(
  {
    mainMemberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Main member ID is required"],
      index: true,
    },
    subMemberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sub-member ID is required"],
      unique: true, // One sub-member can belong to only one main member
      index: true,
    },
    relationshipToParent: {
      type: String,
      trim: true,
      maxlength: [50, "Relationship cannot exceed 50 characters"],
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // For efficient active record filtering
    },
    removedAt: {
      type: Date,
      default: null,
      index: true, // For efficient soft delete queries
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true, // For tracking removal actions
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "familymappings",
  }
);

// Compound index for efficient queries
familyMappingSchema.index({ mainMemberId: 1, subMemberId: 1 });

// Index for soft delete queries
familyMappingSchema.index({ isActive: 1, mainMemberId: 1 });
familyMappingSchema.index({ isActive: 1, subMemberId: 1 });

// Ensure sub-member cannot be linked to themselves
familyMappingSchema.pre("save", function (next: any) {
  if (this.mainMemberId.toString() === this.subMemberId.toString()) {
    return next(new Error("Main member and sub-member cannot be the same user"));
  }
  next();
});

export const FamilyMapping = mongoose.model<IFamilyMapping>("FamilyMapping", familyMappingSchema);
