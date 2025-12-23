import { Request, Response } from "express";
import mongoose, { FilterQuery } from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { ProductTestimonials } from "@/models/cms";
import { IProductTestimonial } from "@/models/cms/productTestimonials.model";
import { User } from "@/models/index.model";

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
 * Transform product titles in testimonials to return only user's language
 */
const transformTestimonialProducts = (
  testimonials: any[],
  userLang: "en" | "nl" | "de" | "fr" | "es"
) => {
  return testimonials.map((testimonial) => {
    const transformed = { ...testimonial };

    // Transform products array if populated
    if (Array.isArray(transformed.products)) {
      transformed.products = transformed.products.map((product: any) => {
        if (product && typeof product === "object" && product.title) {
          const productTransformed = { ...product };
          if (product.title && typeof product.title === "object") {
            productTransformed.title =
              product.title[userLang] || product.title.en || "";
          }
          return productTransformed;
        }
        return product;
      });
    }

    return transformed;
  });
};

/**
 * User-facing Product Testimonial Controller
 * Provides read-only access to product testimonials for regular users
 * Language is automatically detected from user's token/profile preference
 */
class ProductTestimonialController {
  /**
   * Get all active product testimonials (public API)
   * Supports filtering by product, featured, and visibleInLP
   * If isVisibleInLP filter is true and no testimonials found, returns latest 6
   * Language is automatically detected from user's token/profile preference
   */
  getTestimonials = asyncHandler(
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
      const { productId, isFeatured, isVisibleInLP } = req.query;

      const filters: FilterQuery<IProductTestimonial> = {
        isDeleted: { $ne: true },
        isActive: true,
      };

      // Filter by product ID if provided
      if (productId && mongoose.Types.ObjectId.isValid(productId as string)) {
        filters.products = new mongoose.Types.ObjectId(productId as string);
      }

      // Filter by featured flag
      if (isFeatured !== undefined) {
        const featuredValue =
          typeof isFeatured === "string"
            ? isFeatured === "true"
            : Boolean(isFeatured);
        filters.isFeatured = featuredValue;
      }

      // Filter by visible in landing page flag
      if (isVisibleInLP !== undefined) {
        const lpValue =
          typeof isVisibleInLP === "string"
            ? isVisibleInLP === "true"
            : Boolean(isVisibleInLP);
        filters.isVisibleInLP = lpValue;
      }

      // Default sort: featured first, then by displayOrder, then by createdAt (latest first)
      const sortOptions: Record<string, 1 | -1> = {
        isFeatured: -1,
        displayOrder: 1,
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      // Check if filtering by isVisibleInLP
      const isLPFilter =
        isVisibleInLP !== undefined &&
        (typeof isVisibleInLP === "string"
          ? isVisibleInLP === "true"
          : Boolean(isVisibleInLP));

      let testimonials: any[] = [];
      let total = 0;

      if (isLPFilter) {
        // First try to get testimonials marked as visible in LP
        const lpTestimonials = await ProductTestimonials.find(filters)
          .populate("products", "title slug productImage sachetPrices")
          .sort(sortOptions)
          .lean();

        if (lpTestimonials.length > 0) {
          // If found, return them with pagination
          total = lpTestimonials.length;
          testimonials = lpTestimonials.slice(skip, skip + limit);
        } else {
          // If none found, get latest 6 active testimonials (ignoring isVisibleInLP filter)
          const fallbackFilters: FilterQuery<IProductTestimonial> = {
            isDeleted: { $ne: true },
            isActive: true,
          };

          // Keep product filter if provided
          if (
            productId &&
            mongoose.Types.ObjectId.isValid(productId as string)
          ) {
            fallbackFilters.products = new mongoose.Types.ObjectId(
              productId as string
            );
          }

          // Keep featured filter if provided
          if (isFeatured !== undefined) {
            fallbackFilters.isFeatured =
              typeof isFeatured === "string"
                ? isFeatured === "true"
                : Boolean(isFeatured);
          }

          const latestTestimonials = await ProductTestimonials.find(
            fallbackFilters
          )
            .populate("products", "title slug productImage sachetPrices")
            .sort({ createdAt: -1 })
            .limit(6)
            .lean();

          total = latestTestimonials.length;
          testimonials = latestTestimonials;
        }
      } else {
        // Normal pagination for other filters
        const [results, count] = await Promise.all([
          ProductTestimonials.find(filters)
            .populate("products", "title slug productImage sachetPrices")
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean(),
          ProductTestimonials.countDocuments(filters),
        ]);

        testimonials = results;
        total = count;
      }

      // Transform product titles to return only user's language
      const transformedTestimonials = transformTestimonialProducts(
        testimonials,
        userLang
      );

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedTestimonials,
        pagination,
        "Testimonials retrieved"
      );
    }
  );
}

export const productTestimonialController = new ProductTestimonialController();
