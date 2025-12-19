import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
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
  price?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  variant: ProductVariant;
  hasStandupPouch: boolean;
  sachetPrices?: {
    thirtyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    sixtyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    ninetyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    oneEightyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    oneTime: {
      count30: {
        currency: string;
        amount: number;
        taxRate: number;
        capsuleCount?: number;
      };
      count60: {
        currency: string;
        amount: number;
        taxRate: number;
        capsuleCount?: number;
      };
    };
  };
  standupPouchPrice?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  standupPouchImages?: string[];
  // New fields for admin Add Product screen
  shortDescription?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  comparisonSection?: {
    title: string;
    columns: string[];
    rows: Array<{
      label: string;
      values: boolean[];
    }>;
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
  sachetPrices?: {
    thirtyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    sixtyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    ninetyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    oneEightyDays: {
      currency: string;
      amount?: number; // Optional - will be calculated from totalAmount
      taxRate: number;
      totalAmount?: number;
      durationDays?: number;
      capsuleCount?: number;
      savingsPercentage?: number;
      features?: string[];
      icon?: string;
    };
    oneTime: {
      count30: {
        currency: string;
        amount: number;
        taxRate: number;
        capsuleCount?: number;
      };
      count60: {
        currency: string;
        amount: number;
        taxRate: number;
        capsuleCount?: number;
      };
    };
  };
  standupPouchPrice?: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  standupPouchImages?: string[];
  // New fields for admin Edit Product screen
  shortDescription?: string;
  galleryImages?: string[];
  isFeatured?: boolean;
  comparisonSection?: {
    title: string;
    columns: string[];
    rows: Array<{
      label: string;
      values: boolean[];
    }>;
  };
  updatedBy?: mongoose.Types.ObjectId;
}

class ProductService {
  /**
   * Process price object: calculate savingsPercentage and totalAmount
   */
  private processPriceObject(priceObj: any): any {
    if (!priceObj || typeof priceObj !== "object") {
      return priceObj;
    }

    const amount = priceObj.amount || 0;
    const discountedPrice = priceObj.discountedPrice;
    const taxRate = priceObj.taxRate || 0;

    // Calculate savingsPercentage if discountedPrice is provided
    let savingsPercentage = priceObj.savingsPercentage;
    if (discountedPrice !== undefined && amount > 0) {
      savingsPercentage = Math.round(
        ((amount - discountedPrice) / amount) * 100 * 100
      ) / 100; // Round to 2 decimal places
    }

    // Calculate totalAmount
    // If totalAmount is already provided, use it
    // Otherwise, calculate from discountedPrice (if provided) or amount, then add tax
    let totalAmount = priceObj.totalAmount;
    if (totalAmount === undefined) {
      const baseAmount = discountedPrice !== undefined ? discountedPrice : amount;
      totalAmount = Math.round((baseAmount * (1 + taxRate)) * 100) / 100;
    }

    const result: any = {
      ...priceObj,
      amount,
      taxRate,
      savingsPercentage: savingsPercentage !== undefined ? savingsPercentage : 0,
      totalAmount,
    };

    // Only include discountedPrice if it's provided (not undefined)
    if (discountedPrice !== undefined && discountedPrice !== null) {
      result.discountedPrice = discountedPrice;
    }

    return result;
  }

  /**
   * Process sachetPrices: calculate savingsPercentage and totalAmount for all periods
   */
  private processSachetPrices(sachetPrices: any): any {
    if (!sachetPrices || typeof sachetPrices !== "object") {
      return sachetPrices;
    }

    const processed: any = {};

    // Process subscription periods
    const periods = ["thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"];
    for (const period of periods) {
      if (sachetPrices[period]) {
        processed[period] = this.processPriceObject(sachetPrices[period]);
      }
    }

    // Process oneTime
    if (sachetPrices.oneTime) {
      processed.oneTime = {
        count30: this.processPriceObject(sachetPrices.oneTime.count30),
        count60: this.processPriceObject(sachetPrices.oneTime.count60),
      };
    }

    return processed;
  }

