import mongoose, { Schema, Document } from 'mongoose';
import { AuditSchema, SoftDelete } from '../common.model';

export interface IExpertSlot extends Document {
  expertId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  isBooked: boolean;
  bookingId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExpertSlotSchema = new Schema<IExpertSlot>({
  expertId: { 
    type: Schema.Types.ObjectId, 
    ref: 'experts', 
    required: true
  },
  date: { 
    type: String, 
    required: true
  },
  startTime: { 
    type: String, 
    required: true 
  },
  endTime: { 
    type: String, 
    required: true 
  },
  isBooked: { 
    type: Boolean, 
    default: false
  },
  bookingId: { 
    type: Schema.Types.ObjectId, 
    ref: 'consultations' 
  },
  ...SoftDelete,
  ...AuditSchema.obj
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Unique constraint to prevent double booking
ExpertSlotSchema.index({ expertId: 1, date: 1, startTime: 1 }, { unique: true });

// Other indexes
ExpertSlotSchema.index({ expertId: 1, isBooked: 1 });
ExpertSlotSchema.index({ date: 1, isBooked: 1 });
ExpertSlotSchema.index({ expertId: 1, date: 1, isBooked: 1 });

export const ExpertSlots = mongoose.model<IExpertSlot>('expert_slots', ExpertSlotSchema);