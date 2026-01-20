import mongoose from "mongoose";
import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { Reviews } from "../models/cms/reviews.model";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "../models/common.model";
import { ReviewStatus } from "../models/enums";

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
 * Exported for use in common translation service
 */
export const transformProductForLanguage = (
  product: any,
  lang: SupportedLanguage
): any => {
  // Remove variants from product before spreading to avoid conflicts
  const { variants: _, ...productWithoutVariants } = product;
  
  // Determine variants - keep string arrays as-is, transform objects
  let variantsValue: any[] = [];
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    if (typeof product.variants[0] === 'string') {
      // It's a string array - keep as-is
      variantsValue = product.variants;
    } else {
      // It's an object array - transform
      variantsValue = product.variants.map((variant: any) => {
        if (typeof variant === 'string') {
          return variant;
        }
        return {
          ...variant,
          name: getTranslatedString(variant.name, lang),
        };
      });
    }
  } else if (product.variants) {
    variantsValue = product.variants;
  }

  // Transform shortDescription
  const transformedShortDescription = product.shortDescription
    ? getTranslatedString(product.shortDescription, lang)
    : product.shortDescription;

  // Transform benefits array
  const transformedBenefits = product.benefits
    ? product.benefits.map((benefit: any) => getTranslatedString(benefit, lang))
    : product.benefits;

  // Transform healthGoals array
  const transformedHealthGoals = product.healthGoals
    ? product.healthGoals.map((goal: any) => getTranslatedString(goal, lang))
    : product.healthGoals;

  // Transform comparisonSection
  let transformedComparisonSection = product.comparisonSection;
  if (product.comparisonSection) {
    transformedComparisonSection = {
      ...product.comparisonSection,
      title: getTranslatedString(product.comparisonSection.title, lang),
      columns: product.comparisonSection.columns
        ? product.comparisonSection.columns.map((col: any) =>
            getTranslatedString(col, lang)
          )
        : product.comparisonSection.columns,
      rows: product.comparisonSection.rows
        ? product.comparisonSection.rows.map((row: any) => ({
            ...row,
            label: getTranslatedString(row.label, lang),
          }))
        : product.comparisonSection.rows,
    };
  }

  // Transform specification
  let transformedSpecification = product.specification;
  if (product.specification) {
    transformedSpecification = {
      ...product.specification,
      main_title: getTranslatedString(product.specification.main_title, lang),
      items: product.specification.items
        ? product.specification.items.map((item: any) => ({
            ...item,
            title: getTranslatedString(item.title, lang),
            descr: getTranslatedText(item.descr, lang),
          }))
        : product.specification.items,
    };
  }

  // Transform sachetPrices features
  let transformedSachetPrices = product.sachetPrices;
  if (product.sachetPrices) {
    transformedSachetPrices = { ...product.sachetPrices };

    // Transform features in subscription periods
    const periods = ["thirtyDays", "sixtyDays", "ninetyDays", "oneEightyDays"];
    periods.forEach((period) => {
      if (transformedSachetPrices[period]?.features) {
        transformedSachetPrices[period] = {
          ...transformedSachetPrices[period],
          features: transformedSachetPrices[period].features.map((feature: any) =>
            getTranslatedString(feature, lang)
          ),
        };
      }
    });

    // Transform features in oneTime options
    if (transformedSachetPrices.oneTime) {
      transformedSachetPrices.oneTime = { ...transformedSachetPrices.oneTime };

      if (transformedSachetPrices.oneTime.count30?.features) {
        transformedSachetPrices.oneTime.count30 = {
          ...transformedSachetPrices.oneTime.count30,
          features: transformedSachetPrices.oneTime.count30.features.map(
            (feature: any) => getTranslatedString(feature, lang)
          ),
        };
      }

      if (transformedSachetPrices.oneTime.count60?.features) {
        transformedSachetPrices.oneTime.count60 = {
          ...transformedSachetPrices.oneTime.count60,
          features: transformedSachetPrices.oneTime.count60.features.map(
            (feature: any) => getTranslatedString(feature, lang)
          ),
        };
      }
    }
  }

  // Transform standupPouchPrice features
  let transformedStandupPouchPrice = product.standupPouchPrice;
  if (product.standupPouchPrice) {
    // Check if it's the count30/count60 structure
    if (product.standupPouchPrice.count30 || product.standupPouchPrice.count60) {
      transformedStandupPouchPrice = { ...product.standupPouchPrice };

      if (transformedStandupPouchPrice.count30?.features) {
        transformedStandupPouchPrice.count30 = {
          ...transformedStandupPouchPrice.count30,
          features: transformedStandupPouchPrice.count30.features.map(
            (feature: any) => getTranslatedString(feature, lang)
          ),
        };
      }

      if (transformedStandupPouchPrice.count60?.features) {
        transformedStandupPouchPrice.count60 = {
          ...transformedStandupPouchPrice.count60,
          features: transformedStandupPouchPrice.count60.features.map(
            (feature: any) => getTranslatedString(feature, lang)
          ),
        };
      }
    }
  }

  return {
    ...productWithoutVariants,
    title: getTranslatedString(product.title, lang),
    description: getTranslatedText(product.description, lang),
    shortDescription: transformedShortDescription,
    benefits: transformedBenefits,
    healthGoals: transformedHealthGoals,
    nutritionInfo: getTranslatedText(product.nutritionInfo, lang),
    howToUse: getTranslatedText(product.howToUse, lang),
    comparisonSection: transformedComparisonSection,
    specification: transformedSpecification,
    sachetPrices: transformedSachetPrices,
    standupPouchPrice: transformedStandupPouchPrice,
    variants: variantsValue,
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

/**
 * Enrich a single product with full details
 * This is the common function used across all APIs (getAllProducts, wishlist, cart, checkout)
 */
export async function enrichProduct(
  product: any,
  options: {
    userId?: string;
    userLang?: SupportedLanguage;
    isLiked?: boolean;
  } = {}
): Promise<any> {
  const { userId, userLang = DEFAULT_LANGUAGE, isLiked = false } = options;

  // Transform product for language
  const transformedProduct = transformProductForLanguage(product, userLang);

  // Calculate monthly amounts for subscription pricing
  const productWithMonthlyAmounts = calculateMonthlyAmounts(transformedProduct);

  // Calculate member pricing
  const productPriceSource: ProductPriceSource = {
    price: productWithMonthlyAmounts.price,
    memberPrice: productWithMonthlyAmounts.metadata?.memberPrice,
    memberDiscountOverride:
      productWithMonthlyAmounts.metadata?.memberDiscountOverride,
  };

  const memberPriceResult = await calculateMemberPrice(
    productPriceSource,
    userId || ""
  );

  // Build full product object (same format as getAllProducts)
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
    // Rating fields (same as getAllProducts - directly on product, not nested)
    // If product already has averageRating/ratingCount from aggregation, use them
    // Otherwise, they will be 0 (will be calculated in fetchAndEnrichProducts if needed)
    averageRating:
      productWithMonthlyAmounts.averageRating !== undefined
        ? productWithMonthlyAmounts.averageRating
        : 0,
    ratingCount:
      productWithMonthlyAmounts.ratingCount !== undefined
        ? productWithMonthlyAmounts.ratingCount
        : 0,
    is_liked: isLiked,
  };

  // Add variants array explicitly based on hasStandupPouch
  enrichedProduct.variants = productWithMonthlyAmounts.hasStandupPouch === true
    ? ["sachets", "stand_up_pouch"]
    : ["sachets"];

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

  return enrichedProduct;
}