  /**
   * Process standupPouchPrice: calculate savingsPercentage and totalAmount
   */
  private processStandupPouchPrice(standupPouchPrice: any): any {
    if (!standupPouchPrice || typeof standupPouchPrice !== "object") {
      return standupPouchPrice;
    }

    // If it has count30 and count60 structure
    if (standupPouchPrice.count30 || standupPouchPrice.count60) {
      return {
        count30: this.processPriceObject(standupPouchPrice.count30),
        count60: this.processPriceObject(standupPouchPrice.count60),
      };
    }

    // If it's a simple price object
    return this.processPriceObject(standupPouchPrice);
  }

  /**
   * Create new product
   */
  async createProduct(
    data: CreateProductData
  ): Promise<{ product: any; message: string }> {
    const {
      title,
      slug,
      hasStandupPouch,
      standupPouchPrice,
      price,
      sachetPrices,
      variant,
    } = data;

    // Generate slug from title if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      const baseSlug = generateSlug(title);
      finalSlug = await generateUniqueSlug(
        baseSlug,
        async (slugToCheck: string) => {
          const existing = await Products.findOne({
            slug: slugToCheck,
            isDeleted: false,
          });
          return !!existing;
        }
      );
    } else {
      // Check if provided slug already exists
      const existingProduct = await Products.findOne({
        slug: finalSlug,
        isDeleted: false,
      });
      if (existingProduct) {
        throw new AppError("Product with this slug already exists", 409);
      }
    }

