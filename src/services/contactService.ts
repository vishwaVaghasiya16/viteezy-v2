import mongoose from "mongoose";
import { ContactInquiry, FooterSubscription } from "@/models/cms";
import { AppError } from "@/utils/AppError";

export interface SubmitContactInput {
  subject: string;
  name?: string;
  email: string;
  phone?: string;
  message: string;
  privacyAccepted: boolean;
}

export interface ContactListFilters {
  page?: number;
  limit?: number;
  search?: string;
  sort?: Record<string, 1 | -1>;
}

class ContactService {
  async submitContact(data: SubmitContactInput) {
    const inquiry = await ContactInquiry.create({
      subject: data.subject,
      name: data.name || undefined,
      email: data.email,
      phone: data.phone || undefined,
      message: data.message,
      privacyAccepted: data.privacyAccepted,
    });
    return inquiry.toObject ? inquiry.toObject() : inquiry;
  }

  async getContactById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid contact inquiry ID", 400);
    }
    const inquiry = await ContactInquiry.findById(id).lean();
    if (!inquiry) {
      throw new AppError("Contact inquiry not found", 404);
    }
    return inquiry;
  }

  async listContactInquiries(filters: ContactListFilters) {
    const { page = 1, limit = 10, search, sort } = filters;
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const limitNum = Math.min(100, Math.max(1, limit));

    const query: Record<string, unknown> = {};
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { subject: regex },
        { name: regex },
        { email: regex },
        { phone: regex },
        { message: regex },
      ];
    }

    const sortOpt = sort && Object.keys(sort).length
      ? sort
      : { createdAt: -1 as 1 | -1 };

    const [items, total] = await Promise.all([
      ContactInquiry.find(query).sort(sortOpt).skip(skip).limit(limitNum).lean(),
      ContactInquiry.countDocuments(query),
    ]);

    return { items, total, page, limit: limitNum };
  }

  async footerSubscribe(email: string): Promise<{ subscribed: boolean; alreadySubscribed: boolean }> {
    const normalized = email.trim().toLowerCase();
    const existing = await FooterSubscription.findOne({ email: normalized }).lean();
    if (existing) {
      return { subscribed: true, alreadySubscribed: true };
    }
    await FooterSubscription.create({
      email: normalized,
      source: "footer",
    });
    return { subscribed: true, alreadySubscribed: false };
  }
}

export const contactService = new ContactService();
