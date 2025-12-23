import { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cartService";
import { checkoutService } from "../services/checkoutService";
import { AppError } from "../utils/AppError";
import { Addresses } from "../models/core/addresses.model";
import mongoose from "mongoose";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import { Wishlists } from "../models/commerce";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "../models/common.model";
import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";

/**
 * Calculate monthly amount from totalAmount and durationDays
 * Formula: monthlyAmount = totalAmount / (durationDays / 30)
 */
const calculateMonthlyAmount = (
  totalAmount: number | undefined,
  durationDays: number | undefined
): number | undefined => {
  if (!totalAmount || !durationDays || durationDays <= 0) {
    return undefined;
  }
  const months = durationDays / 30;
  return Math.round((totalAmount / months) * 100) / 100; // Round to 2 decimal places
};

/**
 * Calculate monthly amounts for all subscription prices in a product
 * Same as productService.calculateMonthlyAmounts
 */
const calculateMonthlyAmounts = (product: any): any => {
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
        const periodData = { ...sachetPrices[period] };
        // Only calculate if amount is not already set and totalAmount exists
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

    // Process oneTime if exists
    if (sachetPrices.oneTime) {
      sachetPrices.oneTime = {
        count30: { ...sachetPrices.oneTime.count30 },
        count60: { ...sachetPrices.oneTime.count60 },
      };
    }

    result.sachetPrices = sachetPrices;
  }

  // Preserve standupPouchPrice
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
    return DEFAULT_LANGUAGE;
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request
 */
const getUserLanguage = (req: AuthenticatedRequest): SupportedLanguage => {
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
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
 * Transform product to use user's language (same as getAllProducts)
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

class CheckoutController {
  /**
   * Get checkout products with all pricing details
   * @route GET /api/v1/checkout/products
   * @access Private
   */
  static async getCheckoutProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const userLang = getUserLanguage(req);

      // Get user's wishlist items
      const wishlistItems = await Wishlists.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("productId")
        .lean();
      const userWishlistProductIds = new Set(
        wishlistItems.map((item: any) => item.productId.toString())
      );

      const result = await cartService.getCheckoutProducts(userId);

      // Transform products to match getAllProducts format
      const transformedProducts = await Promise.all(
        result.products.map(async (product: any) => {
          // Extract base product data (cartService returns products with pricing nested)
          const baseProduct = {
            ...product,
            price: product.pricing?.originalPrice || product.price,
            variant: product.productVariant || product.variant,
            sachetPrices: product.pricing?.productPricing?.sachetPrices || product.sachetPrices,
            standupPouchPrice: product.pricing?.productPricing?.standupPouchPrice || product.standupPouchPrice,
          };

          // Transform product for language
          const transformedProduct = transformProductForLanguage(
            baseProduct,
            userLang
          );

          // Calculate member price
          const productPriceSource: ProductPriceSource = {
            price: transformedProduct.price,
            memberPrice: transformedProduct.metadata?.memberPrice,
            memberDiscountOverride:
              transformedProduct.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(
            productPriceSource,
            userId
          );

          // Build product in getAllProducts format
          let enrichedProduct: any = {
            _id: transformedProduct._id,
            title: transformedProduct.title,
            slug: transformedProduct.slug,
            productImage: transformedProduct.productImage,
            shortDescription: transformedProduct.shortDescription,
            description: transformedProduct.description,
            nutritionInfo: transformedProduct.nutritionInfo,
            howToUse: transformedProduct.howToUse,
            price: transformedProduct.price,
            variant: transformedProduct.variant,
            hasStandupPouch: transformedProduct.hasStandupPouch,
            sachetPrices: transformedProduct.sachetPrices,
            standupPouchPrice: transformedProduct.standupPouchPrice,
            categories: transformedProduct.categories || [],
            ingredients: transformedProduct.ingredients || [],
            variants: transformedProduct.variants || [],
            quantity: product.quantity,
            cartPrice: product.pricing?.cartPrice,
            variantInfo: product.variant,
            is_liked: userWishlistProductIds.has(
              transformedProduct._id.toString()
            ),
          };

          // Calculate monthly amounts for subscription pricing (same as getAllProducts)
          enrichedProduct = calculateMonthlyAmounts(enrichedProduct);

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
        })
      );

      res.status(200).json({
        success: true,
        message: "Checkout products retrieved successfully",
        data: {
          products: transformedProducts,
          pricing: result.pricing,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get featured products excluding cart items (3-5 products)
   * @route GET /api/v1/checkout/featured-products
   * @access Private
   */
  static async getFeaturedProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const userLang = getUserLanguage(req);
      const minCount = parseInt(req.query.minCount as string, 10) || 3;
      const maxCount = parseInt(req.query.maxCount as string, 10) || 5;

      // Get user's wishlist items
      const wishlistItems = await Wishlists.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("productId")
        .lean();
      const userWishlistProductIds = new Set(
        wishlistItems.map((item: any) => item.productId.toString())
      );

      const featuredProducts = await cartService.getFeaturedProducts(
        userId,
        minCount,
        maxCount
      );

      // Transform products to match getAllProducts format
      const transformedProducts = await Promise.all(
        featuredProducts.map(async (product: any) => {
          // Transform product for language
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );

          // Calculate member price
          const productPriceSource: ProductPriceSource = {
            price: transformedProduct.price,
            memberPrice: transformedProduct.metadata?.memberPrice,
            memberDiscountOverride:
              transformedProduct.metadata?.memberDiscountOverride,
          };

          const memberPriceResult = await calculateMemberPrice(
            productPriceSource,
            userId
          );

          // Build product in getAllProducts format
          let enrichedProduct: any = {
            ...transformedProduct,
            price: transformedProduct.price,
            is_liked: userWishlistProductIds.has(
              transformedProduct._id.toString()
            ),
          };

          // Calculate monthly amounts for subscription pricing (same as getAllProducts)
          enrichedProduct = calculateMonthlyAmounts(enrichedProduct);

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
        })
      );

      res.status(200).json({
        success: true,
        message: "Featured products retrieved successfully",
        data: transformedProducts,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get checkout summary with membership discount calculation
   * @route GET /api/checkout/summary
   * @access Private
   */
  static async getCheckoutSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const userLang = getUserLanguage(req);

      // Parallel execution: Validate cart and fetch addresses simultaneously
      const [cartValidation, shippingAddress, billingAddress] =
        await Promise.all([
          cartService.validateCart(userId),
          Addresses.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            isDefault: true,
            isDeleted: false,
          }).lean(),
          Addresses.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            isDefault: true,
            isDeleted: false,
          }).lean(),
        ]);

      if (!cartValidation.isValid) {
        res.status(400).json({
          success: false,
          message: "Cart validation failed",
          errorType: "Validation Error",
          error: "Cart validation failed",
          data: null,
        });
        return;
      }

      // Check if user is a member (check if any item has member pricing)
      const isMember = cartValidation.items.some(
        (item) => item.isMember === true
      );

      // Get product IDs and variant IDs from cart items
      const productIds = cartValidation.items.map((item) =>
        new mongoose.Types.ObjectId(item.productId)
      );
      const variantIds = cartValidation.items
        .map((item) => item.variantId)
        .filter((id) => id)
        .map((id) => new mongoose.Types.ObjectId(id));

      // Fetch products and variants with full details
      const [products, variants] = await Promise.all([
        Products.find({
          _id: { $in: productIds },
          isDeleted: false,
          status: true,
        })
          .populate("categories", "name slug description image")
          .lean(),
        variantIds.length > 0
          ? ProductVariants.find({
              _id: { $in: variantIds },
              isDeleted: { $ne: true },
              isActive: true,
            }).lean()
          : Promise.resolve([]),
      ]);

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

      // Create maps for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p])
      );
      const variantMap = new Map(
        variants.map((v: any) => [v._id.toString(), v])
      );

      // Build items with full product details
      const itemsWithProducts = await Promise.all(
        cartValidation.items.map(async (item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            return null;
          }

          const variant = item.variantId
            ? variantMap.get(item.variantId)
            : null;

          // Transform product for language
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );

          // Calculate monthly amounts for subscription pricing
          const productWithMonthlyAmounts = calculateMonthlyAmounts(
            transformedProduct
          );

          // Build full product object similar to getAllProducts format
          const fullProduct: any = {
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
          };

          // Add variant info if exists
          if (variant) {
            fullProduct.variantInfo = {
              _id: variant._id,
              name: variant.name,
              sku: variant.sku,
              attributes: variant.attributes,
              price: variant.price,
              compareAtPrice: variant.compareAtPrice,
            };
          }

          return {
            product: fullProduct,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            originalPrice: item.originalPrice,
            memberPrice: item.memberPrice,
            discount: item.discount,
            isMember: item.isMember || false,
          };
        })
      );

      // Filter out null items
      const validItems = itemsWithProducts.filter((item) => item !== null);

      // Build summary response
      const summary = {
        cart: {
          items: validItems,
        },
        pricing: {
          originalSubtotal: cartValidation.pricing.originalSubtotal,
          subtotal: cartValidation.pricing.subtotal,
          membershipDiscount: cartValidation.pricing.membershipDiscount,
          tax: cartValidation.pricing.tax,
          shipping: cartValidation.pricing.shipping,
          total: cartValidation.pricing.total,
        },
        addresses: {
          shipping: shippingAddress
            ? {
                id: shippingAddress._id,
                firstName: shippingAddress.firstName,
                lastName: shippingAddress.lastName,
                streetName: shippingAddress.streetName,
                houseNumber: shippingAddress.houseNumber,
                houseNumberAddition: shippingAddress.houseNumberAddition,
                postalCode: shippingAddress.postalCode,
                address: shippingAddress.address,
                phone: shippingAddress.phone,
                city: shippingAddress.city,
                country: shippingAddress.country,
                isDefault: shippingAddress.isDefault,
                note: shippingAddress.note,
              }
            : null,
          billing: billingAddress
            ? {
                id: billingAddress._id,
                firstName: billingAddress.firstName,
                lastName: billingAddress.lastName,
                streetName: billingAddress.streetName,
                houseNumber: billingAddress.houseNumber,
                houseNumberAddition: billingAddress.houseNumberAddition,
                postalCode: billingAddress.postalCode,
                address: billingAddress.address,
                phone: billingAddress.phone,
                city: billingAddress.city,
                country: billingAddress.country,
                isDefault: billingAddress.isDefault,
                note: billingAddress.note,
              }
            : null,
        },
        membership: {
          isMember,
          discount: isMember
            ? {
                amount: cartValidation.pricing.membershipDiscount.amount,
                currency: cartValidation.pricing.membershipDiscount.currency,
              }
            : null,
        },
      };

      res.status(200).json({
        success: true,
        message: "Checkout summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get purchase plans for products in cart
   * @route GET /api/checkout/purchase-plans
   * @access Private
   */
  static async getPurchasePlans(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      // Get selected plans from query params (optional)
      // Format: ?selectedPlans={"productId1":{"planKey":"ninetyDays"},"productId2":{"planKey":"oneTime","capsuleCount":30}}
      let selectedPlans:
        | Record<string, { planKey: string; capsuleCount?: number }>
        | undefined;
      if (
        req.query.selectedPlans &&
        typeof req.query.selectedPlans === "string"
      ) {
        try {
          selectedPlans = JSON.parse(req.query.selectedPlans);
        } catch (e) {
          // Invalid JSON, ignore
        }
      }

      const result = await checkoutService.getPurchasePlans(
        userId,
        selectedPlans
      );

      res.status(200).json({
        success: true,
        message: "Purchase plans retrieved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export { CheckoutController };
