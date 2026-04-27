import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { ProductCategory } from "../models/commerce/categories.model";
import { ProductFAQs } from "../models/commerce/productFaqs.model";
import { IngredientComposition } from "../models/commerce/ingredientComposition.model";
import { IngredientCompositionService } from "./ingredientComposition.service";
import {
  ProductStatus,
  ProductVariant,
  ReviewStatus,
  OrderStatus,
  PaymentStatus,
  FAQStatus,
} from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { generateSlug, generateUniqueSlug } from "../utils/slug";
import { fileStorageService } from "./fileStorageService";
import mongoose, { PipelineStage } from "mongoose";
import { I18nStringType, I18nTextType } from "../models/common.model";

export type ProductSortOption =
  | "relevance"
  | "priceLowToHigh"
  | "priceHighToLow"
  | "rating"
  | "trending";

export interface ProductSortOptionItem {
  label: string;
  value: ProductSortOption;
}

interface CreateProductData {
  title: string;
  slug?: string;
  description: string;
  productImage: string;
  benefits: string[];
  ingredients: string[];
  ingredientCompositions?: Array<{
    ingredient: string;
    quantity: string;
    driPercentage: number | string;
  }>;
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
  };
  standupPouchPrice?: {
    currency?: string;
    amount?: number;
    taxRate?: number;
    count_0?: { currency: string; amount: number; taxRate: number; capsuleCount?: number; discountedPrice?: number; features?: any[] };
    count_1?: { currency: string; amount: number; taxRate: number; capsuleCount?: number; discountedPrice?: number; features?: any[] };
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
  /** Optional FAQs for this product (max 15). Each item: { question, answer }. */
  faqs?: Array<{
    question: string | I18nStringType;
    answer: string | I18nTextType;
  }>;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

interface UpdateProductData {
  title?: string;
  slug?: string;
  description?: string;
  productImage?: string;
  benefits?: string[];
  ingredients?: string[];
  ingredientCompositions?: Array<{
    ingredient: string;
    quantity: string;
    driPercentage: number | string;
  }>;
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
  };
  standupPouchPrice?: {
    currency?: string;
    amount?: number;
    taxRate?: number;
    count_0?: { currency: string; amount: number; taxRate: number; capsuleCount?: number; discountedPrice?: number; features?: any[] };
    count_1?: { currency: string; amount: number; taxRate: number; capsuleCount?: number; discountedPrice?: number; features?: any[] };
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
  /** Optional FAQs for this product (max 15). Each item: { question, answer }. If provided, replaces all existing FAQs. */
  faqs?: Array<{
    question: string | I18nStringType;
    answer: string | I18nTextType;
  }>;
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
      savingsPercentage =
        Math.round(((amount - discountedPrice) / amount) * 100 * 100) / 100; // Round to 2 decimal places
    }

    // Calculate totalAmount
    // If totalAmount is already provided, use it
    // Otherwise, calculate from discountedPrice (if provided) or amount, then add tax
    // taxRate is now a direct amount (not percentage), so add it directly
    let totalAmount = priceObj.totalAmount;
    if (totalAmount === undefined) {
      const baseAmount =
        discountedPrice !== undefined ? discountedPrice : amount;
      totalAmount = Math.round((baseAmount + taxRate) * 100) / 100;
    }

    const result: any = {
      ...priceObj,
      amount,
      taxRate,
      savingsPercentage:
        savingsPercentage !== undefined ? savingsPercentage : 0,
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

    return processed;
  }

  /**
   * Process standupPouchPrice: calculate savingsPercentage and totalAmount
   */
  private processStandupPouchPrice(standupPouchPrice: any): any {
    if (!standupPouchPrice || typeof standupPouchPrice !== "object") {
      return standupPouchPrice;
    }

    // If it has count_0 / count_1 structure
    if (standupPouchPrice.count_0 || standupPouchPrice.count_1) {
      return {
        count_0: standupPouchPrice.count_0 ? this.processPriceObject(standupPouchPrice.count_0) : undefined,
        count_1: standupPouchPrice.count_1 ? this.processPriceObject(standupPouchPrice.count_1) : undefined,
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
      createdBy,
    } = data;

    const creatorId = createdBy?.toString() || "Unknown";
    logger.info(`[Create Product] Starting product creation - Title: "${title}", CreatedBy: ${creatorId}, Variant: ${variant}`);

    // Generate slug from title if not provided
    let finalSlug = slug;
    if (!finalSlug) {
      // Extract English title from I18n object if needed
      let titleForSlug: string;
      if (typeof title === "string") {
        titleForSlug = title;
      } else if (title && typeof title === "object" && "en" in title) {
        titleForSlug = (title as I18nStringType).en || "";
      } else {
        titleForSlug = String(title || "");
      }
      
      logger.info(`[Create Product] Slug not provided, generating from title: "${titleForSlug}"`);
      const baseSlug = generateSlug(titleForSlug);
      logger.debug(`[Create Product] Base slug generated: "${baseSlug}"`);
      
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
      logger.info(`[Create Product] Unique slug generated: "${finalSlug}"`);
    } else {
      logger.info(`[Create Product] Slug provided: "${finalSlug}", validating uniqueness`);
      // Check if provided slug already exists
      const existingProduct = await Products.findOne({
        slug: finalSlug,
        isDeleted: false,
      });
      if (existingProduct) {
        logger.warn(`[Create Product] Product with slug "${finalSlug}" already exists`);
        throw new AppError("Product with this slug already exists", 409);
      }
      logger.info(`[Create Product] Slug "${finalSlug}" is unique`);
    }

    // Validate standupPouchPrice if hasStandupPouch is true
    if (hasStandupPouch && !standupPouchPrice) {
      logger.error(`[Create Product] Validation failed - hasStandupPouch is true but standupPouchPrice is missing`);
      throw new AppError(
        "standupPouchPrice is required when hasStandupPouch is true",
        400
      );
    }

    if (hasStandupPouch) {
      logger.info(`[Create Product] Standup pouch enabled, processing standupPouchPrice`);
    }

    // Process sachetPrices: calculate savingsPercentage and totalAmount
    let processedSachetPrices = sachetPrices;
    if (sachetPrices) {
      logger.info(`[Create Product] Processing sachetPrices`);
      processedSachetPrices = this.processSachetPrices(sachetPrices);
      logger.debug(`[Create Product] Sachet prices processed successfully`);
    } else {
      logger.info(`[Create Product] No sachetPrices provided`);
    }

    // If price is not provided and sachetPrices exists, derive price from sachetPrices.thirtyDays
    let finalPrice = price;
    if (
      !finalPrice &&
      processedSachetPrices &&
      processedSachetPrices.thirtyDays
    ) {
      logger.info(`[Create Product] Price not provided, deriving from sachetPrices.thirtyDays`);
      const thirtyDaysPrice = processedSachetPrices.thirtyDays as any; // Type assertion for discountedPrice property
      const baseAmount =
        thirtyDaysPrice.discountedPrice !== undefined
          ? thirtyDaysPrice.discountedPrice
          : thirtyDaysPrice.amount || thirtyDaysPrice.totalAmount || 0;
      finalPrice = {
        currency: thirtyDaysPrice.currency || "USD",
        amount: baseAmount,
        taxRate: thirtyDaysPrice.taxRate || 0,
      };
      logger.info(`[Create Product] Derived price: ${finalPrice.amount} ${finalPrice.currency}`);
    } else if (finalPrice) {
      logger.info(`[Create Product] Using provided price: ${finalPrice.amount} ${finalPrice.currency}`);
    } else {
      logger.warn(`[Create Product] No price provided and cannot derive from sachetPrices`);
    }

    // Process standupPouchPrice: calculate savingsPercentage and totalAmount (count_0 / count_1)
    let processedStandupPouchPrice = standupPouchPrice;
    if (standupPouchPrice) {
      logger.info(`[Create Product] Processing standupPouchPrice`);
      processedStandupPouchPrice = this.processStandupPouchPrice(standupPouchPrice);
      logger.debug(`[Create Product] Standup pouch price processed successfully`);
    }

    // Log product data summary before creation
    logger.info(`[Create Product] Creating product with - Slug: "${finalSlug}", Variant: ${variant}, HasStandupPouch: ${hasStandupPouch}, Categories: ${data.categories?.length || 0}, Ingredients: ${data.ingredients?.length || 0}, FAQs: ${data.faqs?.length || 0}`);

    // Strip faqs and ingredient compositions (stored in ingredient_compositions collection)
    const {
      faqs: faqsInput,
      ingredientCompositions: compositionsInput,
      ...productData
    } = data;

    // Create product with generated slug and derived price
    const product = await Products.create({
      ...productData,
      price: finalPrice,
      sachetPrices: processedSachetPrices,
      standupPouchPrice: processedStandupPouchPrice,
      slug: finalSlug,
    });

    logger.info(`[Create Product] Product created successfully - ID: ${product._id}, Slug: "${product.slug}", Title: "${product.title}"`);

    // Create optional product FAQs (max 15)
    if (faqsInput && faqsInput.length > 0) {
      const faqDocs = faqsInput.slice(0, 15).map((faq, index) => {
        const question =
          typeof faq.question === "string" ? { en: faq.question } : faq.question;
        const answer =
          typeof faq.answer === "string" ? { en: faq.answer } : faq.answer;
        return {
          productId: product._id,
          question,
          answer,
          sortOrder: index,
          status: FAQStatus.ACTIVE,
          isActive: true,
        };
      });
      await ProductFAQs.insertMany(faqDocs);
      logger.info(`[Create Product] Created ${faqDocs.length} FAQs for product ${product._id}`);
    }

    // Update ingredient documents to add this product ID to their products array
    const ingredientIds = product.ingredients || [];
    if (ingredientIds.length > 0) {
      logger.info(`[Create Product] Updating ${ingredientIds.length} ingredient documents to add product ID`);
      try {
        await ProductIngredients.updateMany(
          { _id: { $in: ingredientIds } },
          { $addToSet: { products: product._id } } // $addToSet prevents duplicates
        );
        logger.info(`[Create Product] Successfully updated ingredient documents with product ID`);
      } catch (error: any) {
        logger.error(`[Create Product] Failed to update ingredient documents: ${error.message}`, error);
        // Don't throw error, just log it - product is already created
      }
    }

    // Handle ingredient compositions if provided
    const ingredientCompositions = compositionsInput || [];
    if (ingredientCompositions.length > 0 && product._id) {
      logger.info(`[Create Product] Creating ${ingredientCompositions.length} ingredient compositions for product ${product._id}`);
      try {
        const compositionsData = ingredientCompositions.map(comp => ({
          product: product._id,
          ingredient: comp.ingredient,
          quantity: comp.quantity,
          driPercentage: comp.driPercentage,
          createdBy: data.createdBy
        }));
        
        await IngredientCompositionService.bulkUpdateCompositions(
          product._id.toString(),
          compositionsData,
          data.createdBy?.toString()
        );
        logger.info(`[Create Product] Successfully created ingredient compositions for product ${product._id}`);
      } catch (error: any) {
        logger.error(`[Create Product] Failed to create ingredient compositions: ${error.message}`, error);
        // Don't throw error, just log it - product is already created
      }
    }

    // Populate categories for response
    logger.debug(`[Create Product] Populating categories for product ${product._id}`);
    const populatedProduct = await Products.findById(product._id)
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .lean();

    if (populatedProduct?.categories) {
      logger.debug(`[Create Product] Populated ${populatedProduct.categories.length} categories`);
    }

    const newProductId = String(product._id);
    const ingredientCompositionsForResponse =
      await this.getIngredientCompositionsByProductId(newProductId);

    // Get ingredient details and replace ingredients array with populated data
    // Reuse ingredientIds from above (already declared at line 477)
    if (ingredientIds.length > 0) {
      logger.debug(`[Create Product] Fetching ${ingredientIds.length} ingredient details`);
      const ingredientDetails = await ProductIngredients.find({
        _id: { $in: ingredientIds },
      })
        .select("sId slug name description sortOrder icon image")
        .lean();

      logger.debug(`[Create Product] Fetched ${ingredientDetails.length} ingredient details`);

      // Calculate monthly amounts for subscription prices in response
      const productWithMonthlyAmounts = this.calculateMonthlyAmounts({
        ...populatedProduct,
        ingredients: ingredientDetails, // Replace IDs with populated data
        ingredientCompositions: ingredientCompositionsForResponse,
      });

      logger.info(`[Create Product] Product creation completed successfully - ID: ${product._id}, Slug: "${product.slug}"`);

      return {
        product: productWithMonthlyAmounts,
        message: "Product created successfully",
      };
    } else {
      logger.info(`[Create Product] No ingredients to fetch`);
      
      // Calculate monthly amounts for subscription prices in response
      const productWithMonthlyAmounts = this.calculateMonthlyAmounts({
        ...populatedProduct,
        ingredients: [], // No ingredients
        ingredientCompositions: ingredientCompositionsForResponse,
      });

      logger.info(`[Create Product] Product creation completed successfully - ID: ${product._id}, Slug: "${product.slug}"`);

      return {
        product: productWithMonthlyAmounts,
        message: "Product created successfully",
      };
    }
  }

  /**
   * Resolve category identifiers (slug or name) to ObjectIds
   * Supports both ObjectId format and slug/name lookup (case-insensitive)
   */
  private async resolveCategoryIds(
    identifiers: string[]
  ): Promise<mongoose.Types.ObjectId[]> {
    const objectIds: mongoose.Types.ObjectId[] = [];
    const slugsOrNames: string[] = [];

    // Separate ObjectIds from slugs/names
    for (const identifier of identifiers) {
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        objectIds.push(new mongoose.Types.ObjectId(identifier));
      } else {
        slugsOrNames.push(identifier.trim());
      }
    }

    // If we have slugs/names, look them up (try both slug and name)
    if (slugsOrNames.length > 0) {
      // Create case-insensitive regex for names
      const nameRegex = slugsOrNames.map((val) => new RegExp(`^${val}$`, "i"));
      // Lowercase for slug matching
      const slugValues = slugsOrNames.map((val) => val.toLowerCase());

      const categories = await ProductCategory.find({
        $or: [
          { slug: { $in: slugValues } }, // Try slug match
          { "name.en": { $in: nameRegex } }, // Try name match (case-insensitive)
          { "name.nl": { $in: nameRegex } },
          { "name.de": { $in: nameRegex } },
          { "name.fr": { $in: nameRegex } },
          { "name.es": { $in: nameRegex } },
        ],
        isDeleted: { $ne: true },
        isActive: true,
      })
        .select("_id")
        .lean();

      const foundIds = categories.map((cat: any) => cat._id);
      objectIds.push(...foundIds);
    }

    return objectIds;
  }

  /**
   * Resolve ingredient identifiers (name) to string IDs
   * Supports both ObjectId format and name lookup (case-insensitive)
   */
  private async resolveIngredientIds(identifiers: string[]): Promise<string[]> {
    const ids: string[] = [];
    const names: string[] = [];

    // Separate ObjectIds from names
    for (const identifier of identifiers) {
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        ids.push(identifier);
      } else {
        names.push(identifier.trim());
      }
    }

    // If we have names, look them up (case-insensitive)
    if (names.length > 0) {
      console.log(`[DEBUG] Looking up ingredients by names: ${names.join(', ')}`);
      const caseInsensitiveRegex = names.map(
        (name) => new RegExp(name, "i") // Remove ^ and $ for partial match
      );
      console.log(`[DEBUG] Generated regex patterns:`, caseInsensitiveRegex.map(r => r.toString()));
      
      const ingredients = await ProductIngredients.find({
        $or: [
          { "name.en": { $in: caseInsensitiveRegex } },
          { "name.nl": { $in: caseInsensitiveRegex } },
          { "name.de": { $in: caseInsensitiveRegex } },
          { "name.fr": { $in: caseInsensitiveRegex } },
          { "name.es": { $in: caseInsensitiveRegex } },
        ],
        isDeleted: { $ne: true },
        isActive: true,
      })
        .select("_id name")
        .lean();

      console.log(`[DEBUG] Found ingredients:`, ingredients.map(ing => ({ id: ing._id, name: ing.name })));

      const foundIds = ingredients.map((ing: any) => ing._id.toString());
      ids.push(...foundIds);
    }

    console.log(`[DEBUG] Final resolved ingredient IDs: ${ids.join(', ')}`);
    return ids;
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
      status?: boolean;
      variant?: ProductVariant;
      hasStandupPouch?: boolean;
      categories?: string[];
      healthGoals?: string[];
      ingredients?: string[];
      sortBy?: ProductSortOption;
      /** When true (admin), do not filter by status — return all active and inactive products */
      includeInactive?: boolean;
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
      includeInactive,
    } = filters;

    // Base match: not deleted
    const matchStage: Record<string, any> = {
      isDeleted: false,
    };

    // If includeInactive (admin), apply status filter if provided; else if status provided use it, else only active
    if (includeInactive) {
      // Admin mode: include inactive products, but still apply status filter if provided
      if (status !== undefined) {
        matchStage.status = status;
      }
      // If no status provided, don't filter by status (return all active and inactive)
    } else {
      // Public mode: always filter by status
      if (status !== undefined) {
        matchStage.status = status;
      } else {
        matchStage.status = true; // Default to active only for public
      }
    }

    if (variant) {
      matchStage.variant = variant;
    }

    if (hasStandupPouch !== undefined) {
      matchStage.hasStandupPouch = hasStandupPouch;
    }

    // Resolve categories from slugs/names to ObjectIds
    let categoryObjectIds: mongoose.Types.ObjectId[] = [];
    if (categories?.length) {
      categoryObjectIds = await this.resolveCategoryIds(categories);
      if (categoryObjectIds.length > 0) {
        matchStage.categories = {
          $in: categoryObjectIds,
        };
      } else {
        // If no categories found, return empty result
        return { products: [], total: 0 };
      }
    }

    if (healthGoals?.length) {
      // Since healthGoals data has HTML tags, use regex to match within tags
      // Create a single regex pattern that matches any of the provided goals using alternation
      const escapedGoals = healthGoals.map((goal) => {
        // Escape special regex characters
        return goal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      });

      // Combine all goals with | (OR) operator
      const combinedRegex = escapedGoals.join("|");

      // Use $elemMatch to check if any element in array matches the regex pattern
      // This handles HTML tags like "<p>\"Bone Health\"</p>"
      matchStage.healthGoals = {
        $elemMatch: {
          $regex: combinedRegex,
          $options: "i",
        },
      };
    }

    // Resolve ingredients from names to ObjectIds
    let ingredientIds: mongoose.Types.ObjectId[] = [];
    if (ingredients?.length) {
      const resolvedIds = await this.resolveIngredientIds(ingredients);
      if (resolvedIds.length > 0) {
        // Convert string IDs to ObjectIds to match product model
        ingredientIds = resolvedIds.map(id => new mongoose.Types.ObjectId(id));
        matchStage.ingredients = { $all: ingredientIds };
      } else {
        // If no ingredients found, return empty result
        return { products: [], total: 0 };
      }
    }

    const pipeline: PipelineStage[] = [];
    let hasSearch = false;

    // MongoDB requires $text search to be the FIRST stage
    // If search exists, it must be the first $match stage
    if (search && search.trim().length > 0) {
      hasSearch = true;
      const searchTerm = search.trim();
      const escapedSearchTerm = searchTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // When categories are provided, use regex search only (can't combine $text with $in easily)
      // Otherwise, try text search first with regex fallback
      const hasArrayFilters = categoryObjectIds.length > 0 || healthGoals?.length || ingredientIds.length > 0;

      if (hasArrayFilters) {
        // Use regex search only when array filters are present (categories, healthGoals, ingredients)
        // This avoids MongoDB restrictions with $text and $in/$all in same pipeline
        const regexSearchMatch: Record<string, any> = {
          $or: [
            { title: { $regex: escapedSearchTerm, $options: "i" } },
            { "title.en": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.nl": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.de": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.fr": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.es": { $regex: escapedSearchTerm, $options: "i" } },
            { description: { $regex: escapedSearchTerm, $options: "i" } },
            { "description.en": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.nl": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.de": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.fr": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.es": { $regex: escapedSearchTerm, $options: "i" } },
            { shortDescription: { $regex: escapedSearchTerm, $options: "i" } },
            { slug: { $regex: escapedSearchTerm, $options: "i" } },
          ],
          ...matchStage, // Include all base filters (status, variant, hasStandupPouch, etc.)
        };

        pipeline.push({
          $match: regexSearchMatch,
        });

        // Add relevance score for regex search (title can be string or I18n object - $regexMatch needs string input)
        const titleAsString = {
          $cond: [
            { $eq: [{ $type: "$title" }, "string"] },
            { $ifNull: ["$title", ""] },
            { $ifNull: ["$title.en", ""] },
          ],
        };
        pipeline.push({
          $addFields: {
            relevanceScore: {
              $cond: [
                {
                  $regexMatch: {
                    input: titleAsString,
                    regex: escapedSearchTerm,
                    options: "i",
                  },
                },
                10,
                5,
              ],
            },
          },
        });

        // Apply array filters in separate stage
        const arrayFilters: Record<string, any> = {};
        if (categoryObjectIds.length > 0) {
          arrayFilters.categories = {
            $in: categoryObjectIds,
          };
        }
        if (healthGoals?.length) {
          // Use $elemMatch with regex for array filters too
          const escapedGoals = healthGoals.map((goal) => {
            return goal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          });

          const combinedRegex = escapedGoals.join("|");

          arrayFilters.healthGoals = {
            $elemMatch: {
              $regex: combinedRegex,
              $options: "i",
            },
          };
        }
        if (ingredientIds.length > 0) {
          arrayFilters.ingredients = { $all: ingredientIds };
        }

        if (Object.keys(arrayFilters).length > 0) {
          pipeline.push({ $match: arrayFilters });
        }
      } else {
        // No array filters - can use text search with regex fallback
        // Build text search match with isDeleted filter
        const textSearchMatch: Record<string, any> = {
          $text: { $search: searchTerm },
          isDeleted: false,
        };

        // Add other filters that can be combined with $text in same stage
        if (!includeInactive) {
          if (status !== undefined) {
            textSearchMatch.status = status;
          } else {
            textSearchMatch.status = true;
          }
        }
        if (variant) textSearchMatch.variant = variant;
        if (hasStandupPouch !== undefined)
          textSearchMatch.hasStandupPouch = hasStandupPouch;

        // Add regex fallback for better search compatibility
        const regexSearchMatch: Record<string, any> = {
          $or: [
            { title: { $regex: escapedSearchTerm, $options: "i" } },
            { "title.en": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.nl": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.de": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.fr": { $regex: escapedSearchTerm, $options: "i" } },
            { "title.es": { $regex: escapedSearchTerm, $options: "i" } },
            { description: { $regex: escapedSearchTerm, $options: "i" } },
            { "description.en": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.nl": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.de": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.fr": { $regex: escapedSearchTerm, $options: "i" } },
            { "description.es": { $regex: escapedSearchTerm, $options: "i" } },
            { shortDescription: { $regex: escapedSearchTerm, $options: "i" } },
            { slug: { $regex: escapedSearchTerm, $options: "i" } },
          ],
          isDeleted: false,
        };

        if (!includeInactive) {
          if (status !== undefined) {
            regexSearchMatch.status = status;
          } else {
            regexSearchMatch.status = true;
          }
        }
        if (variant) regexSearchMatch.variant = variant;
        if (hasStandupPouch !== undefined)
          regexSearchMatch.hasStandupPouch = hasStandupPouch;

        pipeline.push({
          $match: {
            $or: [textSearchMatch, regexSearchMatch],
          },
        });

        // Add relevance score - use textScore if available, otherwise use regex match (title can be I18n object - $regexMatch needs string)
        const titleAsString = {
          $cond: [
            { $eq: [{ $type: "$title" }, "string"] },
            { $ifNull: ["$title", ""] },
            { $ifNull: ["$title.en", ""] },
          ],
        };
        pipeline.push({
          $addFields: {
            relevanceScore: {
              $ifNull: [
                { $meta: "textScore" },
                {
                  $cond: [
                    {
                      $regexMatch: {
                        input: titleAsString,
                        regex: escapedSearchTerm,
                        options: "i",
                      },
                    },
                    10,
                    5,
                  ],
                },
              ],
            },
          },
        });
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
      // Convert string ingredient IDs to ObjectIds and lookup (with error handling)
      {
        $addFields: {
          ingredientObjectIds: {
            $filter: {
              input: {
                $map: {
                  input: { $ifNull: ["$ingredients", []] },
                  as: "id",
                  in: {
                    $convert: {
                      input: "$$id",
                      to: "objectId",
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              },
              as: "objId",
              cond: { $ne: ["$$objId", null] },
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
              $match: {
                isDeleted: { $ne: true },
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                description: 1,
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
          variants: 0, // Remove variants field from aggregation if it exists
        },
      }
    );

    // Store base pipeline before adding trending stages
    const basePipeline = [...pipeline];

    // Add trending score calculation if sortBy is "trending"
    let useTrendingSort = false;
    if (sortBy === "trending") {
      pipeline.push(...this.buildTrendingScoreStages());
      useTrendingSort = true;
    }

    const sortStage = this.buildSortStage(sortBy, sort, hasSearch);
    pipeline.push({ $sort: sortStage });

    pipeline.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "value" }],
      },
    });

    let [aggregationResult] = await Products.aggregate(pipeline);
    let products = aggregationResult?.data ?? [];
    let total = aggregationResult?.total?.[0]?.value ?? 0;

    // If trending sort was applied but no products found, fallback to all products sorted by createdAt
    if (useTrendingSort && products.length === 0) {
      // Rebuild pipeline without trending stages - use base pipeline
      const fallbackPipeline = [...basePipeline];

      // Add sort by createdAt descending
      fallbackPipeline.push({ $sort: { createdAt: -1 } });

      // Add facet for pagination
      fallbackPipeline.push({
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "value" }],
        },
      });

      // Run aggregation again
      [aggregationResult] = await Products.aggregate(fallbackPipeline);
      products = aggregationResult?.data ?? [];
      total = aggregationResult?.total?.[0]?.value ?? 0;
    }

    // Calculate monthly amounts for all products
    const productsWithMonthlyAmounts = products.map((product: any) =>
      this.calculateMonthlyAmounts(product)
    );

    // Add variants array to all products
    const productsWithVariants = productsWithMonthlyAmounts.map(
      (product: any) => {
        // Step 1: Deep clone product to avoid any reference issues
        const productJson = JSON.stringify(product);
        const clonedProduct = JSON.parse(productJson);

        // Step 2: Remove variants field if it exists (to avoid conflicts)
        delete clonedProduct.variants;

        // Step 3: Create variants array using Array.from() with explicit values
        // This ensures it's a proper array instance
        const variantsArray: string[] = Array.from(
          product.hasStandupPouch === true
            ? (["sachets", "stand_up_pouch"] as string[])
            : (["sachets"] as string[])
        );

        // Step 4: Assign variants using direct property assignment
        clonedProduct.variants = variantsArray;

        // Step 5: Final verification - ensure variants is an array
        // If not, recreate it using Array constructor
        if (!Array.isArray(clonedProduct.variants)) {
          clonedProduct.variants = new Array<string>();
          if (product.hasStandupPouch === true) {
            clonedProduct.variants.push("sachets");
            clonedProduct.variants.push("stand_up_pouch");
          } else {
            clonedProduct.variants.push("sachets");
          }
        }

        return clonedProduct;
      }
    );

    const productsWithIngredientCompositions =
      await this.attachIngredientCompositionsToProducts(productsWithVariants);

    return { products: productsWithIngredientCompositions, total };
  }

  /**
   * Get featured or recent products
   * Returns featured products first, then fills remaining slots with recent products
   * Maximum 10 products total
   */
  async getFeaturedOrRecentProducts(): Promise<{
    products: any[];
    isFeatured: boolean;
  }> {
    const MAX_PRODUCTS = 10;

    // First get featured products
    const featuredProducts = await Products.find({
      isDeleted: false,
      status: true,
      isFeatured: true,
    })
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .sort({ createdAt: -1 })
      .limit(MAX_PRODUCTS)
      .lean();

    const featuredCount = featuredProducts?.length || 0;
    const remainingSlots = MAX_PRODUCTS - featuredCount;

    let allProducts: any[] = [];
    let hasFeatured = false;

    // Process featured products if available
    if (featuredCount > 0) {
      hasFeatured = true;
      const featuredProductIds = featuredProducts.map((p: any) => p._id);

      // Convert string ingredient IDs to ObjectIds and lookup for featured products
      const featuredWithIngredients = await Promise.all(
        featuredProducts.map(async (product: any) => {
          const ingredientDetails = await ProductIngredients.find({
            _id: { $in: product.ingredients || [] },
          })
            .select("sId slug name description sortOrder icon image")
            .lean();

          // Calculate monthly amounts for subscription prices
          const enrichedProduct = this.calculateMonthlyAmounts({
            ...product,
            ingredients: ingredientDetails,
          });

          // Add variants array to product
          return this.addVariantsToSingleProduct(enrichedProduct);
        })
      );

      allProducts = [...featuredWithIngredients];
    }

    // If we need more products, get recent products (excluding featured ones)
    if (remainingSlots > 0) {
      const query: any = {
        isDeleted: false,
        status: true,
      };

      // Exclude featured products if we already have some
      if (featuredCount > 0) {
        const featuredProductIds = featuredProducts.map((p: any) => p._id);
        query._id = { $nin: featuredProductIds };
      }

      const recentProducts = await Products.find(query)
        .populate(
          "categories",
          "sId slug name description sortOrder icon image productCount"
        )
        .sort({ createdAt: -1 })
        .limit(remainingSlots)
        .lean();

      // Convert string ingredient IDs to ObjectIds and lookup for recent products
      const recentWithIngredients = await Promise.all(
        recentProducts.map(async (product: any) => {
          const ingredientDetails = await ProductIngredients.find({
            _id: { $in: product.ingredients || [] },
          })
            .select("sId slug name description sortOrder icon image")
            .lean();

          // Calculate monthly amounts for subscription prices
          const enrichedProduct = this.calculateMonthlyAmounts({
            ...product,
            ingredients: ingredientDetails,
          });

          // Add variants array to product
          return this.addVariantsToSingleProduct(enrichedProduct);
        })
      );

      // Add recent products to the list
      allProducts = [...allProducts, ...recentWithIngredients];
    }

    const productsWithIngredientCompositions =
      await this.attachIngredientCompositionsToProducts(
        allProducts.slice(0, MAX_PRODUCTS)
      );

    return {
      products: productsWithIngredientCompositions, // Ensure max 10 products
      isFeatured: hasFeatured,
    };
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
    // Include image field (not icon, as ProductIngredients model has image field)
    // Always include image field even if null/empty for FE consistency
    const ingredientIds = product.ingredients || [];
    // Convert ingredient IDs to ObjectIds if they're strings
    const ingredientObjectIds = ingredientIds
      .filter((id: any) => id != null) // Filter out null/undefined
      .map((id: any) => {
        if (typeof id === 'string') {
          return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
        }
        return id instanceof mongoose.Types.ObjectId ? id : (mongoose.Types.ObjectId.isValid(id?.toString()) ? new mongoose.Types.ObjectId(id.toString()) : null);
      })
      .filter((id: any) => id != null); // Filter out invalid ObjectIds
    
    const ingredientDetails = ingredientObjectIds.length > 0
      ? await ProductIngredients.find({
          _id: { $in: ingredientObjectIds },
          isDeleted: { $ne: true },
        })
          .select("_id name description image")
          .lean()
      : [];

    // Fetch product ingredients linked to this product (relationship is reversed)
    let linkedProductIngredients: any[] = [];
    linkedProductIngredients = await ProductIngredients.find({
      products: new mongoose.Types.ObjectId(productId),
      isDeleted: { $ne: true },
      isActive: true,
    })
      .select("_id name description image")
      .sort({ name: 1 })
      .lean();

    // Fetch product FAQs
    // Use FAQStatus.ACTIVE (which is "Active") instead of lowercase "active"
    const rawFAQs = await ProductFAQs.find({
      productId: new mongoose.Types.ObjectId(productId),
      isDeleted: { $ne: true },
      isActive: true,
      status: FAQStatus.ACTIVE, // "Active" with capital A
    })
      .select("_id question answer sortOrder")
      .sort({ sortOrder: 1 })
      .lean();

    // Flatten question/answer from { en: "x" } to plain "x" for API response
    const productFAQs = (rawFAQs || []).map((faq: any) => ({
      _id: faq._id,
      question: typeof faq.question === "string" ? faq.question : (faq.question?.en ?? ""),
      answer: typeof faq.answer === "string" ? faq.answer : (faq.answer?.en ?? ""),
      sortOrder: faq.sortOrder ?? 0,
    }));

    // Use productIngredientDetails as ingredients if ingredients array is empty
    // This handles the case where ingredients are linked via reverse relationship
    const finalIngredients = ingredientDetails.length > 0 
      ? ingredientDetails 
      : (linkedProductIngredients.length > 0 ? linkedProductIngredients : []);

    const ingredientCompositions = await this.getIngredientCompositionsByProductId(
      productId
    );

    // Calculate monthly amount for subscription prices if totalAmount is provided
    const enrichedProduct = this.calculateMonthlyAmounts({
      ...product,
      ingredients: finalIngredients, // Use populated ingredients or fallback to linked ingredients
      variants: variants || [],
      productIngredientDetails: linkedProductIngredients || [],
      faqs: productFAQs || [], // Add FAQs to product
      ingredientCompositions,
    });

    // Add variants array to product
    const productWithVariants =
      this.addVariantsToSingleProduct(enrichedProduct);

    return { product: productWithVariants };
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

    // Fetch product variants
    const variants = await ProductVariants.find({
      productId: product._id,
      isDeleted: { $ne: true },
      isActive: true,
    })
      .sort({ sortOrder: 1 })
      .lean();

    // Get ingredient details and replace ingredients array with populated data
    // Include image field (not icon, as ProductIngredients model has image field)
    // Always include image field even if null/empty for FE consistency
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: product.ingredients || [] },
    })
      .select("_id name description image")
      .lean();

    // Fetch product ingredients linked to this product (relationship is reversed)
    let linkedProductIngredients: any[] = [];
    linkedProductIngredients = await ProductIngredients.find({
      products: product._id,
      isDeleted: { $ne: true },
      isActive: true,
    })
      .select("_id name description image")
      .sort({ name: 1 })
      .lean();

    // Fetch product FAQs
    const rawFAQsBySlug = await ProductFAQs.find({
      productId: product._id,
      isDeleted: { $ne: true },
      isActive: true,
      status: FAQStatus.ACTIVE,
    })
      .select("_id question answer sortOrder")
      .sort({ sortOrder: 1 })
      .lean();

    // Flatten question/answer from { en: "x" } to plain "x" for API response
    const productFAQs = (rawFAQsBySlug || []).map((faq: any) => ({
      _id: faq._id,
      question: typeof faq.question === "string" ? faq.question : (faq.question?.en ?? ""),
      answer: typeof faq.answer === "string" ? faq.answer : (faq.answer?.en ?? ""),
      sortOrder: faq.sortOrder ?? 0,
    }));

    const ingredientCompositions = await this.getIngredientCompositionsByProductId(
      product._id.toString()
    );

    // Calculate monthly amount for subscription prices if totalAmount is provided
    const enrichedProduct = this.calculateMonthlyAmounts({
      ...product,
      ingredients: ingredientDetails, // Replace IDs with populated data
      variants: variants || [],
      productIngredientDetails: linkedProductIngredients || [],
      faqs: productFAQs || [], // Add FAQs to product
      ingredientCompositions,
    });

    // Add variants array to product
    const productWithVariants =
      this.addVariantsToSingleProduct(enrichedProduct);

    return { product: productWithVariants };
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

    logger.info("[Update Product] Incoming update payload (high level)", {
      productId,
      hasSpecification: (data as any).specification !== undefined,
      specificationFromRequest: (data as any).specification,
    });

    logger.info("[Update Product] Existing product specification before merge", {
      productId,
      existingSpecification: (existingProduct as any).specification,
    });

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
    const processedSachetPrices =
      sachetPrices !== undefined
        ? this.processSachetPrices(sachetPrices)
        : sachetPrices;

    // Process standupPouchPrice: count_0 / count_1 (if being updated)
    const processedStandupPouchPrice =
      standupPouchPrice !== undefined
        ? this.processStandupPouchPrice(standupPouchPrice)
        : standupPouchPrice;

    // If price is not provided and sachetPrices exists, derive price from sachetPrices.thirtyDays
    let finalPrice = price;
    if (
      !finalPrice &&
      processedSachetPrices &&
      processedSachetPrices.thirtyDays
    ) {
      const thirtyDaysPrice = processedSachetPrices.thirtyDays as any; // Type assertion for discountedPrice property
      const baseAmount =
        thirtyDaysPrice.discountedPrice !== undefined
          ? thirtyDaysPrice.discountedPrice
          : thirtyDaysPrice.amount || thirtyDaysPrice.totalAmount || 0;
      finalPrice = {
        currency: thirtyDaysPrice.currency || "USD",
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

    // Extract faqs from data (FAQs are stored in product_faqs collection, not in product doc)
    const faqsInput = data.faqs;

    // Prepare update object - only include fields that are being updated (not undefined)
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Only include fields that are explicitly provided (not undefined), excluding faqs and specification (specification is merged below)
    Object.keys(data).forEach((key) => {
      if (
        key !== "faqs" &&
        key !== "specification" &&
        key !== "ingredientCompositions" &&
        data[key as keyof UpdateProductData] !== undefined
      ) {
        updateData[key] = data[key as keyof UpdateProductData];
      }
    });

    // Merge specification with existing so partial update does not wipe other fields
    if ((data as any).specification !== undefined) {
      // Ensure we always work with plain JS objects (no Mongoose subdocument metadata)
      const rawExistingSpec: any = (existingProduct as any).specification;
      const existingSpec: Record<string, any> =
        rawExistingSpec && typeof rawExistingSpec === "object"
          ? typeof rawExistingSpec.toObject === "function"
            ? rawExistingSpec.toObject()
            : JSON.parse(JSON.stringify(rawExistingSpec))
          : {};

      const incomingSpec = (data as any).specification as Record<string, any>;
      const mergedSpec: Record<string, any> = { ...existingSpec };

      Object.keys(incomingSpec).forEach((key) => {
        const value = incomingSpec[key];

        // Deep-merge specification.items so that:
        // - Titles/descriptions can be updated
        // - Image fields (image, imageMobile) are only replaced when a new value is provided
        if (key === "items" && Array.isArray(value)) {
          const existingItems = Array.isArray(existingSpec.items)
            ? existingSpec.items
            : [];
          const incomingItems = value;
          const mergedItems: any[] = [];
          const maxLen = Math.max(existingItems.length, incomingItems.length);

          for (let i = 0; i < maxLen; i++) {
            const existingItem = existingItems[i] || {};
            const incomingItem = incomingItems[i];

            if (incomingItem === undefined || incomingItem === null) {
              if (Object.keys(existingItem).length > 0) {
                mergedItems[i] = existingItem;
              }
              continue;
            }

            const mergedItem: Record<string, any> = { ...existingItem };

            Object.keys(incomingItem).forEach((itemKey) => {
              const itemVal = (incomingItem as Record<string, any>)[itemKey];
              // Ignore undefined/null/empty-string so existing values (including images) are preserved
              if (itemVal !== undefined && itemVal !== null && itemVal !== "") {
                mergedItem[itemKey] = itemVal;
              }
            });

            mergedItems[i] = mergedItem;
          }

          mergedSpec.items = mergedItems.filter(
            (item) => item && Object.keys(item).length > 0
          );
        } else {
          // For other top-level specification fields:
          // - Only overwrite when a non-empty value is provided
          //   (prevents accidental clearing of bg_image or main_title with null/empty)
          if (value !== undefined && value !== null && value !== "") {
            mergedSpec[key] = value;
          }
        }
      });

      updateData.specification = mergedSpec;

      logger.info("[Update Product] Merged specification to be saved", {
        productId,
        mergedSpecification: mergedSpec,
      });
    }

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

    // Handle ingredient updates: update ingredient documents if ingredients are being changed
    if (data.ingredients !== undefined) {
      const oldIngredientIds = (existingProduct.ingredients || []).map((id: any) => 
        id.toString()
      );
      const newIngredientIds = (data.ingredients || []).map((id: string) => 
        id.toString()
      );

      // Find ingredients to remove (in old but not in new)
      const ingredientsToRemove = oldIngredientIds.filter(
        (id: string) => !newIngredientIds.includes(id)
      );
      
      // Find ingredients to add (in new but not in old)
      const ingredientsToAdd = newIngredientIds.filter(
        (id: string) => !oldIngredientIds.includes(id)
      );

      logger.info(`[Update Product] Ingredients changed - Removing from ${ingredientsToRemove.length} ingredients, Adding to ${ingredientsToAdd.length} ingredients`);

      // Remove product ID from old ingredients
      if (ingredientsToRemove.length > 0) {
        try {
          await ProductIngredients.updateMany(
            { _id: { $in: ingredientsToRemove.map((id: string) => new mongoose.Types.ObjectId(id)) } },
            { $pull: { products: new mongoose.Types.ObjectId(productId) } }
          );
          logger.info(`[Update Product] Removed product ID from ${ingredientsToRemove.length} ingredient documents`);
        } catch (error: any) {
          logger.error(`[Update Product] Failed to remove product ID from ingredients: ${error.message}`, error);
        }
      }

      // Add product ID to new ingredients
      if (ingredientsToAdd.length > 0) {
        try {
          await ProductIngredients.updateMany(
            { _id: { $in: ingredientsToAdd.map((id: string) => new mongoose.Types.ObjectId(id)) } },
            { $addToSet: { products: new mongoose.Types.ObjectId(productId) } } // $addToSet prevents duplicates
          );
          logger.info(`[Update Product] Added product ID to ${ingredientsToAdd.length} ingredient documents`);
        } catch (error: any) {
          logger.error(`[Update Product] Failed to add product ID to ingredients: ${error.message}`, error);
        }
      }
    }

    // Handle ingredient compositions if provided
    if (data.ingredientCompositions !== undefined) {
      logger.info(`[Update Product] Updating ingredient compositions for product ${productId}`);
      try {
        const compositionsData = data.ingredientCompositions.map((comp: any) => ({
          product: new mongoose.Types.ObjectId(productId),
          ingredient: comp.ingredient,
          quantity: comp.quantity,
          driPercentage: comp.driPercentage,
          updatedBy: data.updatedBy
        }));
        
        await IngredientCompositionService.bulkUpdateCompositions(
          productId,
          compositionsData,
          data.updatedBy?.toString()
        );
        logger.info(`[Update Product] Successfully updated ingredient compositions for product ${productId}`);
      } catch (error: any) {
        logger.error(`[Update Product] Failed to update ingredient compositions: ${error.message}`, error);
        // Don't throw error, just log it - product update will continue
      }
    }

    if (updateData.specification) {
      logger.info("[Update Product] updateData.specification before save", {
        productId,
        specification: updateData.specification,
      });
    }

    // Update product with only provided fields
    await Products.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });

    // Handle FAQ updates: if faqs are provided, replace all existing FAQs
    if (faqsInput !== undefined) {
      if (faqsInput && faqsInput.length > 0) {
        // Delete all existing FAQs for this product
        await ProductFAQs.deleteMany({ productId: new mongoose.Types.ObjectId(productId) });
        logger.info(`[Update Product] Deleted existing FAQs for product ${productId}`);

        // Create new FAQs (max 15)
        const faqDocs = faqsInput.slice(0, 15).map((faq, index) => {
          const question =
            typeof faq.question === "string" ? { en: faq.question } : faq.question;
          const answer =
            typeof faq.answer === "string" ? { en: faq.answer } : faq.answer;
          return {
            productId: new mongoose.Types.ObjectId(productId),
            question,
            answer,
            sortOrder: index,
            status: FAQStatus.ACTIVE,
            isActive: true,
          };
        });
        await ProductFAQs.insertMany(faqDocs);
        logger.info(`[Update Product] Created ${faqDocs.length} new FAQs for product ${productId}`);
      } else {
        // If faqs is empty array, delete all FAQs
        await ProductFAQs.deleteMany({ productId: new mongoose.Types.ObjectId(productId) });
        logger.info(`[Update Product] Deleted all FAQs for product ${productId} (empty faqs array provided)`);
      }
    }

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

    logger.info("[Update Product] Updated product specification from DB", {
      productId,
      updatedSpecification: (updatedProduct as any).specification,
    });

    // Get ingredient details and replace ingredients array with populated data
    const ingredientDetails = await ProductIngredients.find({
      _id: { $in: updatedProduct.ingredients || [] },
    })
      .select("sId slug name description sortOrder icon image")
      .lean();

    logger.info(`Product updated successfully: ${updatedProduct.slug}`);

    const ingredientCompositions = await this.getIngredientCompositionsByProductId(
      productId
    );

    // Calculate monthly amounts for subscription prices in response
    const productWithMonthlyAmounts = this.calculateMonthlyAmounts({
      ...updatedProduct,
      ingredients: ingredientDetails, // Replace IDs with populated data
      ingredientCompositions,
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

    // Remove product ID from all ingredient documents
    const ingredientIds = product.ingredients || [];
    if (ingredientIds.length > 0) {
      logger.info(`[Delete Product] Removing product ID from ${ingredientIds.length} ingredient documents`);
      try {
        await ProductIngredients.updateMany(
          { _id: { $in: ingredientIds } },
          { $pull: { products: new mongoose.Types.ObjectId(productId) } }
        );
        logger.info(`[Delete Product] Successfully removed product ID from ingredient documents`);
      } catch (error: any) {
        logger.error(`[Delete Product] Failed to remove product ID from ingredients: ${error.message}`, error);
        // Don't throw error, continue with product deletion
      }
    }

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
    variants: string[];
    hasStandupPouch: boolean[];
    status: boolean[];
    sortBy: ProductSortOptionItem[];
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
          variant: 1,
          hasStandupPouch: 1,
          status: 1,
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
          variants: [
            { $match: { variant: { $nin: [null, ""] } } },
            { $group: { _id: "$variant" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
          hasStandupPouch: [
            { $match: { hasStandupPouch: { $ne: null } } },
            { $group: { _id: "$hasStandupPouch" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
          status: [
            { $match: { status: { $ne: null } } },
            { $group: { _id: "$status" } },
            { $sort: { _id: 1 } },
            { $project: { value: "$_id", _id: 0 } },
          ],
        },
      },
    ]);

    const mapHealthGoals = (items?: Array<{ value: string | Record<string, string> }>) => {
      const goals = (items ?? []).map((item) => item.value);
      // Normalize to string (healthGoals can be I18n object { en, nl, ... } or plain string)
      const toStr = (v: string | Record<string, string> | undefined): string => {
        if (v == null) return "";
        if (typeof v === "string") return v;
        if (typeof v === "object" && v !== null) return (v.en ?? v.nl ?? Object.values(v)[0] ?? "") as string;
        return "";
      };
      // Clean HTML tags from healthGoals for easier use
      const cleanedGoals = goals
        .map((goal) => {
          const str = toStr(goal);
          // Remove HTML tags like <p> and </p>
          let cleaned = str.replace(/<[^>]*>/g, "");
          // Remove escaped quotes like \"Bone Health\"
          cleaned = cleaned.replace(/\\"/g, '"').replace(/^"|"$/g, "");
          return cleaned.trim();
        })
        .filter((goal) => goal.length > 0);
      // Return unique values
      return [...new Set(cleanedGoals)];
    };

    const mapToValues = (items?: Array<{ value: any }>) =>
      (items ?? []).map((item) => item.value);

    const mapToUniqueValues = (items?: Array<{ value: any }>) => {
      const values = mapToValues(items);
      return [...new Set(values)];
    };

    return {
      categories: result?.categories || [],
      healthGoals: mapHealthGoals(result?.healthGoals),
      ingredients: result?.ingredients || [],
      variants: mapToUniqueValues(result?.variants),
      hasStandupPouch: mapToUniqueValues(result?.hasStandupPouch),
      status: mapToUniqueValues(result?.status),
      sortBy: [
        {
          label: "Relevance",
          value: "relevance",
        },
        {
          label: "Price Low To High",
          value: "priceLowToHigh",
        },
        {
          label: "Price High To Low",
          value: "priceHighToLow",
        },
        {
          label: "Rating",
          value: "rating",
        },
        {
          label: "Trending",
          value: "trending",
        },
      ],
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
   * Get variants array based on hasStandupPouch
   * Returns proper string array: ["sachets"] or ["sachets", "stand_up_pouch"]
   */
  private getVariantsArray(hasStandupPouch: boolean): string[] {
    const arr: string[] = [];
    arr[0] = "sachets";
    if (hasStandupPouch === true) {
      arr[1] = "stand_up_pouch";
    }
    return arr;
  }

  /**
   * Add variants array to a single product
   * Common function to be used across all product APIs
   */
  private addVariantsToSingleProduct(product: any): any {
    // Create variants array
    const variantsArray = this.getVariantsArray(
      product.hasStandupPouch === true
    );

    // Create new product object without existing variants
    const { variants: _, ...productWithoutVariants } = product;

    // Return product with variants array
    return {
      ...productWithoutVariants,
      variants: variantsArray,
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

      result.sachetPrices = sachetPrices;
    }

    // Preserve standupPouchPrice with discountedPrice (count_0 / count_1). Backward compat: map count30/count60 to count_0/count_1.
    if (product.standupPouchPrice) {
      const sp = product.standupPouchPrice as any;
      const hasNew = sp.count_0 || sp.count_1;
      const hasOld = sp.count30 || sp.count60;
      if (hasNew) {
        result.standupPouchPrice = {
          count_0: sp.count_0 ? { ...sp.count_0 } : undefined,
          count_1: sp.count_1 ? { ...sp.count_1 } : undefined,
        };
      } else if (hasOld) {
        result.standupPouchPrice = {
          count_0: sp.count30 ? { ...sp.count30 } : undefined,
          count_1: sp.count60 ? { ...sp.count60 } : undefined,
        };
      } else {
        result.standupPouchPrice = { ...sp };
      }
    }

    return result;
  }

  /**
   * Get ingredient compositions for a single product.
   */
  private async getIngredientCompositionsByProductId(
    productId: string
  ): Promise<any[]> {
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const compositions = await IngredientComposition.find({
      $or: [{ product: productObjectId }, { product: productId }],
      isDeleted: { $ne: true },
    })
      .populate("ingredient", "_id name description image slug")
      .select("_id product ingredient quantity driPercentage")
      .sort({ createdAt: 1 })
      .lean();

    return compositions;
  }

  /**
   * Attach ingredient compositions to a list of products.
   */
  private async attachIngredientCompositionsToProducts(
    products: any[]
  ): Promise<any[]> {
    if (!products || products.length === 0) {
      return products;
    }

    const productIds = products
      .map((product) => product?._id)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const productIdStrings = productIds.map((id) => id.toString());

    if (productIds.length === 0) {
      return products.map((product) => ({
        ...product,
        ingredientCompositions: [],
      }));
    }

    const compositions = await IngredientComposition.find({
      $or: [{ product: { $in: productIds } }, { product: { $in: productIdStrings } }],
      isDeleted: { $ne: true },
    })
      .populate("ingredient", "_id name description image slug")
      .select("_id product ingredient quantity driPercentage")
      .sort({ createdAt: 1 })
      .lean();

    const compositionMap = new Map<string, any[]>();

    for (const composition of compositions) {
      const key = composition.product?.toString();
      if (!key) continue;
      const existing = compositionMap.get(key) || [];
      existing.push(composition);
      compositionMap.set(key, existing);
    }

    return products.map((product) => {
      const key = product?._id?.toString();
      return {
        ...product,
        ingredientCompositions: key ? compositionMap.get(key) || [] : [],
      };
    });
  }

  /**
   * Build aggregation stages to calculate trending scores
   * Compares orders in last 7 days vs previous 7 days (7-14 days ago)
   * Only includes products with at least 2 orders in last 14 days
   */
  private buildTrendingScoreStages(): PipelineStage[] {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    return [
      // Lookup orders for each product in last 14 days
      {
        $lookup: {
          from: "orders",
          let: {
            productId: "$_id",
            last14DaysDate: last14Days,
            nowDate: now,
            last7DaysDate: last7Days,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $gte: ["$createdAt", "$$last14DaysDate"] },
                    { $lt: ["$createdAt", "$$nowDate"] },
                    {
                      $in: [
                        "$status",
                        [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
                      ],
                    },
                    { $eq: ["$paymentStatus", PaymentStatus.COMPLETED] },
                  ],
                },
              },
            },
            {
              $unwind: "$items",
            },
            {
              $match: {
                $expr: { $eq: ["$items.productId", "$$productId"] },
              },
            },
            {
              $project: {
                createdAt: 1,
                quantity: "$items.quantity",
              },
            },
          ],
          as: "recentOrders",
        },
      },
      // Calculate orders in last 7 days and previous 7 days
      {
        $addFields: {
          last7DaysOrders: {
            $size: {
              $filter: {
                input: "$recentOrders",
                as: "order",
                cond: {
                  $and: [
                    { $gte: ["$$order.createdAt", last7Days] },
                    { $lt: ["$$order.createdAt", now] },
                  ],
                },
              },
            },
          },
          previous7DaysOrders: {
            $size: {
              $filter: {
                input: "$recentOrders",
                as: "order",
                cond: {
                  $and: [
                    { $gte: ["$$order.createdAt", last14Days] },
                    { $lt: ["$$order.createdAt", last7Days] },
                  ],
                },
              },
            },
          },
          totalOrders14Days: {
            $size: "$recentOrders",
          },
        },
      },
      // Calculate growth and trending score
      {
        $addFields: {
          growth: {
            $subtract: ["$last7DaysOrders", "$previous7DaysOrders"],
          },
          // Trending score: Higher weight to recent orders and growth
          // Formula: (last7DaysOrders * 2) + (growth * 3) + previous7DaysOrders
          // This gives more weight to recent activity and growth
          trendingScore: {
            $add: [
              { $multiply: ["$last7DaysOrders", 2] }, // Recent orders weighted 2x
              {
                $multiply: [
                  { $subtract: ["$last7DaysOrders", "$previous7DaysOrders"] },
                  3,
                ],
              }, // Growth weighted 3x
              "$previous7DaysOrders", // Previous orders weighted 1x
            ],
          },
        },
      },
      // Filter: Only include products with at least 2 orders in last 14 days
      {
        $match: {
          totalOrders14Days: { $gte: 2 },
        },
      },
      // Project: Clean up temporary fields
      {
        $project: {
          recentOrders: 0,
        },
      },
    ];
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
      case "trending":
        return { trendingScore: -1, last7DaysOrders: -1, createdAt: -1 };
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
