import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import {
  productService,
  ProductSortOption,
} from "../services/productService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { getPaginationOptions, getPaginationMeta } from "../utils/pagination";
import { calculateMemberPrice, calculateMemberPrices, ProductPriceSource } from "../utils/membershipPrice";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

const parseArrayQuery = (
  value?: string | string[]
): string[] | undefined => {
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
  static async getAllProducts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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

      const sortByValue = isValidSortOption(sortBy)
        ? sortBy
        : undefined;

      const result = await productService.getAllProducts(page, limit, skip, sort, {
        search: searchTerm,
        status: status as any,
        variant: variant as any,
        hasStandupPouch:
          hasStandupPouch !== undefined ? hasStandupPouch === "true" : undefined,
        categories: parsedCategories,
        healthGoals: parsedHealthGoals,
        ingredients: parsedIngredients,
        sortBy: sortByValue,
      });

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Calculate member prices for all products
      const productsWithMemberPrices = await Promise.all(
        result.products.map(async (product: any) => {
          const productPriceSource: ProductPriceSource = {
            price: product.price,
            // Check for product-specific member price overrides in metadata
            memberPrice: product.metadata?.memberPrice,
            memberDiscountOverride: product.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(productPriceSource, userId || "");

          // Keep original product structure intact, only add member pricing fields at product level
          const enrichedProduct: any = {
            ...product,
            // Keep price object exactly as it was - don't modify it
            price: product.price,
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
  static async getFilterOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = await productService.getFilterOptions();
      res.status(200).json({
        success: true,
        message: "Product filter values retrieved successfully",
        data: filters,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by ID
   * Includes member pricing if user is authenticated and a member
   */
  static async getProductById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.getProductById(id);

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Calculate member price for the product
      const productPriceSource: ProductPriceSource = {
        price: result.product.price,
        memberPrice: result.product.metadata?.memberPrice,
        memberDiscountOverride: result.product.metadata?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(productPriceSource, userId || "");

      // Include variants with member pricing if they exist
      let variantsWithMemberPrices = result.product.variants;
      if (variantsWithMemberPrices && Array.isArray(variantsWithMemberPrices)) {
        variantsWithMemberPrices = await Promise.all(
          variantsWithMemberPrices.map(async (variant: any) => {
            const variantPriceSource: ProductPriceSource = {
              price: variant.price,
              memberPrice: variant.metadata?.memberPrice,
              memberDiscountOverride: variant.metadata?.memberDiscountOverride,
            };

            const variantMemberPrice = await calculateMemberPrice(variantPriceSource, userId || "");

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
      
      // Keep original product structure intact
      const enrichedProduct: any = {
        ...result.product,
        // Keep price object exactly as it was - don't modify it
        price: result.product.price,
        variants: variantsWithMemberPrices || result.product.variants || [],
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
  static async getProductBySlug(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const result = await productService.getProductBySlug(slug);

      // Get user ID if authenticated (optional)
      const userId = req.user?._id || req.userId;

      // Calculate member price for the product
      const productPriceSource: ProductPriceSource = {
        price: result.product.price,
        memberPrice: result.product.metadata?.memberPrice,
        memberDiscountOverride: result.product.metadata?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(productPriceSource, userId || "");

      // Include variants with member pricing if they exist
      let variantsWithMemberPrices = result.product.variants;
      if (variantsWithMemberPrices && Array.isArray(variantsWithMemberPrices)) {
        variantsWithMemberPrices = await Promise.all(
          variantsWithMemberPrices.map(async (variant: any) => {
            const variantPriceSource: ProductPriceSource = {
              price: variant.price,
              memberPrice: variant.metadata?.memberPrice,
              memberDiscountOverride: variant.metadata?.memberDiscountOverride,
            };

            const variantMemberPrice = await calculateMemberPrice(variantPriceSource, userId || "");

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

      // Keep original product structure intact
      const enrichedProduct: any = {
        ...result.product,
        // Keep price object exactly as it was - don't modify it
        price: result.product.price,
        variants: variantsWithMemberPrices || result.product.variants || [],
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
  static async getProductStats(req: Request, res: Response, next: NextFunction) {
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
}

