import mongoose, { Schema, Document } from 'mongoose';
import { I18nText, PriceSchema, AuditSchema, SoftDelete, I18nTextType, PriceType } from '../common.model';
import { Timezone, TIMEZONE_VALUES } from '../enums';

export interface IExpert extends Document {
  name: string;
  email: string;
  photo?: string;
  bio: I18nTextType;
  languages: string[];
  specializations: string[];
  pricing: PriceType;
  bufferMins: number;
  active: boolean;
  rating?: number;
  reviewCount: number;
  experience: number; // years
  qualifications: string[];
  availability: {
    timezone: Timezone;
    workingDays: number[]; // 0-6 (Sunday-Saturday)
    workingHours: {
      start: string;
      end: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ExpertSchema = new Schema<IExpert>({
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true
  },
  photo: { 
    type: String, 
    trim: true 
  },
  bio: { 
    type: I18nText, 
    default: () => ({}) 
  },
  languages: [{ 
    type: String, 
    lowercase: true, 
    trim: true 
  }],
  specializations: [{ 
    type: String, 
    trim: true 
  }],
  pricing: { 
    type: PriceSchema, 
    default: () => ({ currency: 'EUR', amount: 0, taxRate: 0 }) 
  },
  bufferMins: { 
    type: Number, 
    default: 5, 
    min: 0 
  },
  active: { 
    type: Boolean, 
    default: true
  },
  rating: { 
    type: Number, 
    min: 0, 
    max: 5 
  },
  reviewCount: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  experience: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  qualifications: [{ 
    type: String, 
    trim: true 
  }],
  availability: {
    timezone: { 
      type: String, 
      enum: TIMEZONE_VALUES,
      default: Timezone.UTC 
    },
    workingDays: [{ 
      type: Number, 
      min: 0, 
      max: 6 
    }],
    workingHours: {
      start: { 
        type: String, 
        default: '09:00' 
      },
      end: { 
        type: String, 
        default: '17:00' 
      }
    }
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ExpertSchema.index({ email: 1 });
ExpertSchema.index({ active: 1 });
ExpertSchema.index({ active: 1, rating: -1 });
ExpertSchema.index({ specializations: 1, active: 1 });
ExpertSchema.index({ languages: 1, active: 1 });

export const Experts = mongoose.model<IExpert>('experts', ExpertSchema);