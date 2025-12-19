import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { productService, ProductSortOption } from "../services/productService";
import { getPaginationOptions, getPaginationMeta } from "../utils/pagination";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import { ProductCategory, Wishlists } from "../models/commerce";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "../models/common.model";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
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
    return DEFAULT_LANGUAGE; // Default to English
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request (from token if authenticated, otherwise default to English)
 */
const getUserLanguage = (req: AuthenticatedRequest): SupportedLanguage => {
  // Check if user is authenticated and has language preference
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
  }

  // Default to English if not authenticated or no language preference
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

  // If it's already a plain string, return it
  if (typeof i18nString === "string") {
    return i18nString;
  }

  // Return translated string or fallback to English
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

  // If it's already a plain string, return it
  if (typeof i18nText === "string") {
    return i18nText;
  }

  // Return translated text or fallback to English
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
    // Transform variants if they exist
    variants:
      product.variants?.map((variant: any) => ({
        ...variant,
        name: getTranslatedString(variant.name, lang),
      })) ||
      product.variants ||
      [],
    // Transform populated ingredients for language
    ingredients:
      product.ingredients?.map((ingredient: any) => ({
        ...ingredient,
        name: getTranslatedString(ingredient.name, lang),
        description: getTranslatedText(ingredient.description, lang),
        image: ingredient.image || undefined,
      })) || [],
    // Transform populated categories for language
    categories:
      product.categories?.map((category: any) => ({
        ...category,
        name: getTranslatedString(category.name, lang),
        description: getTranslatedText(category.description, lang),
        image: category.image || undefined,
      })) || [],
  };
};

const parseArrayQuery = (value?: string | string[]): string[] | undefined => {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : value.split(",");
  const sanitized = values.map((item) => item.trim()).filter(Boolean);
  return sanitized.length ? sanitized : undefined;
};

const SORT_OPTIONS: ProductSortOption[] = [
  "relevance",
  "priceLowToHigh",
  "priceHighToLow",
  "rating",
];

const isValidSortOption = (value: unknown): value is ProductSortOption => {
  if (typeof value !== "string") return false;
  return SORT_OPTIONS.includes(value as ProductSortOption);
};

