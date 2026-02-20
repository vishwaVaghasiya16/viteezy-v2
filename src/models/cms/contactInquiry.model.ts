import mongoose, { Schema, Document } from "mongoose";

export interface IContactInquiry extends Document {
  subject: string;
  name?: string;
  email: string;
  phone?: string;
  message: string;
  privacyAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContactInquirySchema = new Schema<IContactInquiry>(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    privacyAccepted: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ContactInquirySchema.index({ email: 1, createdAt: -1 });
ContactInquirySchema.index({ createdAt: -1 });

export const ContactInquiry = mongoose.model<IContactInquiry>(
  "contact_inquiries",
  ContactInquirySchema
);