/**
 * Fetch and enrich multiple products with full details
 * Handles fetching products, populating categories/ingredients, and enriching them
 */
export async function fetchAndEnrichProducts(
  productIds: mongoose.Types.ObjectId[],
  options: {
    userId?: string;
    userLang?: SupportedLanguage;
    wishlistProductIds?: Set<string>;
  } = {}
): Promise<any[]> {
  const { userId, userLang = DEFAULT_LANGUAGE, wishlistProductIds } = options;

  if (productIds.length === 0) {
    return [];
  }

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

  // Get review stats for products that don't have them already
  const productsNeedingRatings = products.filter(
    (p: any) => p.averageRating === undefined || p.ratingCount === undefined
  );
  const productIdsNeedingRatings = productsNeedingRatings.map((p: any) =>
    p._id.toString()
  );

  let reviewStatsMap = new Map();
  if (productIdsNeedingRatings.length > 0) {
    const reviewStats = await Reviews.aggregate([
      {
        $match: {
          productId: {
            $in: productIdsNeedingRatings.map(
              (id: string) => new mongoose.Types.ObjectId(id)
            ),
          },
          status: ReviewStatus.APPROVED,
          isPublic: true,
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: "$productId",
          ratingCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    reviewStatsMap = new Map(
      reviewStats.map((stat) => [
        stat._id.toString(),
        {
          averageRating: Math.round((stat.averageRating || 0) * 100) / 100, // Round to 2 decimal places (same as getAllProducts)
          ratingCount: stat.ratingCount || 0,
        },
      ])
    );
  }

  // Enrich all products
  const enrichedProducts = await Promise.all(
    products.map(async (product: any) => {
      const isLiked = wishlistProductIds
        ? wishlistProductIds.has(product._id.toString())
        : false;

      // Add rating stats if not already present
      if (
        product.averageRating === undefined ||
        product.ratingCount === undefined
      ) {
        const stats = reviewStatsMap.get(product._id.toString());
        if (stats) {
          product.averageRating = stats.averageRating;
          product.ratingCount = stats.ratingCount;
        } else {
          product.averageRating = 0;
          product.ratingCount = 0;
        }
      }

      return enrichProduct(product, {
        userId,
        userLang,
        isLiked,
      });
    })
  );

  return enrichedProducts;
}

