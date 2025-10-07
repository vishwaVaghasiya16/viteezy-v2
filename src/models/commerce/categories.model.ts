import mongoose, { Schema, Document } from 'mongoose';
import { I18nString, I18nText, MediaSchema, SeoSchema, AuditSchema, SoftDelete, I18nStringType, I18nTextType, MediaType, SeoType } from '../common.model';

export interface ICategory extends Document {
  slug: string;
  name: I18nStringType;
  description: I18nTextType;
  parentId?: mongoose.Types.ObjectId;
  children: mongoose.Types.ObjectId[];
  level: number;
  sortOrder: number;
  icon?: string;
  image?: MediaType;
  seo: SeoType;
  isActive: boolean;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  slug: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true
  },
  name: { 
    type: I18nString, 
    required: true, 
    default: () => ({}) 
  },
  description: { 
    type: I18nText, 
    default: () => ({}) 
  },
  parentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'categories'
  },
  children: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'categories' 
  }],
  level: { 
    type: Number, 
    default: 0, 
    min: 0
  },
  sortOrder: { 
    type: Number, 
    default: 0
  },
  icon: { 
    type: String, 
    trim: true 
  },
  image: { 
    type: MediaSchema 
  },
  seo: { 
    type: SeoSchema, 
    default: () => ({}) 
  },
  isActive: { 
    type: Boolean, 
    default: true
  },
  productCount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Text search index
CategorySchema.index({ 
  'name.en': 'text', 
  'name.nl': 'text', 
  'description.en': 'text', 
  'description.nl': 'text' 
});

// Other indexes
CategorySchema.index({ parentId: 1, isActive: 1, sortOrder: 1 });
CategorySchema.index({ level: 1, isActive: 1 });
CategorySchema.index({ isActive: 1, productCount: -1 });

export const Categories = mongoose.model<ICategory>('categories', CategorySchema);