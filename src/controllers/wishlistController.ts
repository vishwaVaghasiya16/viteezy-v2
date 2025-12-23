import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Wishlists, Products } from "@/models/commerce";
import { Reviews } from "@/models/cms";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class WishlistController {
  getItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip } = getPaginationOptions(req);

      const filter = { userId: req.user._id };

      const [items, total] = await Promise.all([
        Wishlists.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate({
            path: "productId",
            select:
              "title slug productImage price media tags labels isDeleted pricing description",
          }),
        Wishlists.countDocuments(filter),
      ]);

      // Get review stats for all products
      const productIds = items
        .map((item: any) => item.productId?._id)
        .filter(Boolean);

      const reviewStats = await Reviews.aggregate([
        {
          $match: {
            productId: { $in: productIds },
            status: "approved",
            isPublic: true,
          },
        },
        {
          $group: {
            _id: "$productId",
            totalReviews: { $sum: 1 },
            averageRating: { $avg: "$rating" },
          },
        },
      ]);

      const reviewStatsMap = new Map(
        reviewStats.map((stat) => [stat._id.toString(), stat])
      );

      // Add review stats to each item and remove id field from productId
      const itemsWithReviews = items.map((item: any) => {
        const itemObj = item.toObject();
        if (itemObj.productId?._id) {
          const stats = reviewStatsMap.get(itemObj.productId._id.toString());
          itemObj.productId.reviewStats = {
            totalReviews: stats?.totalReviews || 0,
            averageRating: stats?.averageRating
              ? Math.round(stats.averageRating * 10) / 10
              : 0,
          };
          // Remove id field, keep only _id
          if (itemObj.productId.id) {
            delete itemObj.productId.id;
          }
        }
        return itemObj;
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        itemsWithReviews,
        pagination,
        "Wishlist items retrieved"
      );
    }
  );

  getCount = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const count = await Wishlists.countDocuments({ userId: req.user._id });

      res.apiSuccess({ count }, "Wishlist count retrieved successfully");
    }
  );

  /**
   * Toggle wishlist item - Add or Remove based on status
   * status: 0 = Add to wishlist, status: 1 = Remove from wishlist
   * Single endpoint to manage add/remove operations
   */
  toggleItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { productId, status } = req.body;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      // Validate status: 0 = add, 1 = remove
      if (status !== 0 && status !== 1) {
        throw new AppError("Status must be 0 (add) or 1 (remove)", 400);
      }

      const product = await Products.findOne({
        _id: productId,
        isDeleted: false,
      }).select("_id");

      if (!product) {
        throw new AppError("Product not found", 404);
      }

      if (status === 0) {
        // Add to wishlist
        const existing = await Wishlists.findOne({
          userId: req.user._id,
          productId,
        });

        if (existing) {
          throw new AppError("Product already in wishlist", 409);
        }

        const item = await Wishlists.create({
          userId: req.user._id,
          productId,
        });

        res.apiSuccess({ action: "added", item }, "Product added to wishlist");
      } else {
        // Remove from wishlist (status === 1)
        const existing = await Wishlists.findOne({
          userId: req.user._id,
          productId,
        });

        if (!existing) {
          throw new AppError("Product not found in wishlist", 404);
        }

        await Wishlists.findOneAndDelete({
          _id: existing._id,
          userId: req.user._id,
        });

        res.apiSuccess(
          { action: "removed", item: null },
          "Product removed from wishlist"
        );
      }
    }
  );
}

export const wishlistController = new WishlistController();