export class ProductController {
  /**
   * Create new product
   */
  static async createProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      const result = await productService.createProduct({
        ...req.body,
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all products with pagination
   * Includes member pricing if user is authenticated and a member
   */
  static async getAllProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const {
        search,
        status,
        variant,
        hasStandupPouch,
        categories,
        healthGoals,
        ingredients,
        sortBy,
      } = req.query;

      const searchTerm =
        typeof search === "string" && search.trim().length
          ? search.trim()
          : undefined;
      const parsedCategories = parseArrayQuery(
        categories as string | string[] | undefined
      );
      const parsedHealthGoals = parseArrayQuery(
        healthGoals as string | string[] | undefined
      );
      const parsedIngredients = parseArrayQuery(
        ingredients as string | string[] | undefined
      );

      const sortByValue = isValidSortOption(sortBy) ? sortBy : undefined;

      const result = await productService.getAllProducts(
        page,
        limit,
        skip,
        sort,
        {
          search: searchTerm,
          status: status as any,
          variant: variant as any,
          hasStandupPouch:
            hasStandupPouch !== undefined
              ? hasStandupPouch === "true"
              : undefined,
          categories: parsedCategories,
          healthGoals: parsedHealthGoals,
          ingredients: parsedIngredients,
          sortBy: sortByValue,
        }
      );

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Get user language (defaults to English if not authenticated)
      const userLang = getUserLanguage(req);

      // Get user's wishlist items if authenticated
      let userWishlistProductIds: Set<string> = new Set();
      if (userId) {
        const wishlistItems = await Wishlists.find({
          userId: new mongoose.Types.ObjectId(userId),
        })
          .select("productId")
          .lean();
        userWishlistProductIds = new Set(
          wishlistItems.map((item: any) => item.productId.toString())
        );
      }

      // Calculate member prices for all products and transform for language
      const productsWithMemberPrices = await Promise.all(
        result.products.map(async (product: any) => {
          // First transform product for user's language
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );
          const productPriceSource: ProductPriceSource = {
            price: transformedProduct.price,
            // Check for product-specific member price overrides in metadata
            memberPrice: transformedProduct.metadata?.memberPrice,
            memberDiscountOverride:
              transformedProduct.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(
            productPriceSource,
            userId || ""
          );

          // Keep transformed product structure intact, only add member pricing fields at product level
          const enrichedProduct: any = {
            ...transformedProduct,
            // Keep price object exactly as it was - don't modify it
            price: transformedProduct.price,
          };

          // Only add member pricing fields if user is a member
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

          // Add is_liked field if user is authenticated
          if (userId) {
            enrichedProduct.is_liked = userWishlistProductIds.has(
              transformedProduct._id.toString()
            );
          }

          return enrichedProduct;
        })
      );

      const pagination = getPaginationMeta(page, limit, result.total);

      res.status(200).json({
        success: true,
        message: "Products retrieved successfully",
        data: productsWithMemberPrices,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available filter values
   */
  static async getFilterOptions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userLang = getUserLanguage(req);
      const filters = await productService.getFilterOptions();

      // Transform multilingual fields
      const transformedFilters = {
        categories: filters.categories.map((cat: any) => ({
          _id: cat._id,
          slug: cat.slug,
          name: getTranslatedString(cat.name, userLang),
          icon: cat.icon,
        })),
        healthGoals: filters.healthGoals,
        ingredients: filters.ingredients.map((ing: any) => ({
          _id: ing._id,
          slug: ing.slug,
          name: getTranslatedString(ing.name, userLang),
          icon: ing.icon,
        })),
      };

      res.status(200).json({
        success: true,
        message: "Product filter values retrieved successfully",
        data: transformedFilters,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by ID
   * Includes member pricing if user is authenticated and a member
   */
  static async getProductById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const result = await productService.getProductById(id);

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Get user language (defaults to English if not authenticated)
      const userLang = getUserLanguage(req);

      // Transform product for user's language first
      const transformedProduct = transformProductForLanguage(
        result.product,
        userLang
      );

      // Calculate member price for the product
      const productPriceSource: ProductPriceSource = {
        price: transformedProduct.price,
        memberPrice: transformedProduct.metadata?.memberPrice,
        memberDiscountOverride:
          transformedProduct.metadata?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(
        productPriceSource,
        userId || ""
      );

      // Variants are already transformed in transformProductForLanguage
      let variantsWithMemberPrices = transformedProduct.variants;
      if (variantsWithMemberPrices && Array.isArray(variantsWithMemberPrices)) {
        variantsWithMemberPrices = await Promise.all(
          variantsWithMemberPrices.map(async (variant: any) => {
            const variantPriceSource: ProductPriceSource = {
              price: variant.price,
              memberPrice: variant.metadata?.memberPrice,
              memberDiscountOverride: variant.metadata?.memberDiscountOverride,
            };

            const variantMemberPrice = await calculateMemberPrice(
              variantPriceSource,
              userId || ""
            );

            const enrichedVariant: any = {
              ...variant,
              // Keep price object exactly as it was - don't modify it
              price: variant.price,
            };

            // Add member pricing fields at variant level
            if (variantMemberPrice.isMember) {
              enrichedVariant.memberPrice = variantMemberPrice.memberPrice;
              enrichedVariant.originalPrice = variantMemberPrice.originalPrice;
              enrichedVariant.discount = {
                amount: variantMemberPrice.discountAmount,
                percentage: variantMemberPrice.discountPercentage,
                type: variantMemberPrice.appliedDiscount?.type,
              };
              enrichedVariant.isMember = true;
            } else {
              enrichedVariant.isMember = false;
            }

            return enrichedVariant;
          })
        );
      }

      // Keep transformed product structure intact
      const enrichedProduct: any = {
        ...transformedProduct,
        // Keep price object exactly as it was - don't modify it
        price: transformedProduct.price,
        variants: variantsWithMemberPrices || transformedProduct.variants || [],
      };

      // Add member pricing fields at product level
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

      // Add is_liked field if user is authenticated
      if (userId) {
        const isInWishlist = await Wishlists.exists({
          userId: new mongoose.Types.ObjectId(userId),
          productId: new mongoose.Types.ObjectId(id),
        });
        enrichedProduct.is_liked = !!isInWishlist;
      }

      res.status(200).json({
        success: true,
        message: "Product retrieved successfully",
        data: {
          product: enrichedProduct,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by slug
   * Includes member pricing if user is authenticated and a member
   */
  static async getProductBySlug(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { slug } = req.params;
      const result = await productService.getProductBySlug(slug);

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Get user language (defaults to English if not authenticated)
      const userLang = getUserLanguage(req);

      // Transform product for user's language first
      const transformedProduct = transformProductForLanguage(
        result.product,
        userLang
      );

      // Calculate member price for the product
      const productPriceSource: ProductPriceSource = {
        price: transformedProduct.price,
        memberPrice: transformedProduct.metadata?.memberPrice,
        memberDiscountOverride:
          transformedProduct.metadata?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(
        productPriceSource,
        userId || ""
      );

      // Variants are already transformed in transformProductForLanguage
      let variantsWithMemberPrices = transformedProduct.variants;
      if (variantsWithMemberPrices && Array.isArray(variantsWithMemberPrices)) {
        variantsWithMemberPrices = await Promise.all(
          variantsWithMemberPrices.map(async (variant: any) => {
            const variantPriceSource: ProductPriceSource = {
              price: variant.price,
              memberPrice: variant.metadata?.memberPrice,
              memberDiscountOverride: variant.metadata?.memberDiscountOverride,
            };

            const variantMemberPrice = await calculateMemberPrice(
              variantPriceSource,
              userId || ""
            );

            const enrichedVariant: any = {
              ...variant,
              // Keep price object exactly as it was - don't modify it
              price: variant.price,
            };

            // Add member pricing fields at variant level
            if (variantMemberPrice.isMember) {
              enrichedVariant.memberPrice = variantMemberPrice.memberPrice;
              enrichedVariant.originalPrice = variantMemberPrice.originalPrice;
              enrichedVariant.discount = {
                amount: variantMemberPrice.discountAmount,
                percentage: variantMemberPrice.discountPercentage,
                type: variantMemberPrice.appliedDiscount?.type,
              };
              enrichedVariant.isMember = true;
            } else {
              enrichedVariant.isMember = false;
            }

            return enrichedVariant;
          })
        );
      }

      // Keep transformed product structure intact
      const enrichedProduct: any = {
        ...transformedProduct,
        // Keep price object exactly as it was - don't modify it
        price: transformedProduct.price,
        variants: variantsWithMemberPrices || transformedProduct.variants || [],
      };

      // Add member pricing fields at product level
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

      // Add is_liked field if user is authenticated
      if (userId) {
        const isInWishlist = await Wishlists.exists({
          userId: new mongoose.Types.ObjectId(userId),
          productId: transformedProduct._id,
        });
        enrichedProduct.is_liked = !!isInWishlist;
      }

      res.status(200).json({
        success: true,
        message: "Product retrieved successfully",
        data: {
          product: enrichedProduct,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update product
   */
  static async updateProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.userId;

      const result = await productService.updateProduct(id, {
        ...req.body,
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update product status (enable/disable)
   * enabled: true -> Product visible to users
   * enabled: false -> Product hidden from users
   */
  static async updateProductStatus(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      const result = await productService.updateProductStatus(id, enabled);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete product
   */
  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.deleteProduct(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product statistics
   */
  static async getProductStats(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const stats = await productService.getProductStats();

      res.status(200).json({
        success: true,
        message: "Product statistics retrieved successfully",
        data: {
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get list of active product categories
   * @route GET /api/products/categories
   * @access Public
   */
  static async getProductCategories(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      // Get user language (defaults to English if not authenticated)
      const userLang = getUserLanguage(req);

      // Use language code (e.g., "en", "nl") instead of query parameter
      const lang = userLang as "en" | "nl";

      const filter: any = {
        isActive: true,
        isDeleted: { $ne: true },
      };

      const categories = await ProductCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: 1 })
        .select("slug name description sortOrder icon image productCount")
        .lean();

      const transformedCategories = categories.map((category: any) => ({
        _id: category._id,
        slug: category.slug,
        name: category.name?.[lang] || category.name?.en || "",
        description:
          category.description?.[lang] || category.description?.en || "",
        sortOrder: category.sortOrder || 0,
        icon: category.icon || null,
        image: category.image || null,
        productCount: category.productCount || 0,
      }));

      res.status(200).json({
        success: true,
        message: "Product categories retrieved successfully",
        data: {
          categories: transformedCategories,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
