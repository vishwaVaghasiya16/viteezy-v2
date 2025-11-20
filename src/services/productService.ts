import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { Ingredients } from "../models/commerce/ingredients.model";
import { ProductStatus, ProductVariant, ReviewStatus } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { generateSlug, generateUniqueSlug } from "../utils/slug";
import { fileStorageService } from "./fileStorageService";
import mongoose, { PipelineStage } from "mongoose";

export type ProductSortOption =
  | "relevance"
  | "priceLowToHigh"
  | "priceHighToLow"
  | "rating";

interface CreateProductData {
  title: string;
  slug?: string;
  description: string;
  productImage: string;
  benefits: string[];
  ingredients: string[];
  categories?: string[];
  healthGoals?: string[];
  nutritionInfo: string;
  nutritionTable?: Array<{
    nutrient: string;
    amount: string;
    unit?: string;
    dailyValue?: string;
  }>;
  howToUse: string;
  status: ProductStatus;
  price: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  variant: ProductVariant;
  hasStandupPouch: boolean;
  standupPouchPrices?: {
    oneTime: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    thirtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    sixtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    ninetyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    oneEightyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
  };
  meta?: {
    title?: string;
    description?: string;
    keywords?: string;
    ogImage?: string;
    hreflang?: Array<{ lang: string; url: string }>;
  };
  sourceInfo?: {
    manufacturer?: string;
    countryOfOrigin?: string;
    certification?: string[];
    batchNumber?: string;
    expiryDate?: Date;
  };
  createdBy?: mongoose.Types.ObjectId;
}

interface UpdateProductData {
  title?: string;
  slug?: string;
  description?: string;
  productImage?: string;
  benefits?: string[];
  ingredients?: string[];
  categories?: string[];
  healthGoals?: string[];
  nutritionInfo?: string;
  nutritionTable?: Array<{
    nutrient: string;
    amount: string;
    unit?: string;
    dailyValue?: string;
  }>;
  howToUse?: string;
  status?: ProductStatus;
  price?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  variant?: ProductVariant;
  hasStandupPouch?: boolean;
  standupPouchPrices?: {
    oneTime: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    thirtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    sixtyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    ninetyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
    oneEightyDays: {
      currency: string;
      amount: number;
      taxRate: number;
    };
  };
  meta?: {
    title?: string;
    description?: string;
    keywords?: string;
    ogImage?: string;
    hreflang?: Array<{ lang: string; url: string }>;
  };
  sourceInfo?: {
    manufacturer?: string;
    countryOfOrigin?: string;
    certification?: string[];
    batchNumber?: string;
    expiryDate?: Date;
  };
  updatedBy?: mongoose.Types.ObjectId;
}