    // Validate standupPouchPrice if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrice) {
      throw new AppError(
        "standupPouchPrice is required when hasStandupPouch is true",
        400
      );
    }

    // Process sachetPrices: calculate savingsPercentage and totalAmount
    const processedSachetPrices = sachetPrices
      ? this.processSachetPrices(sachetPrices)
      : sachetPrices;

    // If price is not provided and sachetPrices exists, derive price from sachetPrices.thirtyDays
    let finalPrice = price;
    if (!finalPrice && processedSachetPrices && processedSachetPrices.thirtyDays) {
      const thirtyDaysPrice = processedSachetPrices.thirtyDays;
      const baseAmount = thirtyDaysPrice.discountedPrice !== undefined
        ? thirtyDaysPrice.discountedPrice
        : thirtyDaysPrice.amount || thirtyDaysPrice.totalAmount || 0;
      finalPrice = {
        currency: thirtyDaysPrice.currency || "EUR",
        amount: baseAmount,
        taxRate: thirtyDaysPrice.taxRate || 0,
      };
    }

    // Normalize standupPouchPrice: if it has oneTime wrapper, unwrap it for storage
    let normalizedStandupPouchPrice = standupPouchPrice;
    if (
      standupPouchPrice &&
      typeof standupPouchPrice === "object" &&
      "oneTime" in standupPouchPrice
    ) {
      // If structure is { oneTime: { count30, count60 } }, unwrap it to { count30, count60 }
      normalizedStandupPouchPrice = (standupPouchPrice as any).oneTime;
    }

    // Process standupPouchPrice: calculate savingsPercentage and totalAmount
    const processedStandupPouchPrice = normalizedStandupPouchPrice
      ? this.processStandupPouchPrice(normalizedStandupPouchPrice)
      : normalizedStandupPouchPrice;

    // Create product with generated slug and derived price
    const product = await Products.create({
      ...data,
      price: finalPrice,
      sachetPrices: processedSachetPrices,
      standupPouchPrice: processedStandupPouchPrice,
      slug: finalSlug,
    });

    logger.info(`Product created successfully: ${product.slug}`);

    // Populate categories for response
    const populatedProduct = await Products.findById(product._id)
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .lean();

    // Get ingredient details and replace ingredients array with populated data
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: product.ingredients || [] },
    })
      .select("sId slug name description sortOrder icon image")
      .lean();

    // Calculate monthly amounts for subscription prices in response
    const productWithMonthlyAmounts = this.calculateMonthlyAmounts({
      ...populatedProduct,
      ingredients: ingredientDetails, // Replace IDs with populated data
    });

    return {
      product: productWithMonthlyAmounts,
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

    // Base match: not deleted
    const matchStage: Record<string, any> = {
      isDeleted: false,
    };

    // If status filter is provided, use it (admin can filter by status)
    // Otherwise, show only active products (status = true)
    if (status !== undefined) {
      matchStage.status = status;
    } else {
      // Show only active products for regular users
      matchStage.status = true;
    }

    if (variant) {
      matchStage.variant = variant;
    }

    if (hasStandupPouch !== undefined) {
      matchStage.hasStandupPouch = hasStandupPouch;
    }

    if (categories?.length) {
      // Convert string IDs to ObjectIds for categories filter
      matchStage.categories = {
        $in: categories.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (healthGoals?.length) {
      matchStage.healthGoals = { $in: healthGoals };
    }

    if (ingredients?.length) {
      // Ingredients are stored as string IDs
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
      if (status !== undefined) {
        textSearchMatch.status = status;
      } else {
        // Show only active products for regular users
        textSearchMatch.status = true;
      }
      if (variant) textSearchMatch.variant = variant;
      if (hasStandupPouch !== undefined)
        textSearchMatch.hasStandupPouch = hasStandupPouch;

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
      if (categories?.length) {
        arrayFilters.categories = {
          $in: categories.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
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
      // Lookup categories
      {
        $lookup: {
          from: "product_categories",
          localField: "categories",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                sId: 1,
                slug: 1,
                name: 1,
                description: 1,
                sortOrder: 1,
                icon: 1,
                image: 1,
                productCount: 1,
              },
            },
          ],
          as: "categories",
        },
      },
      // Convert string ingredient IDs to ObjectIds and lookup
      {
        $addFields: {
          ingredientObjectIds: {
            $map: {
              input: { $ifNull: ["$ingredients", []] },
              as: "id",
              in: { $toObjectId: "$$id" },
            },
          },
        },
      },
      {
        $lookup: {
          from: "product_ingredients",
          localField: "ingredientObjectIds",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                sId: 1,
                slug: 1,
                name: 1,
                description: 1,
                sortOrder: 1,
                icon: 1,
                image: 1,
              },
            },
          ],
          as: "ingredients",
        },
      },
      {
        $project: {
          ingredientObjectIds: 0,
        },
      },
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
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "value" }],
      },
    });

    const [aggregationResult] = await Products.aggregate(pipeline);
    const products = aggregationResult?.data ?? [];
    const total = aggregationResult?.total?.[0]?.value ?? 0;

    // Calculate monthly amounts for all products
    const productsWithMonthlyAmounts = products.map((product: any) =>
      this.calculateMonthlyAmounts(product)
    );

    return { products: productsWithMonthlyAmounts, total };
  }

  /**
   * Get product by ID with full details
   * Includes variants, detailed ingredients, meta, and structured data
   */
  async getProductById(productId: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      _id: productId,
      isDeleted: false,
    })
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .lean();

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

    // Get ingredient details and replace ingredients array with populated data
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: product.ingredients || [] },
    })
      .select("sId slug name description sortOrder icon image")
      .lean();

    // Fetch product ingredients linked to this product (relationship is reversed)
    let linkedProductIngredients: any[] = [];
    linkedProductIngredients = await ProductIngredients.find({
      products: new mongoose.Types.ObjectId(productId),
      isDeleted: { $ne: true },
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    // Calculate monthly amount for subscription prices if totalAmount is provided
    const enrichedProduct = this.calculateMonthlyAmounts({
      ...product,
      ingredients: ingredientDetails, // Replace IDs with populated data
      variants: variants || [],
      productIngredientDetails: linkedProductIngredients || [],
    });

    return { product: enrichedProduct };
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<{ product: any }> {
    const product = await Products.findOne({
      slug,
      isDeleted: false,
    })
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .lean();

    if (!product) {
      throw new AppError("Product not found", 404);
    }

    // Get ingredient details and replace ingredients array with populated data
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: product.ingredients || [] },
    })
      .select("sId slug name description sortOrder icon image")
      .lean();

    // Calculate monthly amount for subscription prices if totalAmount is provided
    const enrichedProduct = this.calculateMonthlyAmounts({
      ...product,
      ingredients: ingredientDetails, // Replace IDs with populated data
    });

    return { product: enrichedProduct };
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    data: UpdateProductData
  ): Promise<{ product: any; message: string }> {
    const { slug, hasStandupPouch, standupPouchPrice, price, sachetPrices } =
      data;

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

    // Validate standupPouchPrice only if hasStandupPouch is being set to true
    // If hasStandupPouch is undefined, it means it's not being updated, so skip validation
    if (hasStandupPouch === true && !standupPouchPrice) {
      // Check if existing product already has standupPouchPrice
      if (!existingProduct.standupPouchPrice) {
        throw new AppError(
          "standupPouchPrice is required when hasStandupPouch is true",
          400
        );
      }
    }

    // Process sachetPrices: calculate savingsPercentage and totalAmount (if being updated)
    const processedSachetPrices = sachetPrices !== undefined
      ? this.processSachetPrices(sachetPrices)
      : sachetPrices;

    // Normalize standupPouchPrice: if it has oneTime wrapper, unwrap it for storage
    let normalizedStandupPouchPrice = standupPouchPrice;
    if (
      standupPouchPrice &&
      typeof standupPouchPrice === "object" &&
      "oneTime" in standupPouchPrice
    ) {
      // If structure is { oneTime: { count30, count60 } }, unwrap it to { count30, count60 }
      normalizedStandupPouchPrice = (standupPouchPrice as any).oneTime;
    }

    // Process standupPouchPrice: calculate savingsPercentage and totalAmount (if being updated)
    const processedStandupPouchPrice = normalizedStandupPouchPrice !== undefined
      ? this.processStandupPouchPrice(normalizedStandupPouchPrice)
      : normalizedStandupPouchPrice;

    // If price is not provided and sachetPrices exists, derive price from sachetPrices.thirtyDays
    let finalPrice = price;
    if (!finalPrice && processedSachetPrices && processedSachetPrices.thirtyDays) {
      const thirtyDaysPrice = processedSachetPrices.thirtyDays;
      const baseAmount = thirtyDaysPrice.discountedPrice !== undefined
        ? thirtyDaysPrice.discountedPrice
        : thirtyDaysPrice.amount || thirtyDaysPrice.totalAmount || 0;
      finalPrice = {
        currency: thirtyDaysPrice.currency || "EUR",
        amount: baseAmount,
        taxRate: thirtyDaysPrice.taxRate || 0,
      };
    }

    // Handle old image deletion
    const imagesToDelete: string[] = [];

    // Check productImage
    if (
      data.productImage &&
      existingProduct.productImage &&
      data.productImage !== existingProduct.productImage
    ) {
      imagesToDelete.push(existingProduct.productImage);
    }

    // Check galleryImages - delete old ones that are not in new list
    if (
      data.galleryImages &&
      Array.isArray(data.galleryImages) &&
      existingProduct.galleryImages
    ) {
      const oldGalleryImages = Array.isArray(existingProduct.galleryImages)
        ? existingProduct.galleryImages
        : [];
      const imagesToKeep = new Set(data.galleryImages);
      oldGalleryImages.forEach((oldUrl: string) => {
        if (!imagesToKeep.has(oldUrl)) {
          imagesToDelete.push(oldUrl);
        }
      });
    }

    // Check standupPouchImages - delete old ones that are not in new list
    if (
      data.standupPouchImages &&
      Array.isArray(data.standupPouchImages) &&
      existingProduct.standupPouchImages
    ) {
      const oldStandupPouchImages = Array.isArray(
        existingProduct.standupPouchImages
      )
        ? existingProduct.standupPouchImages
        : [];
      const imagesToKeep = new Set(data.standupPouchImages);
      oldStandupPouchImages.forEach((oldUrl: string) => {
        if (!imagesToKeep.has(oldUrl)) {
          imagesToDelete.push(oldUrl);
        }
      });
    }

    // Prepare update object - only include fields that are being updated (not undefined)
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only include fields that are explicitly provided (not undefined)
    Object.keys(data).forEach((key) => {
      if (data[key as keyof UpdateProductData] !== undefined) {
        updateData[key] = data[key as keyof UpdateProductData];
      }
    });

    // Handle processed sachetPrices if provided
    if (sachetPrices !== undefined) {
      updateData.sachetPrices = processedSachetPrices;
    }

    // Handle processed standupPouchPrice if provided
    if (standupPouchPrice !== undefined) {
      updateData.standupPouchPrice = processedStandupPouchPrice;
    }

    // Handle derived price if sachetPrices is being updated
    if (finalPrice !== undefined) {
      updateData.price = finalPrice;
    }

    // Update product with only provided fields
    await Products.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });

    // Delete old images asynchronously (don't wait for it)
    if (imagesToDelete.length > 0) {
      Promise.all(
        imagesToDelete.map((url) => fileStorageService.deleteFileByUrl(url))
      ).catch((err) => {
        logger.error(`Error deleting old images: ${err.message}`);
      });
    }

    // Fetch updated product with populated categories
    const updatedProduct = await Products.findById(productId)
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .lean();

    if (!updatedProduct) {
      throw new AppError("Product not found", 404);
    }

    // Get ingredient details and replace ingredients array with populated data
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: updatedProduct.ingredients || [] },
    })
      .select("sId slug name description sortOrder icon image")
      .lean();

    logger.info(`Product updated successfully: ${updatedProduct.slug}`);

    // Calculate monthly amounts for subscription prices in response
    const productWithMonthlyAmounts = this.calculateMonthlyAmounts({
      ...updatedProduct,
      ingredients: ingredientDetails, // Replace IDs with populated data
    });

    return {
      product: productWithMonthlyAmounts,
      message: "Product updated successfully",
    };
  }

  /**
   * Update product status (enable/disable)
   * enabled = true -> Active (visible to users)
   * enabled = false -> Hidden (not visible to users)
   */
  async updateProductStatus(
    productId: string,
    enabled: boolean
  ): Promise<{ product: any; message: string }> {
    // Check if product exists
    const existingProduct = await Products.findOne({
      _id: productId,
      isDeleted: false,
    });

    if (!existingProduct) {
      throw new AppError("Product not found", 404);
    }

    // Update only status (true = Active, false = Inactive)
    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      {
        status: enabled,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedProduct) {
      throw new AppError("Product not found", 404);
    }

    logger.info(
      `Product ${enabled ? "enabled" : "disabled"} successfully: ${
        updatedProduct.slug
      }`
    );

    // Calculate monthly amounts for subscription prices in response
    const productWithMonthlyAmounts =
      this.calculateMonthlyAmounts(updatedProduct);

    return {
      product: productWithMonthlyAmounts,
      message: `Product ${enabled ? "enabled" : "disabled"} successfully`,
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
    categories: any[];
    healthGoals: string[];
    ingredients: any[];
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
            {
              $lookup: {
                from: "product_categories",
                localField: "_id",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, slug: 1, name: 1, icon: 1 } }],
                as: "category",
              },
            },
            { $unwind: "$category" },
            { $replaceRoot: { newRoot: "$category" } },
            { $sort: { name: 1 } },
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
            {
              $addFields: {
                ingredientObjectId: { $toObjectId: "$_id" },
              },
            },
            {
              $lookup: {
                from: "product_ingredients",
                localField: "ingredientObjectId",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, slug: 1, name: 1, icon: 1 } }],
                as: "ingredient",
              },
            },
            { $unwind: "$ingredient" },
            { $replaceRoot: { newRoot: "$ingredient" } },
            { $sort: { name: 1 } },
          ],
        },
      },
    ]);

    const mapHealthGoals = (items?: Array<{ value: string }>) =>
      (items ?? []).map((item) => item.value);

    return {
      categories: result?.categories || [],
      healthGoals: mapHealthGoals(result?.healthGoals),
      ingredients: result?.ingredients || [],
    };
  }

  /**
   * Get product statistics
   */
  async getProductStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    sachets: number;
    standupPouch: number;
  }> {
    const [total, active, inactive, sachets, standupPouch] = await Promise.all([
      Products.countDocuments({ isDeleted: false }),
      Products.countDocuments({
        status: true,
        isDeleted: false,
      }),
      Products.countDocuments({
        status: false,
        isDeleted: false,
      }),
      Products.countDocuments({
        variant: ProductVariant.SACHETS,
        isDeleted: false,
      }),
      Products.countDocuments({
        variant: ProductVariant.STAND_UP_POUCH,
        isDeleted: false,
      }),
    ]);

    return {
      total,
      active,
      inactive,
      sachets,
      standupPouch,
    };
  }

  /**
   * Calculate monthly amount from totalAmount and durationDays
   * Formula: monthlyAmount = totalAmount / (durationDays / 30)
   */
  private calculateMonthlyAmount(
    totalAmount: number | undefined,
    durationDays: number | undefined
  ): number | undefined {
    if (!totalAmount || !durationDays || durationDays <= 0) {
      return undefined;
    }
    const months = durationDays / 30;
    return Math.round((totalAmount / months) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate monthly amounts for all subscription prices in a product
   */
  private calculateMonthlyAmounts(product: any): any {
    // Preserve all fields including discountedPrice
    const result = { ...product };

    if (product.sachetPrices) {
      const sachetPrices = { ...product.sachetPrices };

      // Calculate monthly amount for each subscription period
      const periods = [
        "thirtyDays",
        "sixtyDays",
        "ninetyDays",
        "oneEightyDays",
      ] as const;

      periods.forEach((period) => {
        if (sachetPrices[period]) {
          const periodData = { ...sachetPrices[period] }; // Preserve discountedPrice
          // Only calculate if amount is not already set and totalAmount exists
          if (
            !periodData.amount &&
            periodData.totalAmount &&
            periodData.durationDays
          ) {
            periodData.amount = this.calculateMonthlyAmount(
              periodData.totalAmount,
              periodData.durationDays
            );
          }
          sachetPrices[period] = periodData;
        }
      });

      // Process oneTime if exists
      if (sachetPrices.oneTime) {
        sachetPrices.oneTime = {
          count30: { ...sachetPrices.oneTime.count30 }, // Preserve discountedPrice
          count60: { ...sachetPrices.oneTime.count60 }, // Preserve discountedPrice
        };
      }

      result.sachetPrices = sachetPrices;
    }

    // Preserve standupPouchPrice with discountedPrice
    if (product.standupPouchPrice) {
      if (product.standupPouchPrice.count30 || product.standupPouchPrice.count60) {
        result.standupPouchPrice = {
          count30: { ...product.standupPouchPrice.count30 }, // Preserve discountedPrice
          count60: { ...product.standupPouchPrice.count60 }, // Preserve discountedPrice
        };
      } else {
        result.standupPouchPrice = { ...product.standupPouchPrice }; // Preserve discountedPrice
      }
    }

    return result;
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
