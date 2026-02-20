import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Wishlists, Products } from "@/models/commerce";
import { User } from "@/models/core";
import { fetchAndEnrichProducts } from "@/services/productEnrichmentService";
import { cartService } from "@/services/cartService";
import {
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

/**
 * Map user language name to language code
 */
const mapLanguageToCode = (language?: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };

  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request
 */
const getUserLanguage = async (
  req: AuthenticatedRequest,
  userId: string
): Promise<SupportedLanguage> => {
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
  }

  // Fetch user language from database if not in request
  try {
    const user = await User.findById(userId).select("language").lean();
    if (user?.language) {
      return mapLanguageToCode(user.language);
    }
  } catch (error) {
    // If user not found or error, default to English
  }

  return DEFAULT_LANGUAGE;
};

class WishlistController {
  getItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const userId = req.user._id;
      const userLang = await getUserLanguage(req, userId);
      const { page, limit, skip } = getPaginationOptions(req);

      const filter = { userId: new mongoose.Types.ObjectId(userId) };

      // Get wishlist items with product IDs
      const [wishlistItems, total] = await Promise.all([
        Wishlists.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Wishlists.countDocuments(filter),
      ]);

      if (wishlistItems.length === 0) {
        const pagination = getPaginationMeta(page, limit, total);
        res.apiPaginated([], pagination, "Wishlist items retrieved");
        return;
      }

      // Get product IDs from wishlist items
      const productIds = wishlistItems
        .map((item: any) => item.productId)
        .filter((id: any) => id)
        .map((id: any) => new mongoose.Types.ObjectId(id));

      // Create a set of product IDs for wishlist lookup
      const wishlistProductIds = new Set(
        productIds.map((id: mongoose.Types.ObjectId) => id.toString())
      );

      // Get cart product IDs if user is authenticated (for isInCart field)
      let cartProductIds: Set<string> = new Set();
      if (userId) {
        cartProductIds = await cartService.getCartProductIds(userId);
      }

      // Fetch and enrich products using common service
      const enrichedProducts = await fetchAndEnrichProducts(productIds, {
        userId,
        userLang,
        wishlistProductIds,
      });

      // Create product map for quick lookup
      const productMap = new Map(
        enrichedProducts.map((p: any) => [p._id.toString(), p])
      );

      // Map wishlist items to enriched products
      const enrichedItems = wishlistItems
        .map((item: any) => {
          const product = productMap.get(item.productId.toString());
          if (!product) {
            return null;
          }

          // Add isInWishlist field (always true since these are wishlist items)
          const enrichedProduct = {
            ...product,
            isInWishlist: true, // All products in wishlist API are in wishlist
            // Add isInCart field if user is authenticated
            isInCart: userId ? cartProductIds.has(product._id.toString()) : false,
          };

          return {
            _id: item._id,
            userId: item.userId,
            productId: item.productId,
            product: enrichedProduct,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
        })
        .filter((item) => item !== null);

      // Filter out null items (products that were deleted or not found)
      const validItems = enrichedItems.filter((item) => item !== null);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(validItems, pagination, "Wishlist items retrieved");
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