class ProductService {
  /**
   * Create new product
   */
  async createProduct(data: CreateProductData): Promise<{ product: any; message: string }> {
    const { title, slug, hasStandupPouch, standupPouchPrices } = data;

    // Generate slug from title if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      const baseSlug = generateSlug(title);
      finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck: string) => {
          const existing = await Products.findOne({ slug: slugToCheck, isDeleted: false });
          return !!existing;
        }
      );
    } else {
      // Check if provided slug already exists
      const existingProduct = await Products.findOne({ slug: finalSlug, isDeleted: false });
      if (existingProduct) {
        throw new AppError("Product with this slug already exists", 409);
      }
    }

    // Validate standupPouchPrices if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrices) {
      throw new AppError("standupPouchPrices is required when hasStandupPouch is true", 400);
    }

    // Create product with generated slug
    const product = await Products.create({
      ...data,
      slug: finalSlug,
    });

    logger.info(`Product created successfully: ${product.slug}`);

    return {
      product: product.toObject(),
      message: "Product created successfully",
    };
  }

  /**
   * Get all products with pagination and filters
   */
  async getAllProducts(
    page: number,
    limit: number,
    skip: number,
    sort: Record<string, 1 | -1>,
    filters: {
      search?: string;
      status?: ProductStatus;
      variant?: ProductVariant;
      hasStandupPouch?: boolean;
      categories?: string[];
      healthGoals?: string[];
      ingredients?: string[];
      sortBy?: ProductSortOption;
    }
  ): Promise<{ products: any[]; total: number }> {
    const {
      search,
      status,
      variant,
      hasStandupPouch,
      categories,
      healthGoals,
      ingredients,
      sortBy,
    } = filters;

    const matchStage: Record<string, any> = { isDeleted: false };

    if (status) {
      matchStage.status = status;
    }

    if (variant) {
      matchStage.variant = variant;
    }

    if (hasStandupPouch !== undefined) {
      matchStage.hasStandupPouch = hasStandupPouch;
    }

    if (categories?.length) {
      matchStage.categories = { $in: categories };
    }

    if (healthGoals?.length) {
      matchStage.healthGoals = { $in: healthGoals };
    }

    if (ingredients?.length) {
      matchStage.ingredients = { $all: ingredients };
    }

    const pipeline: PipelineStage[] = [];
    let hasSearch = false;

    // MongoDB requires $text search to be the FIRST stage
    // If search exists, it must be the first $match stage
    if (search && search.trim().length > 0) {
      hasSearch = true;
      // Build text search match with isDeleted filter
      const textSearchMatch: Record<string, any> = {
        $text: { $search: search.trim() },
        isDeleted: false,
      };
      
      // Add other filters that can be combined with $text in same stage
      if (status) textSearchMatch.status = status;
      if (variant) textSearchMatch.variant = variant;
      if (hasStandupPouch !== undefined) textSearchMatch.hasStandupPouch = hasStandupPouch;
      
      // Text search must be first stage
      pipeline.push({ $match: textSearchMatch });
      
      // Add relevance score immediately after text search
      pipeline.push({
        $addFields: {
          relevanceScore: { $meta: "textScore" },
        },
      });
      
      // Apply array filters in separate stage (can't combine $in/$all with $text in same stage)
      const arrayFilters: Record<string, any> = {};
      if (categories?.length) arrayFilters.categories = { $in: categories };
      if (healthGoals?.length) arrayFilters.healthGoals = { $in: healthGoals };
      if (ingredients?.length) arrayFilters.ingredients = { $all: ingredients };
      
      if (Object.keys(arrayFilters).length > 0) {
        pipeline.push({ $match: arrayFilters });
      }
    } else {
      // No search - apply all filters in first stage
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
      {
        $lookup: {
          from: "reviews",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                isDeleted: { $ne: true },
                isPublic: true,
                status: ReviewStatus.APPROVED,
              },
            },
            {
              $group: {
                _id: "$productId",
                averageRating: { $avg: "$rating" },
                ratingCount: { $sum: 1 },
              },
            },
          ],
          as: "ratingSummary",
        },
      },
      {
        $addFields: {
          ratingSummary: {
            $ifNull: [{ $arrayElemAt: ["$ratingSummary", 0] }, null],
          },
        },
      },
      {
        $addFields: {
          averageRating: {
            $round: [
              {
                $ifNull: ["$ratingSummary.averageRating", 0],
              },
              2,
            ],
          },
          ratingCount: { $ifNull: ["$ratingSummary.ratingCount", 0] },
        },
      },
      {
        $project: {
          ratingSummary: 0,
        },
      }
    );

    const sortStage = this.buildSortStage(sortBy, sort, hasSearch);
    pipeline.push({ $sort: sortStage });

    pipeline.push({
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
        ],
        total: [{ $count: "value" }],
      },
    });

    const [aggregationResult] = await Products.aggregate(pipeline);
    const products = aggregationResult?.data ?? [];
    const total = aggregationResult?.total?.[0]?.value ?? 0;

    return { products, total };
  }

  /**
   * Get product by ID with full details
   * Includes variants, detailed ingredients, meta, and structured data
   */
  async getProductById(productId: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      _id: productId,
      isDeleted: false,
    }).lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Fetch product variants
    const variants = await ProductVariants.find({
      productId: new mongoose.Types.ObjectId(productId),
      isDeleted: { $ne: true },
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();

    // Fetch detailed ingredient information
    // Match ingredients by name (case-insensitive) or scientific name
    let detailedIngredients: any[] = [];
    if (product.ingredients && product.ingredients.length > 0) {
      const ingredientQueries = product.ingredients.map((ingredientName) => ({
        $or: [
          { "name.en": { $regex: ingredientName.trim(), $options: "i" } },
          { "name.nl": { $regex: ingredientName.trim(), $options: "i" } },
          { scientificName: { $regex: ingredientName.trim(), $options: "i" } },
        ],
      }));

      detailedIngredients = await Ingredients.find({
        $or: ingredientQueries,
        isDeleted: { $ne: true },
        isActive: true,
      }).lean();
    }

    // Build meta data if not present
    const meta = product.meta || {
      title: product.title,
      description: product.description,
      keywords: [
        ...(product.categories || []),
        ...(product.healthGoals || []),
        ...product.ingredients,
      ].join(", "),
      ogImage: product.productImage,
    };

    // Build structured response
    const enrichedProduct = {
      ...product,
      variants: variants || [],
      detailedIngredients: detailedIngredients || [],
      meta,
      // Ensure nutritionTable exists (can be empty array)
      nutritionTable: product.nutritionTable || [],
      // Ensure sourceInfo exists
      sourceInfo: product.sourceInfo || {},
    };

    return { product: enrichedProduct };
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      slug,
      isDeleted: false,
    }).lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    return { product };
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData
  ): Promise<{ product: any; message: string }> {
    const { slug, hasStandupPouch, standupPouchPrices } = data;

    // Check if product exists
    const existingProduct = await Products.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }

    // Check if slug is being changed and if new slug already exists
    if (slug && slug !== existingProduct.slug) {
      const slugExists = await Products.findOne({
        slug,
        _id: { $ne: productId },
        isDeleted: false,
      });

      if (slugExists) {
        throw new AppError("Product with this slug already exists", 409);
      }
    }

    // Validate standupPouchPrices if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrices) {
      throw new AppError("standupPouchPrices is required when hasStandupPouch is true", 400);
    }

    const shouldDeleteOldImage =
      !!data.productImage &&
      !!existingProduct.productImage &&
      data.productImage !== existingProduct.productImage;

    // Update product
    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      { ...data, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedProduct) {
      throw new AppError("Product not found", 404);
    }

    if (shouldDeleteOldImage) {
      await fileStorageService.deleteFileByUrl(existingProduct.productImage);
    }

    logger.info(`Product updated successfully: ${updatedProduct.slug}`);

    return {
      product: updatedProduct,
      message: "Product updated successfully",
    };
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(productId: string): Promise<{ message: string }> {
    const product = await Products.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Delete associated assets
    await fileStorageService.deleteFileByUrl(product.productImage);

    // Soft delete
    await Products.findByIdAndUpdate(productId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    logger.info(`Product deleted successfully: ${product.slug}`);

    return {
      message: "Product deleted successfully",
    };
  }

  /**
   * Get available filter values
   */
  async getFilterOptions(): Promise<{
    categories: string[];
    healthGoals: string[];
    ingredients: string[];
  }> {
    const [result] = await Products.aggregate([
      {
        $match: {
          isDeleted: false,
        },
      },
      {
        $project: {
          categories: { $ifNull: ["$categories", []] },
          healthGoals: { $ifNull: ["$healthGoals", []] },
          ingredients: { $ifNull: ["$ingredients", []] },
        },
      },
      {
        $facet: {
          categories: [
            { $unwind: "$categories" },
            { $match: { categories: { $nin: [null, ""] } } },
            { $group: { _id: "$categories" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
          healthGoals: [
            { $unwind: "$healthGoals" },
            { $match: { healthGoals: { $nin: [null, ""] } } },
            { $group: { _id: "$healthGoals" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
          ingredients: [
            { $unwind: "$ingredients" },
            { $match: { ingredients: { $nin: [null, ""] } } },
            { $group: { _id: "$ingredients" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
        },
      },
    ]);

    const mapValues = (items?: Array<{ value: string }>) =>
      (items ?? []).map((item) => item.value);

    return {
      categories: mapValues(result?.categories),
      healthGoals: mapValues(result?.healthGoals),
      ingredients: mapValues(result?.ingredients),
    };
  }

  /**
   * Get product statistics
   */
  async getProductStats(): Promise<{
    total: number;
    active: number;
    draft: number;
    hidden: number;
    sachets: number;
    standupPouch: number;
  }> {
    const [total, active, draft, hidden, sachets, standupPouch] = await Promise.all([
      Products.countDocuments({ isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.ACTIVE, isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.DRAFT, isDeleted: false }),
      Products.countDocuments({ status: ProductStatus.HIDDEN, isDeleted: false }),
      Products.countDocuments({ variant: ProductVariant.SACHETS, isDeleted: false }),
      Products.countDocuments({ variant: ProductVariant.STAND_UP_POUCH, isDeleted: false }),
    ]);

    return {
      total,
      active,
      draft,
      hidden,
      sachets,
      standupPouch,
    };
  }

  private buildSortStage(
    sortBy: ProductSortOption | undefined,
    fallbackSort: Record<string, 1 | -1>,
    hasSearch: boolean
  ): Record<string, 1 | -1> {
    switch (sortBy) {
      case "relevance":
        if (hasSearch) {
          return { relevanceScore: -1 as 1 | -1, createdAt: -1 };
        }
        break;
      case "priceLowToHigh":
        return { "price.amount": 1, createdAt: -1 };
      case "priceHighToLow":
        return { "price.amount": -1, createdAt: -1 };
      case "rating":
        return { averageRating: -1, ratingCount: -1, createdAt: -1 };
      default:
        break;
    }

    if (fallbackSort && Object.keys(fallbackSort).length > 0) {
      return fallbackSort;
    }

    return { createdAt: -1 };
  }
}

export const productService = new ProductService();

