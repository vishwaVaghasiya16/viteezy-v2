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
import { Carts, Wishlists } from "../models/commerce";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "../models/common.model";
import { Products } from "../models/commerce/products.model";
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
    if (
      product.standupPouchPrice.count30 ||
      product.standupPouchPrice.count60
    ) {
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
  // Remove variants from product before spreading to avoid conflicts
  const { variants: _, ...productWithoutVariants } = product;

  // Determine variants - keep string arrays as-is, transform objects
  let variantsValue: any[] = [];
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    if (typeof product.variants[0] === "string") {
      // It's a string array - keep as-is
      variantsValue = product.variants;
    } else {
      // It's an object array - transform
      variantsValue = product.variants.map((variant: any) => {
        if (typeof variant === "string") {
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

  return {
    ...productWithoutVariants,
    title: getTranslatedString(product.title, lang),
    description: getTranslatedText(product.description, lang),
    nutritionInfo: getTranslatedText(product.nutritionInfo, lang),
    howToUse: getTranslatedText(product.howToUse, lang),
    variants: variantsValue,
    // Transform populated ingredients for language
    // Always include image field (null/empty if not present) for FE consistency
    ingredients:
      product.ingredients?.map((ingredient: any) => ({
        _id: ingredient._id,
        name: getTranslatedString(ingredient.name, lang),
        description: getTranslatedText(ingredient.description, lang),
        image: ingredient.image || null, // Always include image field, null if not present
      })) || [],
    // Transform populated categories for language
    categories:
      product.categories?.map((category: any) => ({
        ...category,
        name: getTranslatedString(category.name, lang),
        description: getTranslatedText(category.description, lang),
        image: category.image || undefined,
      })) || [],
    // Transform FAQs for language (return empty array if no FAQs)
    faqs:
      product.faqs?.map((faq: any) => ({
        _id: faq._id,
        question: getTranslatedString(faq.question, lang),
        answer: getTranslatedText(faq.answer, lang),
        sortOrder: faq.sortOrder || 0,
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
            sachetPrices:
              product.pricing?.productPricing?.sachetPrices ||
              product.sachetPrices,
            standupPouchPrice:
              product.pricing?.productPricing?.standupPouchPrice ||
              product.standupPouchPrice,
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

          // Add variants array based on hasStandupPouch
          const variantsArray =
            transformedProduct.hasStandupPouch === true
              ? ["sachets", "stand_up_pouch"]
              : ["sachets"];

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
            variants: variantsArray,
            quantity: product.quantity,
            cartPrice: product.pricing?.cartPrice,
            variantInfo: product.variant,
            is_liked: userWishlistProductIds.has(
              transformedProduct._id.toString()
            ),
            isInCart: true, // Products in checkout are always in cart
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

      // Get cart product IDs to check if featured products are in cart
      const cartProductIds = await cartService.getCartProductIds(userId);

      const featuredProducts = await cartService.getFeaturedProducts(
        userId,
        minCount,
        maxCount
      );

      // Transform products to match getAllProducts format exactly
      const transformedProducts = await Promise.all(
        featuredProducts.map(async (product: any) => {
          // First transform product for user's language (same as getAllProducts)
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );

          // Calculate member price (same as getAllProducts)
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

          // Remove variants before spreading to avoid conflicts
          const { variants: __, ...transformedWithoutVariants } =
            transformedProduct;

          // Build product in getAllProducts format (same structure)
          const enrichedProduct: any = {
            ...transformedWithoutVariants,
            // Keep price object exactly as it was - don't modify it (same as getAllProducts)
            price: transformedProduct.price,
          };

          // Add variants array explicitly based on hasStandupPouch
          enrichedProduct.variants =
            transformedProduct.hasStandupPouch === true
              ? ["sachets", "stand_up_pouch"]
              : ["sachets"];

          // Only add member pricing fields if user is a member (same as getAllProducts)
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

          // Add is_liked field if user is authenticated (same as getAllProducts)
          enrichedProduct.is_liked = userWishlistProductIds.has(
            transformedProduct._id.toString()
          );

          // Add isInCart field (same as getAllProducts)
          enrichedProduct.isInCart = cartProductIds.has(
            transformedProduct._id.toString()
          );

          return enrichedProduct;
        })
      );

      // Return response in same format as getAllProducts (without pagination)
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
   *
   * Query parameters (optional):
   * - planDurationDays: 30 | 60 | 90 | 180
   * - isSubscription: boolean (T for subscription, F for one-time)
   * - supplementsCount: 30 | 60 (required if isSubscription is false)
   * - variantType: "SACHETS" | "STAND_UP_POUCH"
   * - couponCode: string (optional)
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

      // Check if plan selection parameters are provided
      const planDurationDays = req.query.planDurationDays
        ? parseInt(req.query.planDurationDays as string, 10)
        : undefined;
      const isSubscription =
        req.query.isSubscription !== undefined
          ? req.query.isSubscription === "true" ||
            req.query.isSubscription === "T"
          : undefined;
      const supplementsCount = req.query.supplementsCount
        ? parseInt(req.query.supplementsCount as string, 10)
        : undefined;
      const variantType = req.query.variantType as string | undefined;
      const couponCode = req.query.couponCode as string | undefined;

      // If plan selection parameters are provided, use new logic
      if (
        planDurationDays &&
        isSubscription !== undefined &&
        variantType &&
        [30, 60, 90, 180].includes(planDurationDays) &&
        ["SACHETS", "STAND_UP_POUCH"].includes(variantType)
      ) {
        // Validate supplementsCount for one-time purchases
        if (!isSubscription && !supplementsCount) {
          throw new AppError(
            "Supplements count is required for one-time purchases",
            400
          );
        }

        if (
          !isSubscription &&
          supplementsCount &&
          ![30, 60].includes(supplementsCount)
        ) {
          throw new AppError(
            "Supplements count must be 30 or 60 for one-time purchases",
            400
          );
        }

        const result =
          await checkoutService.getCheckoutSummaryWithPlanSelection(userId, {
            planDurationDays: planDurationDays as 30 | 60 | 90 | 180,
            isSubscription,
            supplementsCount: supplementsCount as 30 | 60 | undefined,
            variantType: variantType as any,
            couponCode,
          });

        res.status(200).json({
          success: true,
          message:
            "Checkout summary with plan selection retrieved successfully",
          data: {
            products: result.products,
            payment: result.payment,
          },
        });
        return;
      }

      // Fallback to original behavior if no plan selection parameters
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

      // Get product IDs from cart items
      const productIds = cartValidation.items.map(
        (item) => new mongoose.Types.ObjectId(item.productId)
      );

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

      // Create maps for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p])
      );

      // Build items with full product details
      const itemsWithProducts = await Promise.all(
        cartValidation.items.map(async (item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            return null;
          }

          // Transform product for language
          const transformedProduct = transformProductForLanguage(
            product,
            userLang
          );

          // Calculate monthly amounts for subscription pricing
          const productWithMonthlyAmounts =
            calculateMonthlyAmounts(transformedProduct);

          // Add variants array based on hasStandupPouch
          const variantsArray =
            productWithMonthlyAmounts.hasStandupPouch === true
              ? ["sachets", "stand_up_pouch"]
              : ["sachets"];

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
            variants: variantsArray,
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
            isInCart: true, // Products in checkout summary are in cart
          };

          return {
            product: fullProduct,
            productId: item.productId,
            quantity: 1, // Quantity removed from cart, each item is 1
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

  /**
   * Plan selection API for checkout page
   * @route POST /api/v1/checkout/plan-selection
   * @access Private
   *
   * Request body:
   *  - planDurationDays (in days) - 30, 60, 90, or 180
   *  - isSubscription (true = subscription, false = one-time)
   *  - supplementsCount (required for one-time, e.g. 30 or 60)
   *  - variantType (e.g. SACHETS, STAND_UP_POUCH)
   *
   * Response:
   *  - Selected product list with prices based on chosen plan
   *  - Membership prices and discounts for each product (if member)
   *  - Payment details:
   *    - subtotal (with member prices if applicable)
   *    - discountPrice (coupon discount, if any)
   *    - ninetyDayPlanDiscount (if 90-day plan selected)
   *    - tax (future scope, currently 0)
   *    - shippingFees (currently 0)
   *    - membershipDiscount (total membership discount amount)
   *    - totalAmount
   */
  static async selectPlan(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await checkoutService.getPlanSelection(
        userId,
        req.body as any
      );

      res.status(200).json({
        success: true,
        message: "Checkout plan selection calculated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Enhanced plan selection & pricing calculation API
   * @route POST /api/v1/checkout/enhanced-pricing
   * @access Private
   *
   * Request body:
   *  - planDurationDays: 30 | 60 | 90 | 180
   *  - planType: "SACHET" | "STANDUP_POUCH"
   *  - capsuleCount: 30 | 60 (optional, for one-time purchases)
   *  - couponCode: string (optional)
   *
   * Response: Complete pricing breakdown with all discounts
   */
  static async getEnhancedPricing(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const { planDurationDays, planType, capsuleCount, couponCode } = req.body;

      // Validate required fields
      if (!planDurationDays || !planType) {
        throw new AppError("planDurationDays and planType are required", 400);
      }

      if (![30, 60, 90, 180].includes(planDurationDays)) {
        throw new AppError("planDurationDays must be 30, 60, 90, or 180", 400);
      }

      if (!["SACHET", "STANDUP_POUCH"].includes(planType)) {
        throw new AppError("planType must be SACHET or STANDUP_POUCH", 400);
      }

      if (capsuleCount !== undefined && ![30, 60].includes(capsuleCount)) {
        throw new AppError("capsuleCount must be 30 or 60", 400);
      }

      const result = await checkoutService.getEnhancedPlanPricing(userId, {
        planDurationDays,
        planType,
        capsuleCount,
        couponCode,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get comprehensive checkout page summary
   * @route GET /api/v1/checkout/page-summary
   * @access Private
   *
   * Query parameters:
   *  - planDurationDays: 30 | 60 | 90 | 180 (optional, defaults to 180)
   *  - variantType: "SACHETS" | "STAND_UP_POUCH" (optional, defaults to "SACHETS")
   *  - capsuleCount: 30 | 60 (optional, for STAND_UP_POUCH variant)
   *
   * Response includes:
   *  - Product list added to cart (with selected plan price and membership discount)
   *  - Subscription plans listing
   *  - Total amount, discounted price, discount amount, save percentage
   *  - Supplements count, per month amount
   *  - Suggested products list (3-5)
   */
  static async getCheckoutPageSummary(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const findCart = await Carts.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }).lean();

      if (!findCart) {
        throw new AppError("Cart not found", 404);
      }

      if (!findCart.items || findCart.items.length === 0) {
        throw new AppError("Cart is empty", 400);
      }

      // Extract body parameters (with defaults applied by Joi validation)
      const {
        planDurationDays = 180,
        variantType = "SACHETS",
        capsuleCount,
        couponCode,
        isOneTime,
        shippingAddressId,
        billingAddressId,
      } = req.body;

      // Validate variant type only if cart has a variantType set
      // If cart variantType is null/undefined, allow the request to proceed
      if (
        findCart.variantType &&
        variantType &&
        findCart.variantType !== variantType
      ) {
        throw new AppError(
          "Cart variant type does not match the request variant type",
          400
        );
      }

      const result = await checkoutService.getCheckoutPageSummary(userId, {
        planDurationDays: planDurationDays as 30 | 60 | 90 | 180,
        variantType: variantType as "SACHETS" | "STAND_UP_POUCH",
        capsuleCount: capsuleCount as 30 | 60 | undefined,
        couponCode: couponCode || undefined,
        isOneTime: isOneTime || false,
        shippingAddressId: shippingAddressId || null,
        billingAddressId: billingAddressId || null,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export { CheckoutController };
