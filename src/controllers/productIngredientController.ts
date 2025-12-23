import { Request, Response } from "express";
import mongoose, { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductIngredients, Products } from "@/models/commerce";
import { IProductIngredient } from "@/models/commerce/productIngredients.model";
import { User } from "@/models/index.model";
import { ProductStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

/**
 * Map user language preference to language code
 * User table stores: "English", "Dutch", "German", "French", "Spanish"
 * API uses: "en", "nl", "de", "fr", "es"
 */
const mapLanguageToCode = (
  language?: string
): "en" | "nl" | "de" | "fr" | "es" => {
  const languageMap: Record<string, "en" | "nl" | "de" | "fr" | "es"> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };

  if (!language) {
    return "en"; // Default to English
  }

  return languageMap[language] || "en";
};

/**
 * Transform i18n fields to return only user's language
 */
const transformI18nFields = (
  data: any,
  userLang: "en" | "nl" | "de" | "fr" | "es"
) => {
  if (!data) return data;

  const transformed = { ...data };

  // Transform name field (I18nStringType)
  if (transformed.name && typeof transformed.name === "object") {
    transformed.name = transformed.name[userLang] || transformed.name.en || "";
  }

  // Transform description field (I18nTextType)
  if (transformed.description && typeof transformed.description === "object") {
    transformed.description =
      transformed.description[userLang] || transformed.description.en || "";
  }

  // Transform products if populated
  if (Array.isArray(transformed.products)) {
    transformed.products = transformed.products.map((product: any) => {
      if (product && typeof product === "object" && product.title) {
        const productTransformed = { ...product };
        if (product.title && typeof product.title === "object") {
          productTransformed.title =
            product.title[userLang] || product.title.en || "";
        }
        if (product.description && typeof product.description === "object") {
          productTransformed.description =
            product.description[userLang] || product.description.en || "";
        }
        return productTransformed;
      }
      return product;
    });
  }

  return transformed;
};

/**
 * User-facing Product Ingredient Controller
 * Provides read-only access to product ingredients for regular users
 * Language is automatically detected from user's token/profile preference
 */
class ProductIngredientController {
  /**
   * Get all active product ingredients (public API)
   * Returns only active, non-deleted ingredients
   * Language is automatically detected from user's token/profile preference
   */
  getIngredients = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;

      // Get user's language preference from token if authenticated
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";
      if (authenticatedReq.user?._id) {
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();
        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, productId } = req.query;

      const filters: FilterQuery<IProductIngredient> = {
        isDeleted: { $ne: true },
        isActive: true,
      };

      // Filter by product ID if provided
      if (productId && mongoose.Types.ObjectId.isValid(productId as string)) {
        filters.products = new mongoose.Types.ObjectId(productId as string);
      }

      // Search across all language fields
      if (typeof search === "string" && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filters.$or = [
          { "name.en": regex },
          { "name.nl": regex },
          { "name.de": regex },
          { "name.fr": regex },
          { "name.es": regex },
          { "description.en": regex },
          { "description.nl": regex },
          { "description.de": regex },
          { "description.fr": regex },
          { "description.es": regex },
        ];
      }

      // Sort by user's language name field, fallback to English
      const sortOptions: Record<string, 1 | -1> = {
        [`name.${userLang}`]: 1,
        "name.en": 1,
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [ingredients, total] = await Promise.all([
        ProductIngredients.find(filters)
          .populate(
            "products",
            "title slug productImage description price sachetPrices"
          )
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProductIngredients.countDocuments(filters),
      ]);

      // Transform i18n fields to return only user's language
      const transformedIngredients = ingredients.map((ingredient) =>
        transformI18nFields(ingredient, userLang)
      );

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedIngredients,
        pagination,
        "Ingredients retrieved"
      );
    }
  );

  /**
   * Get product ingredient by ID (public API)
   * Returns ingredient details with associated products
   * Language is automatically detected from user's token/profile preference
   */
  getIngredientById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid ingredient ID", 400);
      }

      // Get user's language preference from token if authenticated
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";
      if (authenticatedReq.user?._id) {
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();
        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      const ingredient = await ProductIngredients.findOne({
        _id: id,
        isDeleted: { $ne: true },
        isActive: true,
      })
        .populate(
          "products",
          "title slug productImage description price sachetPrices"
        )
        .lean();

      if (!ingredient) {
        throw new AppError("Product ingredient not found", 404);
      }

      // Transform i18n fields to return only user's language
      const transformedIngredient = transformI18nFields(ingredient, userLang);

      res.apiSuccess(
        { ingredient: transformedIngredient },
        "Product ingredient retrieved successfully"
      );
    }
  );

  /**
   * Get ingredients by product ID
   * Returns all ingredients associated with a specific product
   * Language is automatically detected from user's token/profile preference
   */
  getIngredientsByProductId = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;
      const { productId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        throw new AppError("Invalid product ID", 400);
      }

      // Get user's language preference from token if authenticated
      let userLang: "en" | "nl" | "de" | "fr" | "es" = "en";
      if (authenticatedReq.user?._id) {
        const user = await User.findById(authenticatedReq.user._id)
          .select("language")
          .lean();
        if (user) {
          userLang = mapLanguageToCode(user.language);
        }
      }

      // Verify product exists and is active
      const product = await Products.findOne({
        _id: productId,
        isDeleted: false,
        status: { $ne: ProductStatus.HIDDEN },
      }).lean();

      if (!product) {
        throw new AppError("Product not found", 404);
      }

      const ingredients = await ProductIngredients.find({
        products: new mongoose.Types.ObjectId(productId),
        isDeleted: { $ne: true },
        isActive: true,
      })
        .populate(
          "products",
          "title slug productImage description price sachetPrices"
        )
        .sort({ [`name.${userLang}`]: 1, "name.en": 1 })
        .lean();

      // Transform i18n fields to return only user's language
      const transformedIngredients = ingredients.map((ingredient) =>
        transformI18nFields(ingredient, userLang)
      );

      res.apiSuccess(
        { ingredients: transformedIngredients },
        "Product ingredients retrieved successfully"
      );
    }
  );
}

export const productIngredientController = new ProductIngredientController();
