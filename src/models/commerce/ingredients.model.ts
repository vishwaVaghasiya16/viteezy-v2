import mongoose, { Schema, Document } from "mongoose";
import {
  I18nString,
  I18nText,
  MediaSchema,
  AuditSchema,
  SoftDelete,
  I18nStringType,
  I18nTextType,
  MediaType,
} from "../common.model";
import {
  IngredientType,
  FrequencyType,
  INGREDIENT_TYPE_VALUES,
  FREQUENCY_TYPE_VALUES,
} from "../enums";

export interface IIngredient extends Document {
  name: I18nStringType;
  scientificName?: string;
  description: I18nTextType;
  category: string;
  type: IngredientType;
  benefits: I18nTextType;
  dosage: {
    min: number;
    max: number;
    unit: string;
    frequency: FrequencyType;
  };
  contraindications: I18nTextType;
  sideEffects: I18nTextType;
  interactions: string[];
  image?: MediaType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const IngredientSchema = new Schema<IIngredient>(
  {
    name: {
      type: I18nString,
      default: () => ({}),
    },
    scientificName: {
      type: String,
      trim: true,
    },
    description: {
      type: I18nText,
      default: () => ({}),
    },
    category: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: INGREDIENT_TYPE_VALUES,
    },
    benefits: {
      type: I18nText,
      default: () => ({}),
    },
    dosage: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
      unit: {
        type: String,
        trim: true,
      },
      frequency: {
        type: String,
        enum: FREQUENCY_TYPE_VALUES,
        default: FrequencyType.DAILY,
      },
    },
    contraindications: {
      type: I18nText,
      default: () => ({}),
    },
    sideEffects: {
      type: I18nText,
      default: () => ({}),
    },
    interactions: [
      {
        type: String,
        trim: true,
      },
    ],
    image: {
      type: MediaSchema,
    },
    isActive: {
      type: Boolean,
      default: true,
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
IngredientSchema.index({
  "name.en": "text",
  "name.nl": "text",
  "description.en": "text",
  "description.nl": "text",
  scientificName: "text",
});

// Other indexes
IngredientSchema.index({ type: 1, isActive: 1 });
IngredientSchema.index({ category: 1, isActive: 1 });
IngredientSchema.index({ isActive: 1 });

export const Ingredients = mongoose.model<IIngredient>(
  "ingredients",
  IngredientSchema
);
