import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Wishlists, Products } from "@/models/commerce";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class WishlistController {
  addItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { productId, notes } = req.body;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      const product = await Products.findOne({
        _id: productId,
        isDeleted: false,
      }).select("_id");

      if (!product) {
        throw new AppError("Product not found", 404);
      }

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
        notes,
      });

      res.apiCreated({ item }, "Product added to wishlist");
    }
  );

  getItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { includeProduct } = req.query;
      const { page, limit, skip } = getPaginationOptions(req);

      const filter = { userId: req.user._id };

      let query = Wishlists.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      if (includeProduct === "true") {
        query = query.populate({
          path: "productId",
          select: "title slug status media categories tags labels isDeleted",
        });
      }

      const [items, total] = await Promise.all([
        query,
        Wishlists.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(items, pagination, "Wishlist retrieved successfully");
    }
  );

  updateItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { id } = req.params;
      const { notes } = req.body;

      const item = await Wishlists.findOneAndUpdate(
        { _id: id, userId: req.user._id },
        { notes },
        { new: true }
      );

      if (!item) {
        throw new AppError("Wishlist item not found", 404);
      }

      res.apiSuccess({ item }, "Wishlist item updated successfully");
    }
  );

  removeItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { id } = req.params;

      const result = await Wishlists.findOneAndDelete({
        _id: id,
        userId: req.user._id,
      });

      if (!result) {
        throw new AppError("Wishlist item not found", 404);
      }

      res.apiSuccess(null, "Wishlist item removed successfully");
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

      const { productId, notes, status } = req.body;

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
          notes,
        });

        res.apiSuccess(
          { action: "added", item },
          "Product added to wishlist"
        );
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
