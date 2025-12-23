import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Wishlists, Products } from "@/models/commerce";
import { ProductVariants } from "@/models/commerce/productVariants.model";
import { ProductIngredients } from "@/models/commerce/productIngredients.model";
import { Reviews } from "@/models/cms";
import { User } from "@/models/core";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "@/utils/membershipPrice";
import {
  I18nStringType,
  I18nTextType,
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

/**
 * Get translated string from I18nStringType
 */
const getTranslatedString = (
  i18nString: I18nStringType | string | undefined,
  lang: SupportedLanguage
): string => {
  if (!i18nString) return "";

  if (typeof i18nString === "string") {
    return i18nString;
  }

  return i18nString[lang] || i18nString.en || "";
};

/**
 * Get translated text from I18nTextType
 */
const getTranslatedText = (
  i18nText: I18nTextType | string | undefined,
  lang: SupportedLanguage
): string => {
  if (!i18nText) return "";

  if (typeof i18nText === "string") {
    return i18nText;
  }

  return i18nText[lang] || i18nText.en || "";
};

/**
 * Transform product to use user's language
 */
const transformProductForLanguage = (
  product: any,
  lang: SupportedLanguage
): any => {
  return {
    ...product,
    title: getTranslatedString(product.title, lang),
    description: getTranslatedText(product.description, lang),
    nutritionInfo: getTranslatedText(product.nutritionInfo, lang),
    howToUse: getTranslatedText(product.howToUse, lang),
    variants:
      product.variants?.map((variant: any) => ({
        ...variant,
        name: getTranslatedString(variant.name, lang),
      })) ||
      product.variants ||
      [],
    ingredients:
      product.ingredients?.map((ingredient: any) => ({
        ...ingredient,
        name: getTranslatedString(ingredient.name, lang),
        description: getTranslatedText(ingredient.description, lang),
        image: ingredient.image || undefined,
      })) || [],
    categories:
      product.categories?.map((category: any) => ({
        ...category,
        name: getTranslatedString(category.name, lang),
        description: getTranslatedText(category.description, lang),
        image: category.image || undefined,
      })) || [],
  };
};

/**
 * Calculate monthly amount from totalAmount and durationDays
 */
const calculateMonthlyAmount = (
  totalAmount: number | undefined,
  durationDays: number | undefined
): number | undefined => {
  if (!totalAmount || !durationDays || durationDays <= 0) {
    return undefined;
  }
  const months = durationDays / 30;
  return Math.round((totalAmount / months) * 100) / 100;
};

/**
 * Calculate monthly amounts for all subscription prices in a product
 */
const calculateMonthlyAmounts = (product: any): any => {
  const result = { ...product };

  if (product.sachetPrices) {
    const sachetPrices = { ...product.sachetPrices };

    const periods = [
      "thirtyDays",
      "sixtyDays",
      "ninetyDays",
      "oneEightyDays",
    ] as const;

    periods.forEach((period) => {
      if (sachetPrices[period]) {
        const periodData = { ...sachetPrices[period] };
        if (
          !periodData.amount &&
          periodData.totalAmount &&
          periodData.durationDays
        ) {
          periodData.amount = calculateMonthlyAmount(
            periodData.totalAmount,
            periodData.durationDays
          );
        }
        sachetPrices[period] = periodData;
      }
    });

    if (sachetPrices.oneTime) {
      sachetPrices.oneTime = {
        count30: { ...sachetPrices.oneTime.count30 },
        count60: { ...sachetPrices.oneTime.count60 },
      };
    }

    result.sachetPrices = sachetPrices;
  }

  if (product.standupPouchPrice) {
    if (product.standupPouchPrice.count30 || product.standupPouchPrice.count60) {
      result.standupPouchPrice = {
        count30: { ...product.standupPouchPrice.count30 },
        count60: { ...product.standupPouchPrice.count60 },
      };
    } else {
      result.standupPouchPrice = { ...product.standupPouchPrice };
    }
  }

  return result;
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
        .filter((id: any) => id);

      // Fetch products with full details
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: false,
        status: true,
      })
        .populate("categories", "name slug description image")
        .lean();

      // Manually populate ingredients for all products
      const allIngredientIds: string[] = [];
      products.forEach((product: any) => {
        if (product.ingredients && Array.isArray(product.ingredients)) {
          product.ingredients.forEach((ingredientId: any) => {
            const id =
              typeof ingredientId === "string"
                ? ingredientId
                : ingredientId?.toString();
            if (
              id &&
              mongoose.Types.ObjectId.isValid(id) &&
              !allIngredientIds.includes(id)
            ) {
              allIngredientIds.push(id);
            }
          });
        }
      });

      // Fetch all ingredient details
      const ingredientDetailsMap = new Map();
      if (allIngredientIds.length > 0) {
        const ingredientDetails = await ProductIngredients.find({
          _id: {
            $in: allIngredientIds.map(
              (id: string) => new mongoose.Types.ObjectId(id)
            ),
          },
        })
          .select("_id name description image")
          .lean();

        ingredientDetails.forEach((ingredient: any) => {
          ingredientDetailsMap.set(ingredient._id.toString(), ingredient);
        });
      }

      // Replace ingredient IDs with populated ingredient objects
      products.forEach((product: any) => {
        if (product.ingredients && Array.isArray(product.ingredients)) {
          product.ingredients = product.ingredients
            .map((ingredientId: any) => {
              const id =
                typeof ingredientId === "string"
                  ? ingredientId
                  : ingredientId?.toString();
              return ingredientDetailsMap.get(id);
            })
            .filter((ingredient: any) => ingredient !== undefined);
        }
      });

      // Get review stats for all products
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

      // Create product map for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p])
      );

      // Transform products and add member pricing
      const enrichedItems = await Promise.all(
        wishlistItems.map(async (item: any) => {
          const product = productMap.get(item.productId.toString());
          if (!product) {
            return null;
          }

          // Transform product for language
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );

          // Calculate monthly amounts for subscription pricing
          const productWithMonthlyAmounts = calculateMonthlyAmounts(
            transformedProduct
          );

          // Calculate member pricing
          const productPriceSource: ProductPriceSource = {
            price: productWithMonthlyAmounts.price,
            memberPrice: productWithMonthlyAmounts.metadata?.memberPrice,
            memberDiscountOverride:
              productWithMonthlyAmounts.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(
            productPriceSource,
            userId
          );

          // Get review stats
          const stats = reviewStatsMap.get(product._id.toString());

          // Build full product object similar to getAllProducts format
          let enrichedProduct: any = {
            _id: productWithMonthlyAmounts._id,
            title: productWithMonthlyAmounts.title,
            slug: productWithMonthlyAmounts.slug,
            productImage: productWithMonthlyAmounts.productImage,
            shortDescription: productWithMonthlyAmounts.shortDescription,
            description: productWithMonthlyAmounts.description,
            nutritionInfo: productWithMonthlyAmounts.nutritionInfo,
            howToUse: productWithMonthlyAmounts.howToUse,
            price: productWithMonthlyAmounts.price,
            variant: productWithMonthlyAmounts.variant,
            hasStandupPouch: productWithMonthlyAmounts.hasStandupPouch,
            sachetPrices: productWithMonthlyAmounts.sachetPrices,
            standupPouchPrice: productWithMonthlyAmounts.standupPouchPrice,
            categories: productWithMonthlyAmounts.categories || [],
            ingredients: productWithMonthlyAmounts.ingredients || [],
            variants: productWithMonthlyAmounts.variants || [],
            metadata: productWithMonthlyAmounts.metadata,
            skuRoot: productWithMonthlyAmounts.skuRoot,
            galleryImages: productWithMonthlyAmounts.galleryImages,
            isFeatured: productWithMonthlyAmounts.isFeatured,
            comparisonSection: productWithMonthlyAmounts.comparisonSection,
            specification: productWithMonthlyAmounts.specification,
            seo: productWithMonthlyAmounts.seo,
            status: productWithMonthlyAmounts.status,
            createdAt: productWithMonthlyAmounts.createdAt,
            updatedAt: productWithMonthlyAmounts.updatedAt,
            reviewStats: {
              totalReviews: stats?.totalReviews || 0,
              averageRating: stats?.averageRating
                ? Math.round(stats.averageRating * 10) / 10
                : 0,
            },
            is_liked: true, // Always true for wishlist items
          };

          // Add member pricing if user is a member
          if (memberPriceResult.isMember) {
            enrichedProduct.memberPrice = memberPriceResult.memberPrice;
            enrichedProduct.originalPrice = memberPriceResult.originalPrice;
            enrichedProduct.discount = {
              amount: memberPriceResult.discountAmount,
              percentage: memberPriceResult.discountPercentage,
              type: memberPriceResult.appliedDiscount?.type,
            };
            enrichedProduct.isMember = true;
          } else {
            enrichedProduct.isMember = false;
          }

          return {
            _id: item._id,
            userId: item.userId,
            productId: item.productId,
            product: enrichedProduct,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          };
        })
      );

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
