import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Reviews } from "@/models/cms/reviews.model";
import { Products, Orders } from "@/models/commerce";
import { ReviewStatus, OrderStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class ProductReviewController {
  /**
   * Add product review
   */
  addProductReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { productId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      const product = await Products.findOne({
        _id: productId,
        isDeleted: { $ne: true },
      })
        .select("_id title slug status")
        .lean();
      if (!product) {
        throw new AppError("Product not found", 404);
      }

      const existingReview = await Reviews.findOne({
        userId,
        productId,
        isDeleted: { $ne: true },
      }).lean();

      if (existingReview) {
        throw new AppError("You have already reviewed this product", 400);
      }

      const hasPurchased = await Orders.exists({
        userId,
        "items.productId": new mongoose.Types.ObjectId(productId),
        status: { $ne: OrderStatus.CANCELLED },
      });

      if (!hasPurchased) {
        throw new AppError(
          "You can only review products you have purchased",
          400
        );
      }

      const { rating, title, content, images } = req.body;

      const review = await Reviews.create({
        userId,
        productId,
        rating,
        title: title ? { en: title } : {},
        content: content ? { en: content } : {},
        images,
        status: ReviewStatus.PENDING,
        isVerified: true,
      });

      res.status(201).json({
        success: true,
        message: "Review submitted successfully",
        data: { review },
      });
    }
  );

  /**
   * List logged-in user's product reviews
   */
  listMyProductReviews = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const query = {
        userId,
        productId: { $exists: true, $ne: null },
        isDeleted: { $ne: true },
      };

      const [reviews, total] = await Promise.all([
        Reviews.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate("productId", "title slug media price status")
          .lean(),
        Reviews.countDocuments(query),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiSuccess(
        { reviews, pagination },
        "Product reviews retrieved successfully"
      );
    }
  );

  /**
   * Update user's product review
   */
  updateProductReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { reviewId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        throw new AppError("Invalid review ID", 400);
      }

      const review = await Reviews.findOne({
        _id: reviewId,
        userId,
        isDeleted: { $ne: true },
      });

      if (!review) {
        throw new AppError("Review not found", 404);
      }

      const { rating, title, content, images } = req.body;
      if (rating !== undefined) {
        review.rating = rating;
      }
      if (title !== undefined) {
        review.title = title ? { en: title } : {};
      }
      if (content !== undefined) {
        review.content = content ? { en: content } : {};
      }
      if (images !== undefined) {
        review.images = images;
      }

      review.status = ReviewStatus.PENDING;
      await review.save();

      res.apiSuccess({ review }, "Review updated successfully");
    }
  );

  /**
   * Delete user's product review
   */
  deleteProductReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { reviewId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        throw new AppError("Invalid review ID", 400);
      }

      const review = await Reviews.findOne({
        _id: reviewId,
        userId,
        isDeleted: { $ne: true },
      });

      if (!review) {
        throw new AppError("Review not found", 404);
      }

      (review as any).isDeleted = true;
      (review as any).deletedAt = new Date();
      await review.save();

      res.apiSuccess(null, "Review deleted successfully");
    }
  );
}

export const productReviewController = new ProductReviewController();
