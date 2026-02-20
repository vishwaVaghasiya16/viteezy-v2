/**
 * @fileoverview Admin Product FAQ Controller
 * @description Controller for admin product FAQ operations (CRUD)
 * @module controllers/adminProductFaqController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductFAQs } from "@/models/commerce";
import { Products } from "@/models/commerce";
import { FAQStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

class AdminProductFaqController {
  /**
   * Create a new product FAQ
   */
  createProductFaq = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const {
        productId,
        question,
        answer,
        sortOrder = 0,
        status = FAQStatus.ACTIVE,
        isActive = true,
      } = req.body;

      if (!question?.en) {
        throw new AppError("Question (English) is required", 400);
      }

      if (!answer?.en) {
        throw new AppError("Answer (English) is required", 400);
      }

      // Verify product exists
      const productObjectId = ensureObjectId(productId, "product");
      const productExists = await Products.exists({
        _id: productObjectId,
        isDeleted: false,
      });

      if (!productExists) {
        throw new AppError("Product not found", 404);
      }

      const productFaq = await ProductFAQs.create({
        productId: productObjectId,
        question,
        answer,
        sortOrder,
        status: status as FAQStatus,
        isActive,
        createdBy: requesterId,
      });

      res.apiCreated({ productFaq }, "Product FAQ created successfully");
    }
  );

  /**
   * Get paginated list of all product FAQs (Admin view)
   */
  getProductFaqs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { productId, status, isActive, search } = req.query as {
        productId?: string;
        status?: FAQStatus;
        isActive?: boolean | string;
        search?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      // Filter by product ID
      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        filter.productId = new mongoose.Types.ObjectId(productId);
      }

      if (status) {
        filter.status = status;
      }

      // Handle isActive filter
      if (isActive !== undefined) {
        if (typeof isActive === "string") {
          filter.isActive = isActive === "true";
        } else {
          filter.isActive = Boolean(isActive);
        }
      }

      if (search) {
        filter.$or = [
          { "question.en": { $regex: search, $options: "i" } },
          { "question.nl": { $regex: search, $options: "i" } },
          { "answer.en": { $regex: search, $options: "i" } },
          { "answer.nl": { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        sortOrder: 1,
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [productFaqs, total] = await Promise.all([
        ProductFAQs.find(filter)
          .populate("productId", "title slug productImage sachetPrices")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductFAQs.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(productFaqs, pagination, "Product FAQs retrieved");
    }
  );

  /**
   * Get product FAQs by product ID
   */
  getProductFaqsByProductId = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { productId } = req.params;

      const productObjectId = ensureObjectId(productId, "product");

      // Verify product exists
      const productExists = await Products.exists({
        _id: productObjectId,
        isDeleted: false,
      });

      if (!productExists) {
        throw new AppError("Product not found", 404);
      }

      const productFaqs = await ProductFAQs.find({
        productId: productObjectId,
        isDeleted: false,
        isActive: true,
        status: FAQStatus.ACTIVE,
      })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      // Convert ObjectId fields to strings
      const transformedProductFaqs = productFaqs.map((faq: any) => ({
        ...faq,
        _id: faq._id?.toString() || faq._id,
        productId: faq.productId?.toString() || faq.productId,
        createdBy: faq.createdBy?.toString() || faq.createdBy,
        updatedBy: faq.updatedBy?.toString() || faq.updatedBy,
      }));

      res.apiSuccess(
        { productFaqs: transformedProductFaqs },
        "Product FAQs retrieved successfully"
      );
    }
  );

  /**
   * Get product FAQ by ID
   */
  getProductFaqById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const productFaq = await ProductFAQs.findOne({
        _id: id,
        isDeleted: false,
      })
        .populate("productId", "name slug")
        .lean();

      if (!productFaq) {
        throw new AppError("Product FAQ not found", 404);
      }

      res.apiSuccess({ productFaq }, "Product FAQ retrieved successfully");
    }
  );

  /**
   * Update product FAQ
   */
  updateProductFaq = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { question, answer, sortOrder, status, isActive } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const productFaq = await ProductFAQs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!productFaq) {
        throw new AppError("Product FAQ not found", 404);
      }

      // Update fields if provided
      if (question) {
        productFaq.question = question;
      }

      if (answer) {
        productFaq.answer = answer;
      }

      if (sortOrder !== undefined) {
        productFaq.sortOrder = sortOrder;
      }

      if (status) {
        productFaq.status = status as FAQStatus;
      }

      if (isActive !== undefined) {
        productFaq.isActive = Boolean(isActive);
      }

      if (requesterId) {
        (productFaq as any).updatedBy = requesterId;
      }

      await productFaq.save();

      res.apiSuccess({ productFaq }, "Product FAQ updated successfully");
    }
  );

  /**
   * Delete product FAQ (soft delete)
   */
  deleteProductFaq = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const productFaq = await ProductFAQs.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!productFaq) {
        throw new AppError("Product FAQ not found", 404);
      }

      (productFaq as any).isDeleted = true;
      (productFaq as any).deletedAt = new Date();
      await productFaq.save();

      res.apiSuccess(null, "Product FAQ deleted successfully");
    }
  );
}

export const adminProductFaqController = new AdminProductFaqController();
