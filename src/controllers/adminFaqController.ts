import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { FAQs, FaqCategories } from "@/models/cms";
import { FAQStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

const sanitizeTags = (tags?: string[]): string[] => {
  if (!Array.isArray(tags)) return [];
  return Array.from(
    new Set(tags.map((tag) => tag?.trim()).filter((tag) => !!tag))
  );
};

class AdminFaqController {
  /**
   * Create a new FAQ
   */
  createFaq = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;
      const {
        question,
        answer,
        categoryId,
        tags,
        sortOrder,
        status = FAQStatus.ACTIVE,
        isActive,
      } = req.body;

      let categoryObjectId: mongoose.Types.ObjectId | undefined;
      if (categoryId) {
        categoryObjectId = ensureObjectId(categoryId, "category");
        const categoryExists = await FaqCategories.exists({
          _id: categoryObjectId,
          isDeleted: false,
          isActive: true,
        });

        if (!categoryExists) {
          throw new AppError("FAQ category not found or inactive", 404);
        }
      }

      const faq = await FAQs.create({
        question,
        answer,
        categoryId: categoryObjectId,
        tags: sanitizeTags(tags),
        sortOrder: sortOrder ?? 0,
        status: status as FAQStatus,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: requesterId,
      });

      res.apiCreated({ faq }, "FAQ created successfully");
    }
  );

  /**
   * Get paginated list of all FAQs (Admin view)
   */
  getFaqs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip, sort } = getPaginationOptions(req);
    const { status, search, categoryId } = req.query as {
      status?: FAQStatus;
      search?: string;
      categoryId?: string;
    };

    const filter: Record<string, any> = {
      isDeleted: false,
    };

    if (status) {
      filter.status = status;
    }

    if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    if (search) {
      filter.$or = [
        { "question.en": { $regex: search, $options: "i" } },
        { "question.nl": { $regex: search, $options: "i" } },
        { "answer.en": { $regex: search, $options: "i" } },
        { "answer.nl": { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions: Record<string, 1 | -1> = {
      sortOrder: 1,
      createdAt: -1,
      ...((sort as Record<string, 1 | -1>) || {}),
    };

    const [faqs, total] = await Promise.all([
      FAQs.find(filter)
        .populate("categoryId", "title slug")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      FAQs.countDocuments(filter),
    ]);

    const pagination = getPaginationMeta(page, limit, total);

    res.apiPaginated(faqs, pagination, "FAQs retrieved");
  });

  /**
   * Get FAQ by ID
   */
  getFaqById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const faq = await FAQs.findOne({
        _id: id,
        isDeleted: false,
      })
        .populate("categoryId", "title slug")
        .lean();

      if (!faq) {
        throw new AppError("FAQ not found", 404);
      }

      res.apiSuccess({ faq }, "FAQ retrieved successfully");
    }
  );

  /**
   * Update FAQ
   */
  updateFaq = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        question,
        answer,
        categoryId,
        tags,
        sortOrder,
        status,
        isActive,
      } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const faq = await FAQs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!faq) {
        throw new AppError("FAQ not found", 404);
      }

      if (categoryId !== undefined) {
        if (categoryId === null) {
          faq.categoryId = undefined;
        } else {
          const categoryObjectId = ensureObjectId(categoryId, "category");
          const categoryExists = await FaqCategories.exists({
            _id: categoryObjectId,
            isDeleted: false,
          });
          if (!categoryExists) {
            throw new AppError("FAQ category not found", 404);
          }
          faq.categoryId = categoryObjectId;
        }
      }

      if (question) faq.question = question;
      if (answer) faq.answer = answer;
      if (typeof tags !== "undefined") faq.tags = sanitizeTags(tags);
      if (sortOrder !== undefined) faq.sortOrder = sortOrder;
      if (status) faq.status = status as FAQStatus;
      if (isActive !== undefined) faq.isActive = isActive;

      if (requesterId) faq.updatedBy = requesterId;

      await faq.save();

      res.apiSuccess({ faq }, "FAQ updated successfully");
    }
  );

  /**
   * Delete FAQ (soft delete)
   */
  deleteFaq = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const faq = await FAQs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!faq) {
        throw new AppError("FAQ not found", 404);
      }

      faq.isDeleted = true;
      faq.deletedAt = new Date();
      await faq.save();

      res.apiSuccess(null, "FAQ deleted successfully");
    }
  );
}

export const adminFaqController = new AdminFaqController();
