import { type ICart, Carts } from "../models/commerce/carts.model";
import { Products } from "../models/commerce/products.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { Wishlists } from "../models/commerce/wishlists.model";
import { Reviews } from "../models/cms/reviews.model";
import { Coupons } from "../models/commerce/coupons.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import mongoose from "mongoose";
import { ProductVariant, ReviewStatus } from "../models/enums";
import { CouponType } from "../models/enums";
import { DEFAULT_LANGUAGE, SupportedLanguage } from "../models/common.model";
import { fetchAndEnrichProducts } from "./productEnrichmentService";
import {
  getStandUpPouchPlanKey,
  getNormalizedStandupPouchPrice,
  DEFAULT_STAND_UP_POUCH_PLAN,
} from "../config/planConfig";

interface AddCartItemData {
  productId: string;
  variantType: ProductVariant; // Required: SACHETS or STAND_UP_POUCH
  quantity?: number; // Quantity for STAND_UP_POUCH (default: 1, always 1 for SACHETS)
  isOneTime?: boolean; // Whether this is a one-time purchase (only for STAND_UP_POUCH, must be true)
  planDays?: number; // For STAND_UP_POUCH only: treated as capsuleCount (60 or 120). NOT used for SACHETS.
  isSubscriptionChange?: boolean; // Optional flag: item added as part of subscription-change flow
}

interface UpdateCartItemData {
  productId: string;
  variantType: ProductVariant; // Required: SACHETS or STAND_UP_POUCH
  quantity?: number; // Quantity for STAND_UP_POUCH (default: 1, always 1 for SACHETS)
  isOneTime?: boolean; // Whether this is a one-time purchase (only for STAND_UP_POUCH, must be true)
  planDays?: number; // For STAND_UP_POUCH only: treated as capsuleCount (60 or 120). NOT used for SACHETS.
  isSubscriptionChange?: boolean; // Optional flag: item updated as part of subscription-change flow
}

interface RemoveCartItemData {
  productId: string;
}

interface CartItemWithDetails {
  productId: mongoose.Types.ObjectId;
  price: {
    currency: string;
    amount: number;
    taxRate: number;
  };
  addedAt: Date;
  variantType: ProductVariant;
  product?: any;
  variant?: any;
}

class CartService {
  private readonly LOW_STOCK_THRESHOLD = 10; // Warn if stock < 10

  /**
   * Calculate cart totals based on item-level variantType pricing
   * Returns numbers for all price fields and currency separately
   */
  private async calculateCartTotalsWithVariantType(
    items: any[],
    variantType: ProductVariant, // Kept for backward compatibility, but now uses item-level variantType
    couponDiscountAmount: number = 0
  ): Promise<{
    subtotal: number; // Sum of all product amounts
    tax: number; // Sum of all taxRate values (converted to amount)
    discount: number; // Sum of (amount - discountedPrice) for all products
    total: number; // subtotal + tax - discount - couponDiscountAmount
    currency: string;
  }> {
    if (items.length === 0) {
      return {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        currency: "EUR",
      };
    }

    // Fetch all products to get pricing information
    const productIds = items.map((item: any) => item.productId);
    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
      status: true,
    }).lean();

    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    // Calculate subtotal, tax, and discount based on item-level variantType
    let subtotalAmount = 0;
    let totalTaxAmount = 0;
    let totalDiscount = 0; // Sum of (amount - discountedPrice) for all products
    const currency = "EUR";

    items.forEach((item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) return;

      // Use item-level variantType if available, otherwise fallback to cart-level variantType
      const itemVariantType = item.variantType || variantType;
      const itemQuantity = item.quantity || 1; // Default to 1 if not specified

      let originalAmount = 0;
      let discountedPrice = 0;
      let taxRate = 0;

      if (itemVariantType === ProductVariant.SACHETS && product.sachetPrices) {
        // SACHETS: Always use 30 days plan TOTAL amount as base for all calculations
        const thirtyDaysPlan = product.sachetPrices.thirtyDays;
        if (thirtyDaysPlan) {
          const baseTotalAmount = thirtyDaysPlan.totalAmount ?? thirtyDaysPlan.amount ?? 0;
          originalAmount = baseTotalAmount;
          // All discount calculations should also be based on totalAmount
          discountedPrice = baseTotalAmount;
          taxRate = thirtyDaysPlan.taxRate || 0;
        } else {
          // Fallback to item price if plan not found
          originalAmount = item.price?.amount || 0;
          discountedPrice = item.price?.amount || 0;
          taxRate = item.price?.taxRate || 0;
        }
      } else if (
        itemVariantType === ProductVariant.STAND_UP_POUCH &&
        product.standupPouchPrice
      ) {
        const standupPrice = getNormalizedStandupPouchPrice(
          product.standupPouchPrice
        );
        const itemPlanDays = item.planDays || DEFAULT_STAND_UP_POUCH_PLAN;

        // Prefer matching by capsuleCount === planDays inside count_0 / count_1
        const allCounts = [
          standupPrice.count_0,
          standupPrice.count_1,
        ].filter(Boolean);

        let selectedCount =
          allCounts.find(
            (c: any) => typeof c?.capsuleCount === "number" && c.capsuleCount === itemPlanDays
          ) || null;

        if (!selectedCount) {
          const countKey = getStandUpPouchPlanKey(itemPlanDays);
          selectedCount =
            (countKey && standupPrice[countKey]) ||
            standupPrice.count_0 ||
            standupPrice.count_1 ||
            standupPrice;
        }

        if (selectedCount) {
          const baseTotalAmount =
            selectedCount.totalAmount ?? selectedCount.amount ?? 0;
          originalAmount = baseTotalAmount;
          // All discount calculations should also be based on totalAmount
          discountedPrice = baseTotalAmount;
          taxRate = selectedCount.taxRate || 0;
        } else if (standupPrice.amount || standupPrice.totalAmount) {
          const baseTotalAmount = standupPrice.totalAmount ?? standupPrice.amount ?? 0;
          originalAmount = baseTotalAmount;
          discountedPrice = baseTotalAmount;
          taxRate = standupPrice.taxRate || 0;
        }
      } else {
        // Fallback to item price
        originalAmount = item.price?.amount || 0;
        discountedPrice = item.price?.amount || 0;
        taxRate = item.price?.taxRate || 0;
      }

      // Multiply by quantity for total amounts
      subtotalAmount += originalAmount * itemQuantity;
      totalTaxAmount += taxRate * itemQuantity; // taxRate is already an amount, not percentage
      // Calculate discount as difference: amount - discountedPrice
      const itemDiscount = (originalAmount - discountedPrice) * itemQuantity;
      totalDiscount += itemDiscount;
    });

    // Round all amounts to 2 decimal places
    subtotalAmount = Math.round(subtotalAmount * 100) / 100;
    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    couponDiscountAmount = Math.round(couponDiscountAmount * 100) / 100;

    // Calculate total: subtotal + tax - discount - couponDiscountAmount
    // Note: discount is the sum of (amount - discountedPrice) differences
    const total =
      Math.round(
        (subtotalAmount +
          totalTaxAmount -
          totalDiscount -
          couponDiscountAmount) *
          100
      ) / 100;

    return {
      subtotal: subtotalAmount,
      tax: totalTaxAmount,
      discount: totalDiscount, // Sum of (amount - discountedPrice) for all products
      total: Math.max(0, total), // Ensure total is not negative
      currency,
    };
  }

  /**
   * Calculate cart totals
   */
  private calculateCartTotals(
    items: CartItemWithDetails[],
    shippingAmount: number = 0,
    discountAmount: number = 0
  ): {
    subtotal: { currency: string; amount: number; taxRate: number };
    tax: { currency: string; amount: number; taxRate: number };
    shipping: { currency: string; amount: number; taxRate: number };
    discount: { currency: string; amount: number; taxRate: number };
    total: { currency: string; amount: number; taxRate: number };
  } {
    if (items.length === 0) {
      return {
        subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
        tax: { currency: "EUR", amount: 0, taxRate: 0 },
        shipping: { currency: "EUR", amount: 0, taxRate: 0 },
        discount: { currency: "EUR", amount: 0, taxRate: 0 },
        total: { currency: "EUR", amount: 0, taxRate: 0 },
      };
    }

    // Use currency from first item (assuming all items have same currency)
    const currency = items[0].price.currency;

    let subtotalAmount = 0;
    let totalTaxAmount = 0;

    items.forEach((item) => {
      subtotalAmount += item.price.amount;
      // Tax rate is now a direct amount (not percentage), so add it directly
      totalTaxAmount += item.price.taxRate || 0;
    });

    const taxAmount = totalTaxAmount;
    const totalAmount =
      subtotalAmount + taxAmount + shippingAmount - discountAmount;

    // Since taxRate is now a direct amount (not percentage), we use 0 as taxRate in totals
    // The actual tax amount is stored in tax.amount
    return {
      subtotal: {
        currency,
        amount: Math.round(subtotalAmount * 100) / 100,
        taxRate: 0,
      },
      tax: { currency, amount: Math.round(taxAmount * 100) / 100, taxRate: 0 },
      shipping: {
        currency,
        amount: Math.round(shippingAmount * 100) / 100,
        taxRate: 0,
      },
      discount: {
        currency,
        amount: Math.round(discountAmount * 100) / 100,
        taxRate: 0,
      },
      total: {
        currency,
        amount: Math.round(totalAmount * 100) / 100,
        taxRate: 0,
      },
    };
  }

  /**
   * Get or create cart for user
   */
  private async getOrCreateCart(userId: string): Promise<any> {
    let cart: any = await Carts.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    }).lean();

    if (!cart) {
      const newCart = await Carts.create({
        userId: new mongoose.Types.ObjectId(userId),
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 0,
        discount: 0,
        total: 0,
        currency: "EUR",
        couponDiscountAmount: 0,
      });
      cart = newCart.toObject();
    }

    return cart;
  }

  /**
   * Validate product and get pricing
   */
  private async validateAndGetPricing(productId: string): Promise<{
    product: any;
    price: { currency: string; amount: number; taxRate: number };
  }> {
    // Validate product exists and is active
    const product = await Products.findOne({
      _id: new mongoose.Types.ObjectId(productId),
      isDeleted: false,
      status: true, // true = Active, false = Inactive
    }).lean();

    if (!product) {
      throw new AppError("Product not found or not available", 404);
    }

    const price = product.price;

    return {
      product,
      price,
    };
  }

  /**
   * Get user's cart
   */
  async getCart(
    userId: string,
    includeSuggested: boolean = true,
    userLang: SupportedLanguage = DEFAULT_LANGUAGE
  ): Promise<{ cart: any; suggestedProducts?: any[] }> {
    const cart = await this.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      const result: {
        cart: any;
        suggestedProducts?: any[];
      } = {
        cart: {
          ...cart,
          items: [],
        },
      };

      if (includeSuggested) {
        const suggestedProducts = await this.getSuggestedProducts(
          userId,
          10,
          userLang
        );
        result.suggestedProducts = suggestedProducts;
      }

      return result;
    }

    // Get product IDs
    const productIds = cart.items.map((item: any) => item.productId);

    // Get user's wishlist product IDs for is_liked field
    let wishlistProductIds: Set<string> = new Set();
    try {
      const wishlistItems = await Wishlists.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("productId")
        .lean();
      wishlistProductIds = new Set(
        wishlistItems.map((item: any) => item.productId.toString())
      );
    } catch (error) {
      // If wishlist fetch fails, continue without wishlist data
      logger.warn("Failed to fetch wishlist for cart", error);
    }

    // Fetch and enrich products using common service
    const enrichedProducts = await fetchAndEnrichProducts(
      productIds.map((id: any) => new mongoose.Types.ObjectId(id)),
      {
        userId,
        userLang,
        wishlistProductIds,
      }
    );

    // Create maps for quick lookup
    const productMap = new Map(
      enrichedProducts.map((p: any) => [p._id.toString(), p])
    );

    // Build items with full product details and calculate prices based on item-level variantType
    const itemsWithDetails = (cart.items || []).map((item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        return {
          ...item,
          product: null,
        };
      }

      // Use item-level variantType, fallback to SACHETS if not present
      const itemVariantType = item.variantType || ProductVariant.SACHETS;
      const itemQuantity = item.quantity || 1; // Get quantity from cart item

      // Calculate price based on item-level variantType
      let originalAmount = 0;
      let discountedPrice = 0;
      let currency = "EUR";
      let taxRate = 0;

      if (itemVariantType === ProductVariant.SACHETS && product.sachetPrices) {
        // SACHETS: Always use 30 days plan TOTAL amount as base for all calculations
        const thirtyDaysPlan = product.sachetPrices.thirtyDays;
        if (thirtyDaysPlan) {
          const baseTotalAmount = thirtyDaysPlan.totalAmount ?? thirtyDaysPlan.amount ?? 0;
          currency = thirtyDaysPlan.currency || "EUR";
          taxRate = thirtyDaysPlan.taxRate || 0;
          originalAmount = baseTotalAmount;
          discountedPrice = baseTotalAmount;
        }
      } else if (
        itemVariantType === ProductVariant.STAND_UP_POUCH &&
        product.standupPouchPrice
      ) {
        const standupPrice = getNormalizedStandupPouchPrice(
          product.standupPouchPrice
        );
        const itemPlanDays = item.planDays || DEFAULT_STAND_UP_POUCH_PLAN;

        // Prefer matching by capsuleCount === planDays inside count_0 / count_1
        const allCounts = [
          standupPrice.count_0,
          standupPrice.count_1,
        ].filter(Boolean);

        let selectedCount =
          allCounts.find(
            (c: any) => typeof c?.capsuleCount === "number" && c.capsuleCount === itemPlanDays
          ) || null;

        if (!selectedCount) {
          const countKey = getStandUpPouchPlanKey(itemPlanDays);
          selectedCount =
            (countKey && standupPrice[countKey]) ||
            standupPrice.count_0 ||
            standupPrice.count_1 ||
            standupPrice;
        }

        if (selectedCount) {
          const baseTotalAmount =
            selectedCount.totalAmount ?? selectedCount.amount ?? 0;
          currency = selectedCount.currency || "EUR";
          taxRate = selectedCount.taxRate || 0;
          originalAmount = baseTotalAmount;
          discountedPrice = baseTotalAmount;
        } else if (standupPrice.amount || standupPrice.totalAmount) {
          const baseTotalAmount = standupPrice.totalAmount ?? standupPrice.amount ?? 0;
          currency = standupPrice.currency || "EUR";
          taxRate = standupPrice.taxRate || 0;
          originalAmount = baseTotalAmount;
          discountedPrice = baseTotalAmount;
        }
      } else {
        // Fallback to item price if no variantType match
        currency = item.price?.currency || "EUR";
        taxRate = item.price?.taxRate || 0;
        originalAmount = item.price?.amount || 0;
        discountedPrice = item.price?.amount || 0;
      }

      // Calculate unit price and total price (unit * quantity)
      const unitPrice = discountedPrice;
      const totalPrice = unitPrice * itemQuantity;
      const unitTaxRate = taxRate;
      const totalTaxRate = unitTaxRate * itemQuantity;

      const calculatedPrice = {
        currency,
        amount: unitPrice, // Unit price (per item)
        taxRate: unitTaxRate, // Unit tax rate
        totalAmount: totalPrice, // Total price (unit * quantity)
        totalTaxRate: totalTaxRate, // Total tax (unit tax * quantity)
      };

      // Add isInCart: true and variants array since this product is in the cart
      let productWithCartFlag = null;
      if (product) {
        // Add variants array based on hasStandupPouch
        const variantsArray =
          product.hasStandupPouch === true
            ? ["sachets", "stand_up_pouch"]
            : ["sachets"];

        // Remove existing variants if any and add fresh array
        const { variants: _, ...productWithoutVariants } = product;
        productWithCartFlag = {
          ...productWithoutVariants,
          variants: variantsArray,
          isInCart: true,
        };
      }

      // Build item object
      return {
        productId: item.productId,
        price: calculatedPrice, // Update with calculated price (includes unit and total)
        quantity: itemQuantity, // Include quantity in response
        totalAmount: item.totalAmount || totalPrice, // Include totalAmount from cart or calculated
        addedAt: item.addedAt,
        planDays: item.planDays || null,
        isOneTime: item.isOneTime || false,
        variantType: item.variantType,
        isSubscriptionChange: item.isSubscriptionChange || false,
        _id: item._id,
        product: productWithCartFlag, // Already enriched with full details from common service
      };
    });

    const result: {
      cart: any;
      suggestedProducts?: any[];
    } = {
      cart: {
        ...cart,
        items: itemsWithDetails,
      },
    };

    // Include suggested products if requested
    if (includeSuggested) {
      const suggestedProducts = await this.getSuggestedProducts(
        userId,
        10,
        userLang
      );
      result.suggestedProducts = suggestedProducts;
    }

    return result;
  }

  /**
   * Check if a product is in user's cart
   * Returns true if product exists in cart
   */
  async isProductInCart(userId: string, productId: string): Promise<boolean> {
    try {
      const cart = await this.getOrCreateCart(userId);
      if (!cart.items || cart.items.length === 0) {
        return false;
      }

      const productObjectId = productId.toString();

      const itemExists = cart.items.some(
        (item: any) => item.productId.toString() === productObjectId
      );

      return itemExists;
    } catch (error) {
      // If error occurs, return false (product not in cart)
      logger.error(`Error checking if product ${productId} is in cart:`, error);
      return false;
    }
  }

  /**
   * Get cart product IDs for a user (helper for batch checking)
   * Returns a Set of product IDs that are in the user's cart
   */
  async getCartProductIds(userId: string): Promise<Set<string>> {
    try {
      const cart = await this.getOrCreateCart(userId);
      if (!cart.items || cart.items.length === 0) {
        return new Set();
      }

      return new Set(cart.items.map((item: any) => item.productId.toString()));
    } catch (error) {
      logger.error(`Error getting cart product IDs for user ${userId}:`, error);
      return new Set();
    }
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string,
    data: AddCartItemData
  ): Promise<{ cart: any; message: string }> {
    const {
      productId,
      variantType,
      quantity,
      isOneTime,
      planDays,
      isSubscriptionChange,
    } = data;

    // Validate variant-specific rules
    if (variantType === ProductVariant.SACHETS) {
      // SACHETS: quantity must NOT be provided by client
      if (quantity !== undefined) {
        throw new AppError(
          "quantity is not allowed for SACHETS products",
          400
        );
      }
      // SACHETS: isOneTime is NOT allowed (only subscription plans)
      if (isOneTime !== undefined) {
        throw new AppError(
          "isOneTime is not allowed for SACHETS products (only subscription plans are supported)",
          400
        );
      }
      // SACHETS: planDays is NOT allowed (planDays is only for STAND_UP_POUCH)
      if (planDays !== undefined) {
        throw new AppError(
          "planDays is not allowed for SACHETS products (planDays is only for STAND_UP_POUCH)",
          400
        );
      }
    } else if (variantType === ProductVariant.STAND_UP_POUCH) {
      // STAND_UP_POUCH: Always one-time, quantity required (min 1)
      const qty = quantity || 1;
      if (qty < 1) {
        throw new AppError(
          "STAND_UP_POUCH products require a quantity of at least 1",
          400
        );
      }
      // STAND_UP_POUCH is always one-time, isOneTime is optional (but must be true if provided)
      if (isOneTime !== undefined && isOneTime !== true) {
        throw new AppError(
          "STAND_UP_POUCH is always one-time purchase, isOneTime must be true if provided",
          400
        );
      }
      // planDays is optional for STAND_UP_POUCH (treated as capsuleCount: 60 or 120)
      if (planDays !== undefined && planDays !== 60 && planDays !== 120) {
        throw new AppError(
          "For STAND_UP_POUCH, planDays (capsuleCount) must be 60 or 120 if provided",
          400
        );
      }
    }

    // Validate and get pricing
    const { product, price } = await this.validateAndGetPricing(productId);

    // Validate product supports the requested variant
    if (variantType === ProductVariant.SACHETS && !product.sachetPrices) {
      throw new AppError(
        "This product does not support SACHETS variant",
        400
      );
    }
    if (
      variantType === ProductVariant.STAND_UP_POUCH &&
      !product.hasStandupPouch &&
      !product.standupPouchPrice
    ) {
      throw new AppError(
        "This product does not support STAND_UP_POUCH variant",
        400
      );
    }

    const cart = await this.getOrCreateCart(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Check if item already exists in cart with same variantType
    // For both STAND_UP_POUCH and SACHETS: productId + variantType must match
    // planDays is NOT part of uniqueness - same product with different planDays will update existing item
    const existingItemIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        item.variantType === variantType
    );

    let updatedItems = [...(cart.items || [])];
    const finalQuantity =
      variantType === ProductVariant.SACHETS ? 1 : quantity || 1;

    // Calculate price based on variantType, isOneTime, and planDays
    let calculatedPrice = price; // Default to validated price
    let currency = "EUR";
    let taxRate = 0;

    if (variantType === ProductVariant.SACHETS && product.sachetPrices) {
      // SACHETS: Always use 30 days plan TOTAL amount as unit price
      const thirtyDaysPlan = product.sachetPrices.thirtyDays;
      if (thirtyDaysPlan) {
        const baseTotalAmount = thirtyDaysPlan.totalAmount ?? thirtyDaysPlan.amount ?? 0;
        currency = thirtyDaysPlan.currency || "EUR";
        taxRate = thirtyDaysPlan.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      }
    } else if (
      variantType === ProductVariant.STAND_UP_POUCH &&
      product.standupPouchPrice
    ) {
      const standupPrice = getNormalizedStandupPouchPrice(
        product.standupPouchPrice
      );
      const effectivePlanDays = planDays || DEFAULT_STAND_UP_POUCH_PLAN;

      // Prefer matching by capsuleCount === planDays inside count_0 / count_1
      const allCounts = [
        standupPrice.count_0,
        standupPrice.count_1,
      ].filter(Boolean);

      let selectedCount =
        allCounts.find(
          (c: any) =>
            typeof c?.capsuleCount === "number" &&
            c.capsuleCount === effectivePlanDays
        ) || null;

      if (!selectedCount) {
        const countKey = getStandUpPouchPlanKey(effectivePlanDays);
        selectedCount =
          (countKey && standupPrice[countKey]) ||
          standupPrice.count_0 ||
          standupPrice.count_1 ||
          standupPrice;
      }

      if (selectedCount) {
        const baseTotalAmount =
          selectedCount.totalAmount ?? selectedCount.amount ?? 0;
        currency = selectedCount.currency || "EUR";
        taxRate = selectedCount.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      } else if (standupPrice.amount || standupPrice.totalAmount) {
        const baseTotalAmount =
          standupPrice.totalAmount ?? standupPrice.amount ?? 0;
        currency = standupPrice.currency || "EUR";
        taxRate = standupPrice.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      }
    }

    // Calculate totalAmount (unit price * quantity) for STAND_UP_POUCH
    const totalAmount =
      variantType === ProductVariant.STAND_UP_POUCH
        ? (calculatedPrice.amount || 0) * finalQuantity
        : calculatedPrice.amount || 0; // For SACHETS, totalAmount = unit price (quantity always 1)

    if (existingItemIndex >= 0) {
      // Item already exists with same variantType, isOneTime, and planDays
      if (variantType === ProductVariant.STAND_UP_POUCH) {
        // Preserve existing planDays if new planDays is not provided, otherwise use new planDays (default to 30)
        const finalPlanDays = planDays !== undefined ? planDays : (updatedItems[existingItemIndex].planDays ?? 30);
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: finalQuantity,
          isOneTime: true, // STAND_UP_POUCH is always one-time
          planDays: finalPlanDays, // Explicitly set planDays (number or null)
          price: calculatedPrice, // Update with calculated price
          totalAmount: totalAmount, // Store totalAmount (unit price * quantity)
          isSubscriptionChange:
            isSubscriptionChange ??
            updatedItems[existingItemIndex].isSubscriptionChange ??
            false,
        };
      } else {
        // SACHETS: Update price and planDays (quantity always 1, no isOneTime)
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          isOneTime: undefined, // SACHETS don't have isOneTime
          planDays: undefined, // SACHETS don't use planDays
          price: calculatedPrice, // Update with calculated price
          totalAmount: totalAmount, // Store totalAmount (same as unit price for SACHETS)
          isSubscriptionChange:
            isSubscriptionChange ??
            updatedItems[existingItemIndex].isSubscriptionChange ??
            false,
        };
      }
    } else {
      // Add new item with calculated price, variantType, quantity, isOneTime (only for STAND_UP_POUCH), planDays (only for STAND_UP_POUCH, treated as capsuleCount), and totalAmount
      const itemPlanDays = variantType === ProductVariant.STAND_UP_POUCH 
        ? (planDays !== undefined ? planDays : DEFAULT_STAND_UP_POUCH_PLAN) // Default to 60 if not provided (treated as capsuleCount)
        : undefined; // SACHETS don't use planDays
      updatedItems.push({
        productId: productObjectId,
        variantType: variantType, // Store variantType in item
        quantity: finalQuantity, // Store quantity (1 for SACHETS, user-provided for STAND_UP_POUCH)
        isOneTime: variantType === ProductVariant.STAND_UP_POUCH ? (isOneTime ?? true) : undefined,
        planDays: itemPlanDays, // For STAND_UP_POUCH: planDays is treated as capsuleCount (60 or 120). For SACHETS: undefined.
        price: calculatedPrice,
        totalAmount: totalAmount, // Store totalAmount (unit price * quantity)
        isSubscriptionChange: !!isSubscriptionChange,
        addedAt: new Date(),
      });
    }

    // Calculate totals first without coupon to get order amount
    // Use first item's variantType for backward compatibility (method uses item-level variantType anyway)
    const firstItemVariantType = updatedItems.length > 0 && updatedItems[0].variantType 
      ? updatedItems[0].variantType 
      : variantType;
    const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      firstItemVariantType,
      0 // Calculate without coupon first
    );

    // Recalculate coupon discount if coupon code exists
    let couponDiscountAmount = 0;
    if (cart.couponCode && updatedItems.length > 0) {
      try {
        const coupon = await Coupons.findOne({
          code: cart.couponCode,
          isDeleted: false,
          isActive: true,
        }).lean();

        if (coupon) {
          const now = new Date();
          const isValidDate =
            (!coupon.validFrom || now >= coupon.validFrom) &&
            (!coupon.validUntil || now <= coupon.validUntil);

          if (isValidDate) {
            const orderAmount = totalsWithoutCoupon.discount; // Use discounted price as base

            if (
              !coupon.minOrderAmount ||
              orderAmount >= coupon.minOrderAmount
            ) {
              if (coupon.type === CouponType.PERCENTAGE) {
                couponDiscountAmount = (orderAmount * coupon.value) / 100;
                if (coupon.maxDiscountAmount) {
                  couponDiscountAmount = Math.min(
                    couponDiscountAmount,
                    coupon.maxDiscountAmount
                  );
                }
              } else if (coupon.type === CouponType.FIXED) {
                couponDiscountAmount = Math.min(coupon.value, orderAmount);
              }
              couponDiscountAmount = Math.min(
                couponDiscountAmount,
                orderAmount
              );
              couponDiscountAmount =
                Math.round(couponDiscountAmount * 100) / 100;
            }
          }
        }
      } catch (error) {
        // If coupon validation fails, set discount to 0
        logger.warn(`Failed to recalculate coupon discount: ${error}`);
        couponDiscountAmount = 0;
      }
    }

    // Calculate final totals with coupon discount
    const totals = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      firstItemVariantType,
      couponDiscountAmount
    );

    // Update cart with calculated values (all as numbers)
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        currency: totals.currency,
        couponDiscountAmount: couponDiscountAmount,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(`Item added to cart for user ${userId}`);

    return {
      cart: updatedCart,
      message:
        existingItemIndex >= 0 ? "Cart item updated" : "Item added to cart",
    };
  }

  /**
   * Update cart item by productId (updates price if changed)
   */
  async updateItem(
    userId: string,
    data: UpdateCartItemData
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    const {
      productId,
      variantType,
      quantity,
      isOneTime,
      planDays,
      isSubscriptionChange,
    } = data;

    // Validate variant-specific rules
    if (variantType === ProductVariant.SACHETS) {
      // SACHETS: quantity must NOT be provided by client
      if (quantity !== undefined) {
        throw new AppError(
          "quantity is not allowed for SACHETS products",
          400
        );
      }
      // SACHETS: isOneTime is NOT allowed (only subscription plans)
      if (isOneTime !== undefined) {
        throw new AppError(
          "isOneTime is not allowed for SACHETS products (only subscription plans are supported)",
          400
        );
      }
      // SACHETS: planDays is NOT allowed (planDays is only for STAND_UP_POUCH)
      if (planDays !== undefined) {
        throw new AppError(
          "planDays is not allowed for SACHETS products (planDays is only for STAND_UP_POUCH)",
          400
        );
      }
    } else if (variantType === ProductVariant.STAND_UP_POUCH) {
      // STAND_UP_POUCH: Always one-time, quantity required (min 1)
      const qty = quantity || 1;
      if (qty < 1) {
        throw new AppError(
          "STAND_UP_POUCH products require a quantity of at least 1",
          400
        );
      }
      // STAND_UP_POUCH is always one-time, isOneTime is optional (but must be true if provided)
      if (isOneTime !== undefined && isOneTime !== true) {
        throw new AppError(
          "STAND_UP_POUCH is always one-time purchase, isOneTime must be true if provided",
          400
        );
      }
      // planDays is optional for STAND_UP_POUCH (treated as capsuleCount: 60 or 120)
      if (planDays !== undefined && planDays !== 60 && planDays !== 120) {
        throw new AppError(
          "For STAND_UP_POUCH, planDays (capsuleCount) must be 60 or 120 if provided",
          400
        );
      }
    }

    // Find the item in cart by productId and variantType
    const itemIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        item.variantType === variantType
    );

    if (itemIndex === -1) {
      throw new AppError("Cart item not found", 404);
    }

    const item = cart.items[itemIndex];
    const finalQuantity =
      variantType === ProductVariant.SACHETS ? 1 : quantity || item.quantity || 1;
    
    // Use existing or new values for isOneTime (only for STAND_UP_POUCH) and planDays (only for STAND_UP_POUCH)
    const finalIsOneTime = variantType === ProductVariant.STAND_UP_POUCH 
      ? (isOneTime !== undefined ? isOneTime : (item.isOneTime ?? true))
      : undefined;
    const finalPlanDays = variantType === ProductVariant.STAND_UP_POUCH
      ? (planDays !== undefined ? planDays : (item.planDays ?? 30)) // Default to 30 if not provided
      : undefined;

    // Validate and get updated pricing
    const { product, price } = await this.validateAndGetPricing(productId);

    // Calculate price based on variantType, isOneTime (for STAND_UP_POUCH), and planDays (for STAND_UP_POUCH)
    let calculatedPrice = price; // Default to validated price
    let currency = "EUR";
    let taxRate = 0;

    if (variantType === ProductVariant.SACHETS && product.sachetPrices) {
      // SACHETS: Always use 30 days plan TOTAL amount as unit price
      const thirtyDaysPlan = product.sachetPrices.thirtyDays;
      if (thirtyDaysPlan) {
        const baseTotalAmount = thirtyDaysPlan.totalAmount ?? thirtyDaysPlan.amount ?? 0;
        currency = thirtyDaysPlan.currency || "EUR";
        taxRate = thirtyDaysPlan.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      }
    } else if (
      variantType === ProductVariant.STAND_UP_POUCH &&
      product.standupPouchPrice
    ) {
      const standupPrice = getNormalizedStandupPouchPrice(
        product.standupPouchPrice
      );
      const effectivePlanDays = finalPlanDays || DEFAULT_STAND_UP_POUCH_PLAN;

      // Prefer matching by capsuleCount === planDays inside count_0 / count_1
      const allCounts = [
        standupPrice.count_0,
        standupPrice.count_1,
      ].filter(Boolean);

      let selectedCount =
        allCounts.find(
          (c: any) =>
            typeof c?.capsuleCount === "number" &&
            c.capsuleCount === effectivePlanDays
        ) || null;

      if (!selectedCount) {
        const countKey = getStandUpPouchPlanKey(effectivePlanDays);
        selectedCount =
          (countKey && standupPrice[countKey]) ||
          standupPrice.count_0 ||
          standupPrice.count_1 ||
          standupPrice;
      }

      if (selectedCount) {
        const baseTotalAmount =
          selectedCount.totalAmount ?? selectedCount.amount ?? 0;
        currency = selectedCount.currency || "EUR";
        taxRate = selectedCount.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      } else if (standupPrice.amount || standupPrice.totalAmount) {
        const baseTotalAmount =
          standupPrice.totalAmount ?? standupPrice.amount ?? 0;
        currency = standupPrice.currency || "EUR";
        taxRate = standupPrice.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: baseTotalAmount,
          taxRate,
        };
      }
    }

    // Calculate totalAmount
    const totalAmount =
      variantType === ProductVariant.STAND_UP_POUCH
        ? (calculatedPrice.amount || 0) * finalQuantity
        : calculatedPrice.amount || 0;

    // Update item price, variantType, quantity, isOneTime (only for STAND_UP_POUCH), and planDays (only for STAND_UP_POUCH)
    const updatedItems = [...(cart.items || [])];
    const itemPlanDays = variantType === ProductVariant.STAND_UP_POUCH 
      ? (finalPlanDays !== undefined ? finalPlanDays : (item.planDays ?? 30)) // Default to 30 if not provided
      : undefined;
    updatedItems[itemIndex] = {
      ...item,
      variantType: variantType, // Update variantType
      quantity: finalQuantity, // Update quantity
      isOneTime: variantType === ProductVariant.STAND_UP_POUCH ? (finalIsOneTime ?? true) : undefined,
      planDays: itemPlanDays, // Explicitly set planDays for STAND_UP_POUCH (number or null)
      price: calculatedPrice, // Update with calculated price based on variantType and planDays (for STAND_UP_POUCH)
      totalAmount: totalAmount,
      isSubscriptionChange:
        isSubscriptionChange ?? item.isSubscriptionChange ?? false,
    };

    // Calculate totals first without coupon to get order amount
    // Use item's variantType (method uses item-level variantType anyway)
    const itemVariantType = variantType;
    const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      itemVariantType,
      0 // Calculate without coupon first
    );

    // Recalculate coupon discount if coupon code exists
    let couponDiscountAmount = 0;
    if (cart.couponCode && updatedItems.length > 0) {
      try {
        const coupon = await Coupons.findOne({
          code: cart.couponCode,
          isDeleted: false,
          isActive: true,
        }).lean();

        if (coupon) {
          const now = new Date();
          const isValidDate =
            (!coupon.validFrom || now >= coupon.validFrom) &&
            (!coupon.validUntil || now <= coupon.validUntil);

          if (isValidDate) {
            const orderAmount = totalsWithoutCoupon.discount; // Use discounted price as base

            if (
              !coupon.minOrderAmount ||
              orderAmount >= coupon.minOrderAmount
            ) {
              if (coupon.type === CouponType.PERCENTAGE) {
                couponDiscountAmount = (orderAmount * coupon.value) / 100;
                if (coupon.maxDiscountAmount) {
                  couponDiscountAmount = Math.min(
                    couponDiscountAmount,
                    coupon.maxDiscountAmount
                  );
                }
              } else if (coupon.type === CouponType.FIXED) {
                couponDiscountAmount = Math.min(coupon.value, orderAmount);
              }
              couponDiscountAmount = Math.min(
                couponDiscountAmount,
                orderAmount
              );
              couponDiscountAmount =
                Math.round(couponDiscountAmount * 100) / 100;
            }
          }
        }
      } catch (error) {
        // If coupon validation fails, set discount to 0
        logger.warn(`Failed to recalculate coupon discount: ${error}`);
        couponDiscountAmount = 0;
      }
    }

    // Calculate final totals with coupon discount
    const totals = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      itemVariantType,
      couponDiscountAmount
    );

    // Update cart with calculated values (all as numbers)
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        currency: totals.currency,
        couponDiscountAmount: couponDiscountAmount,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(
      `Cart item updated for user ${userId} (productId: ${productId})`
    );

    return {
      cart: updatedCart,
      message: "Cart item updated successfully",
    };
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    userId: string,
    data: RemoveCartItemData
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    const { productId } = data;

    // Find the item in cart by productId
    const itemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      throw new AppError("Cart item not found", 404);
    }

    // Remove the item
    const updatedItems = [...(cart.items || [])];
    updatedItems.splice(itemIndex, 1);

    // Calculate totals first without coupon to get order amount
    let totals;
    let couponDiscountAmount = 0;

    if (updatedItems.length === 0) {
      totals = {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        currency: "EUR",
      };
    } else {
      // Use first item's variantType for backward compatibility (method uses item-level variantType anyway)
      const firstItemVariantType = updatedItems.length > 0 && updatedItems[0].variantType 
        ? updatedItems[0].variantType 
        : ProductVariant.SACHETS;
      const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
        updatedItems,
        firstItemVariantType,
        0 // Calculate without coupon first
      );

      // Recalculate coupon discount if coupon code exists
      if (cart.couponCode) {
        try {
          const coupon = await Coupons.findOne({
            code: cart.couponCode,
            isDeleted: false,
            isActive: true,
          }).lean();

          if (coupon) {
            const now = new Date();
            const isValidDate =
              (!coupon.validFrom || now >= coupon.validFrom) &&
              (!coupon.validUntil || now <= coupon.validUntil);

            if (isValidDate) {
              const orderAmount = totalsWithoutCoupon.discount; // Use discounted price as base

              if (
                !coupon.minOrderAmount ||
                orderAmount >= coupon.minOrderAmount
              ) {
                if (coupon.type === CouponType.PERCENTAGE) {
                  couponDiscountAmount = (orderAmount * coupon.value) / 100;
                  if (coupon.maxDiscountAmount) {
                    couponDiscountAmount = Math.min(
                      couponDiscountAmount,
                      coupon.maxDiscountAmount
                    );
                  }
                } else if (coupon.type === CouponType.FIXED) {
                  couponDiscountAmount = Math.min(coupon.value, orderAmount);
                }
                couponDiscountAmount = Math.min(
                  couponDiscountAmount,
                  orderAmount
                );
                couponDiscountAmount =
                  Math.round(couponDiscountAmount * 100) / 100;
              }
            }
          }
        } catch (error) {
          // If coupon validation fails, set discount to 0
          logger.warn(`Failed to recalculate coupon discount: ${error}`);
          couponDiscountAmount = 0;
        }
      }

      // Calculate final totals with coupon discount
      totals = await this.calculateCartTotalsWithVariantType(
        updatedItems,
        firstItemVariantType,
        couponDiscountAmount
      );
    }

    // Update cart with calculated values (all as numbers)
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        currency: totals.currency,
        couponDiscountAmount: couponDiscountAmount,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(
      `Item removed from cart for user ${userId} (productId: ${productId})`
    );

    return {
      cart: updatedCart,
      message: "Item removed from cart",
    };
  }

  /**
   * Apply or update coupon code in cart
   */
  async applyCoupon(
    userId: string,
    couponCode: string
  ): Promise<{ cart: any; message: string; couponDiscountAmount: number }> {
    const cart = await this.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new AppError("Cannot apply coupon to empty cart", 400);
    }

    // Normalize coupon code (uppercase)
    const normalizedCouponCode = couponCode.toUpperCase().trim();

    // Find coupon
    const coupon = await Coupons.findOne({
      code: normalizedCouponCode,
      isDeleted: false,
    }).lean();

    if (!coupon) {
      throw new AppError("Invalid coupon code", 404);
    }

    if (!coupon.isActive) {
      throw new AppError("This coupon is not active", 400);
    }

    // Check validity dates
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new AppError("This coupon is not yet valid", 400);
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new AppError("This coupon has expired", 400);
    }

    // Get product IDs and category IDs from cart
    const productIds = cart.items.map((item: any) => item.productId.toString());
    const products = await Products.find({
      _id: { $in: cart.items.map((item: any) => item.productId) },
      isDeleted: false,
    })
      .select("categories")
      .lean();
    const categoryIds = new Set<string>();
    products.forEach((product: any) => {
      if (product.categories && Array.isArray(product.categories)) {
        product.categories.forEach(
          (catId: mongoose.Types.ObjectId | string) => {
            categoryIds.add(catId.toString());
          }
        );
      }
    });

    // Validate coupon applicability
    if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
      const applicableProductIds = coupon.applicableProducts.map(
        (id: mongoose.Types.ObjectId) => id.toString()
      );
      if (!productIds.some((id: string) => applicableProductIds.includes(id))) {
        throw new AppError(
          "This coupon is not applicable to the selected products",
          400
        );
      }
    }

    if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
      const applicableCategoryIds = coupon.applicableCategories.map((id: any) =>
        id.toString()
      );
      if (
        !Array.from(categoryIds).some((id: string) =>
          applicableCategoryIds.includes(id)
        )
      ) {
        throw new AppError(
          "This coupon is not applicable to the selected categories",
          400
        );
      }
    }

    if (coupon.excludedProducts && coupon.excludedProducts.length > 0) {
      const excludedProductIds = coupon.excludedProducts.map(
        (id: mongoose.Types.ObjectId) => id.toString()
      );
      if (productIds.some((id: string) => excludedProductIds.includes(id))) {
        throw new AppError(
          "This coupon cannot be applied to one or more selected products",
          400
        );
      }
    }

    // Calculate order amount (discounted price total before coupon)
    // Use first item's variantType for backward compatibility (method uses item-level variantType anyway)
    const firstItemVariantType = cart.items && cart.items.length > 0 && cart.items[0].variantType 
      ? cart.items[0].variantType 
      : ProductVariant.SACHETS;
    const totals = await this.calculateCartTotalsWithVariantType(
      cart.items,
      firstItemVariantType,
      0 // Calculate without coupon first
    );

    // Order amount is the discounted price total (subtotal - discount + tax)
    // This represents the amount before coupon is applied
    const orderAmount = totals.subtotal - totals.discount + totals.tax;

    // Check minimum order amount
    if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
      throw new AppError(
        `Minimum order amount of ${coupon.minOrderAmount} ${totals.currency} is required for this coupon`,
        400
      );
    }

    // Calculate coupon discount
    let couponDiscountAmount = 0;

    if (coupon.type === CouponType.PERCENTAGE) {
      couponDiscountAmount = (orderAmount * coupon.value) / 100;
      if (coupon.maxDiscountAmount) {
        couponDiscountAmount = Math.min(
          couponDiscountAmount,
          coupon.maxDiscountAmount
        );
      }
    } else if (coupon.type === CouponType.FIXED) {
      couponDiscountAmount = Math.min(coupon.value, orderAmount);
    } else if (coupon.type === CouponType.FREE_SHIPPING) {
      // Free shipping discount is handled separately in checkout
      couponDiscountAmount = 0;
    }

    // Ensure discount doesn't exceed order amount
    couponDiscountAmount = Math.min(couponDiscountAmount, orderAmount);
    couponDiscountAmount = Math.round(couponDiscountAmount * 100) / 100;

    // Recalculate totals with coupon discount
    const finalTotals = await this.calculateCartTotalsWithVariantType(
      cart.items,
      firstItemVariantType,
      couponDiscountAmount
    );

    // Update cart with coupon and recalculated totals
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        couponCode: normalizedCouponCode,
        couponDiscountAmount: couponDiscountAmount,
        subtotal: finalTotals.subtotal,
        tax: finalTotals.tax,
        discount: finalTotals.discount,
        total: finalTotals.total,
        currency: finalTotals.currency,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(
      `Coupon ${normalizedCouponCode} applied to cart for user ${userId}`
    );

    return {
      cart: updatedCart,
      message: "Coupon applied successfully",
      couponDiscountAmount,
    };
  }

  /**
   * Remove coupon from cart
   */
  async removeCoupon(userId: string): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);

    // Recalculate totals without coupon
    // Use first item's variantType for backward compatibility (method uses item-level variantType anyway)
    const firstItemVariantType = cart.items && cart.items.length > 0 && cart.items[0].variantType 
      ? cart.items[0].variantType 
      : ProductVariant.SACHETS;
    const totals = await this.calculateCartTotalsWithVariantType(
      cart.items,
      firstItemVariantType,
      0 // No coupon discount
    );

    // Update cart to remove coupon
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        couponCode: null,
        couponDiscountAmount: 0,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        currency: totals.currency,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(`Coupon removed from cart for user ${userId}`);

    return {
      cart: updatedCart,
      message: "Coupon removed successfully",
    };
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<{ message: string }> {
    // Find and update cart directly by userId to ensure we get the right cart
    const result = await Carts.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      },
      {
        $set: {
          items: [],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          currency: "EUR",
          couponCode: null,
          linkedSubscriptionId: null,
          cartType: "NORMAL",
          couponDiscountAmount: 0,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
      }
    );

    if (!result) {
      // If no cart found, that's okay - cart might already be empty or not exist
      logger.info(`No cart found to clear for user ${userId}`);
    } else {
      logger.info(`Cart cleared for user ${userId}, cart ID: ${result._id}`);
    }

    return {
      message: "Cart cleared successfully",
    };
  }

  /**
   * Validate cart and calculate member pricing
   */
  async validateCart(userId: string): Promise<{
    isValid: boolean;
    errors: string[];
    cart: any;
    pricing: {
      subtotal: { currency: string; amount: number; taxRate: number };
      originalSubtotal: { currency: string; amount: number; taxRate: number };
      membershipDiscount: { currency: string; amount: number; taxRate: number };
      tax: { currency: string; amount: number; taxRate: number };
      shipping: { currency: string; amount: number; taxRate: number };
      total: { currency: string; amount: number; taxRate: number };
    };
    items: Array<{
      productId: string;
      originalPrice: { currency: string; amount: number; taxRate: number };
      memberPrice?: { currency: string; amount: number; taxRate: number };
      discount?: { amount: number; percentage: number };
      isAvailable: boolean;
      isValid: boolean;
      isMember?: boolean;
    }>;
  }> {
    const cart = await this.getOrCreateCart(userId);
    const errors: string[] = [];
    const validatedItems: any[] = [];

    if (!cart.items || cart.items.length === 0) {
      return {
        isValid: false,
        errors: ["Cart is empty"],
        cart,
        pricing: {
          subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
          originalSubtotal: { currency: "EUR", amount: 0, taxRate: 0 },
          membershipDiscount: { currency: "EUR", amount: 0, taxRate: 0 },
          tax: { currency: "EUR", amount: 0, taxRate: 0 },
          shipping: { currency: "EUR", amount: 0, taxRate: 0 },
          total: { currency: "EUR", amount: 0, taxRate: 0 },
        },
        items: [],
      };
    }

    let originalSubtotal = 0;
    let memberSubtotal = 0;
    let currency = cart.items[0]?.price?.currency || "EUR";

    // Batch fetch all products at once for better performance
    const productIds = cart.items.map((item: any) => item.productId);

    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
      status: true,
    }).lean();

    // Create maps for O(1) lookup
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    // Process all items and calculate member prices in parallel
    const itemProcessingPromises = cart.items.map(async (item: any) => {
      const product: any = productMap.get(item.productId.toString());
      if (!product) {
        errors.push(`Product ${item.productId} is not available`);
        return null;
      }

      // Get price source from product
      const productMetadata = product.metadata || {};

      const priceSource: ProductPriceSource = {
        price: product.price,
        memberPrice: productMetadata?.memberPrice,
        memberDiscountOverride: productMetadata?.memberDiscountOverride,
      };

      // Calculate member price
      const memberPriceResult = await calculateMemberPrice(priceSource, userId);

      const originalItemPrice = priceSource.price.amount;
      const memberItemPrice = memberPriceResult.memberPrice.amount;
      const originalItemTotal = originalItemPrice;
      const memberItemTotal = memberItemPrice;

      return {
        productId: item.productId.toString(),
        originalPrice: { ...priceSource.price },
        memberPrice: memberPriceResult.isMember
          ? memberPriceResult.memberPrice
          : undefined,
        discount:
          memberPriceResult.isMember && memberPriceResult.discountAmount > 0
            ? {
                amount: memberPriceResult.discountAmount,
                percentage: memberPriceResult.discountPercentage,
              }
            : undefined,
        isAvailable: true,
        isValid: true,
        isMember: memberPriceResult.isMember,
        originalItemTotal,
        memberItemTotal,
      };
    });

    // Wait for all item processing to complete
    const processedItems = await Promise.all(itemProcessingPromises);

    // Filter out null items and calculate totals
    for (const processedItem of processedItems) {
      if (processedItem) {
        originalSubtotal += processedItem.originalItemTotal;
        memberSubtotal += processedItem.memberItemTotal;
        validatedItems.push({
          productId: processedItem.productId,
          originalPrice: processedItem.originalPrice,
          memberPrice: processedItem.memberPrice,
          discount: processedItem.discount,
          isAvailable: processedItem.isAvailable,
          isValid: processedItem.isValid,
          isMember: processedItem.isMember,
        });
      }
    }

    // Calculate membership discount
    const membershipDiscountAmount = Math.max(
      0,
      originalSubtotal - memberSubtotal
    );
    const finalSubtotal = memberSubtotal;

    // Use existing cart tax and shipping (or calculate if needed)
    const taxAmount = cart.tax || 0;
    const shippingAmount = cart.shipping || 0;
    const totalAmount = finalSubtotal + taxAmount + shippingAmount;

    return {
      isValid: errors.length === 0,
      errors,
      cart,
      pricing: {
        subtotal: {
          currency,
          amount: Math.round((finalSubtotal + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        originalSubtotal: {
          currency,
          amount: Math.round((originalSubtotal + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        membershipDiscount: {
          currency,
          amount:
            Math.round((membershipDiscountAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        tax: {
          currency,
          amount: Math.round((taxAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        shipping: {
          currency,
          amount: Math.round((shippingAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        total: {
          currency,
          amount: Math.round((totalAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
      },
      items: validatedItems,
    };
  }

  /**
   * Get checkout products with all pricing details
   * Returns products in cart with complete pricing information
   */
  async getCheckoutProducts(userId: string): Promise<{
    products: any[];
    pricing: {
      subtotal: { currency: string; amount: number; taxRate: number };
      originalSubtotal: { currency: string; amount: number; taxRate: number };
      membershipDiscount: { currency: string; amount: number; taxRate: number };
      tax: { currency: string; amount: number; taxRate: number };
      shipping: { currency: string; amount: number; taxRate: number };
      total: { currency: string; amount: number; taxRate: number };
    };
  }> {
    const cart = await this.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      return {
        products: [],
        pricing: {
          subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
          originalSubtotal: { currency: "EUR", amount: 0, taxRate: 0 },
          membershipDiscount: { currency: "EUR", amount: 0, taxRate: 0 },
          tax: { currency: "EUR", amount: 0, taxRate: 0 },
          shipping: { currency: "EUR", amount: 0, taxRate: 0 },
          total: { currency: "EUR", amount: 0, taxRate: 0 },
        },
      };
    }

    // Get product IDs
    const productIds = cart.items.map((item: any) => item.productId);

    // Fetch products with full details
    const products = await Products.find({
      _id: { $in: productIds },
      isDeleted: false,
      status: true,
    })
      .populate("categories", "name slug description image")
      .lean();

    // Manually populate ingredients for all products (since ingredients is String array, not ObjectId ref)
    const allIngredientIds: string[] = [];
    products.forEach((product: any) => {
      if (product.ingredients && Array.isArray(product.ingredients)) {
        product.ingredients.forEach((ingredientId: any) => {
          // Handle both string IDs and ObjectId objects
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
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    // Build products array with all pricing details
    const checkoutProductsPromises = cart.items.map(async (item: any) => {
      const product: any = productMap.get(item.productId.toString());

      if (!product) {
        return null;
      }

      // Get pricing information
      const cartPrice = item.price;
      const productPrice = product.price || {
        currency: "EUR",
        amount: 0,
        taxRate: 0,
      };

      // Identify which subscription plan was selected based on cart price
      let selectedPlan: {
        type: "subscription" | "oneTime" | "default";
        plan?:
          | "thirtyDays"
          | "sixtyDays"
          | "ninetyDays"
          | "oneEightyDays"
          | "count_0"
          | "count_1";
        price?: any;
      } = { type: "default" };

      // Check if product has sachetPrices and match cart price with subscription plans
      if (product.sachetPrices) {
        const sachetPrices = product.sachetPrices;
        const cartAmount = cartPrice.amount;

        // Check subscription plans (thirtyDays, sixtyDays, ninetyDays, oneEightyDays)
        const subscriptionPlans = [
          { key: "thirtyDays", price: sachetPrices.thirtyDays },
          { key: "sixtyDays", price: sachetPrices.sixtyDays },
          { key: "ninetyDays", price: sachetPrices.ninetyDays },
          { key: "oneEightyDays", price: sachetPrices.oneEightyDays },
        ];

        for (const plan of subscriptionPlans) {
          if (plan.price) {
            // Check if cart price matches this plan's discountedPrice or amount
            const planPrice = plan.price.discountedPrice || plan.price.amount;
            if (Math.abs(cartAmount - planPrice) < 0.01) {
              selectedPlan = {
                type: "subscription",
                plan: plan.key as any,
                price: plan.price,
              };
              break;
            }
          }
        }

        // Note: One-time plans are NOT supported for SACHETS (only subscription plans)
        // Removed oneTime plan checking logic
      }

      // Check standupPouchPrice if hasStandupPouch - support both formats
      if (
        selectedPlan.type === "default" &&
        product.hasStandupPouch &&
        product.standupPouchPrice
      ) {
        const standupPrice = getNormalizedStandupPouchPrice(product.standupPouchPrice);
        
        const plan0Price = standupPrice.count_0;
        if (plan0Price) {
          const price = plan0Price.discountedPrice || plan0Price.amount;
          if (Math.abs(cartPrice.amount - price) < 0.01) {
            selectedPlan = {
              type: "oneTime",
              plan: "count_0",
              price: plan0Price,
            };
          }
        }
        if (selectedPlan.type === "default") {
          const plan1Price = standupPrice.count_1;
          if (plan1Price && plan1Price !== plan0Price) {
            const price = plan1Price.discountedPrice || plan1Price.amount;
            if (Math.abs(cartPrice.amount - price) < 0.01) {
              selectedPlan = {
                type: "oneTime",
                plan: "count_1",
                price: plan1Price,
              };
            }
          }
        }
      }

      // Use selected plan price for member pricing calculation if found
      const priceForMemberCalculation = selectedPlan.price
        ? {
            currency: selectedPlan.price.currency || cartPrice.currency,
            amount:
              selectedPlan.price.discountedPrice ||
              selectedPlan.price.amount ||
              cartPrice.amount,
            taxRate: selectedPlan.price.taxRate || cartPrice.taxRate,
          }
        : productPrice;

      // Calculate member pricing if applicable
      const priceSource: ProductPriceSource = {
        price: priceForMemberCalculation,
        memberPrice: (product as any).metadata?.memberPrice,
        memberDiscountOverride: (product as any).metadata
          ?.memberDiscountOverride,
      };

      const memberPriceResult = await calculateMemberPrice(priceSource, userId);

      const originalPrice = selectedPlan.price
        ? {
            currency: selectedPlan.price.currency || cartPrice.currency,
            amount:
              selectedPlan.price.amount ||
              selectedPlan.price.discountedPrice ||
              cartPrice.amount,
            taxRate: selectedPlan.price.taxRate || cartPrice.taxRate,
          }
        : productPrice;

      // Only use member price if user is actually a member
      const memberPrice = memberPriceResult.isMember
        ? memberPriceResult.memberPrice
        : null;
      const discountAmount = memberPriceResult.isMember
        ? originalPrice.amount - (memberPrice?.amount || originalPrice.amount)
        : 0;
      const discountPercentage =
        memberPriceResult.isMember && originalPrice.amount > 0
          ? (discountAmount / originalPrice.amount) * 100
          : 0;

      return {
        _id: product._id,
        title: product.title,
        slug: product.slug,
        productImage: product.productImage,
        shortDescription: product.shortDescription,
        productVariant: product.variant,
        hasStandupPouch: product.hasStandupPouch,
        isInCart: true, // This product is in cart
        // Pricing details
        pricing: {
          // Cart price (current price in cart - selected plan price)
          cartPrice: {
            currency: cartPrice.currency,
            amount: cartPrice.amount,
            taxRate: cartPrice.taxRate,
            totalAmount:
              Math.round((cartPrice.amount + cartPrice.taxRate) * 100) / 100,
            // Include selected plan information
            selectedPlan:
              selectedPlan.type !== "default"
                ? {
                    type: selectedPlan.type,
                    plan: selectedPlan.plan,
                  }
                : null,
          },
          // Original price (before any discounts) - from selected plan
          originalPrice: {
            currency: originalPrice.currency,
            amount: originalPrice.amount,
            taxRate: originalPrice.taxRate,
            totalAmount:
              Math.round((originalPrice.amount + originalPrice.taxRate) * 100) /
              100,
          },
          // Member price (only if user is a member)
          memberPrice: memberPrice
            ? {
                currency: memberPrice.currency,
                amount: memberPrice.amount,
                taxRate: memberPrice.taxRate,
                totalAmount:
                  Math.round((memberPrice.amount + memberPrice.taxRate) * 100) /
                  100,
              }
            : null,
          // Discount information (only if user is a member)
          discount: {
            amount: Math.round(discountAmount * 100) / 100,
            percentage: Math.round(discountPercentage * 100) / 100,
          },
          // All product pricing options
          productPricing: {
            price: product.price,
            sachetPrices: product.sachetPrices,
            standupPouchPrice: product.standupPouchPrice,
          },
        },
        // Product details
        categories: product.categories || [],
        ingredients: product.ingredients || [],
        addedAt: item.addedAt,
        variantType: item.variantType as ProductVariant,
      };
    });

    // Wait for all product calculations to complete
    const checkoutProducts = await Promise.all(checkoutProductsPromises);

    // Filter out null products
    const validProducts = checkoutProducts.filter((p: any) => p !== null);

    // Calculate totals
    const currency = cart.items[0]?.price?.currency || "EUR";

    let originalSubtotal = 0;
    let memberSubtotal = 0;
    let membershipDiscountAmount = 0;
    // Calculate tax by summing taxRate (direct amount) from all cart items
    let taxAmount = 0;
    cart.items.forEach((item: any) => {
      taxAmount += item.price.taxRate || 0;
    });

    validProducts.forEach((product: any) => {
      const originalItemTotal = product.pricing.originalPrice.amount;
      originalSubtotal += originalItemTotal;

      // Only apply member pricing if user is actually a member
      // Check if memberPrice exists AND discount amount > 0 (indicating member discount was applied)
      const hasMemberDiscount =
        product.pricing.memberPrice &&
        product.pricing.discount &&
        product.pricing.discount.amount > 0;

      const memberItemTotal = hasMemberDiscount
        ? product.pricing.memberPrice.amount
        : originalItemTotal;
      memberSubtotal += memberItemTotal;

      if (hasMemberDiscount) {
        membershipDiscountAmount +=
          product.pricing.originalPrice.amount -
          product.pricing.memberPrice.amount;
      }
    });
    const shippingAmount = cart.shipping || 0;
    const totalAmount = memberSubtotal + taxAmount + shippingAmount;

    return {
      products: validProducts,
      pricing: {
        subtotal: {
          currency,
          amount: Math.round((memberSubtotal + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        originalSubtotal: {
          currency,
          amount: Math.round((originalSubtotal + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        membershipDiscount: {
          currency,
          amount:
            Math.round((membershipDiscountAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        tax: {
          currency,
          amount: Math.round((taxAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        shipping: {
          currency,
          amount: Math.round((shippingAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        total: {
          currency,
          amount: Math.round((totalAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
      },
    };
  }

  /**
   * Get featured products excluding cart items
   * Returns 3-5 featured products
   */
  async getFeaturedProducts(
    userId: string,
    minCount: number = 3,
    maxCount: number = 5
  ): Promise<any[]> {
    const cart = await this.getOrCreateCart(userId);

    // Get product IDs already in cart
    const cartProductIds = (cart.items || []).map((item: any) =>
      item.productId.toString()
    );

    // Fetch featured products excluding cart items
    const featuredProducts = await Products.find({
      _id: {
        $nin: cartProductIds.map(
          (id: string) => new mongoose.Types.ObjectId(id)
        ),
      },
      isDeleted: false,
      status: true, // Active products
      isFeatured: true,
    })
      .populate(
        "categories",
        "sId slug name description sortOrder icon image productCount"
      )
      .limit(maxCount)
      .sort({ createdAt: -1 })
      .lean();

    // If we don't have enough featured products, fill with regular active products
    if (featuredProducts.length < minCount) {
      const additionalProducts = await Products.find({
        _id: {
          $nin: [
            ...cartProductIds.map(
              (id: string) => new mongoose.Types.ObjectId(id)
            ),
            ...featuredProducts.map((p: any) => p._id),
          ],
        },
        isDeleted: false,
        status: true,
      })
        .populate(
          "categories",
          "sId slug name description sortOrder icon image productCount"
        )
        .limit(minCount - featuredProducts.length)
        .sort({ createdAt: -1 })
        .lean();

      featuredProducts.push(...additionalProducts);
    }

    // Manually populate ingredients for featured products
    const featuredIngredientIds: string[] = [];
    featuredProducts.forEach((product: any) => {
      if (product.ingredients && Array.isArray(product.ingredients)) {
        product.ingredients.forEach((ingredientId: any) => {
          const id =
            typeof ingredientId === "string"
              ? ingredientId
              : ingredientId?.toString();
          if (
            id &&
            mongoose.Types.ObjectId.isValid(id) &&
            !featuredIngredientIds.includes(id)
          ) {
            featuredIngredientIds.push(id);
          }
        });
      }
    });

    // Fetch all ingredient details for featured products
    const featuredIngredientDetailsMap = new Map();
    if (featuredIngredientIds.length > 0) {
      const ingredientDetails = await ProductIngredients.find({
        _id: {
          $in: featuredIngredientIds.map(
            (id: string) => new mongoose.Types.ObjectId(id)
          ),
        },
      })
        .select("_id name description image")
        .lean();

      ingredientDetails.forEach((ingredient: any) => {
        featuredIngredientDetailsMap.set(ingredient._id.toString(), ingredient);
      });
    }

    // Replace ingredient IDs with populated ingredient objects for featured products
    featuredProducts.forEach((product: any) => {
      if (product.ingredients && Array.isArray(product.ingredients)) {
        product.ingredients = product.ingredients
          .map((ingredientId: any) => {
            const id =
              typeof ingredientId === "string"
                ? ingredientId
                : ingredientId?.toString();
            return featuredIngredientDetailsMap.get(id);
          })
          .filter((ingredient: any) => ingredient !== undefined);
      }
    });

    // Calculate averageRating and ratingCount for featured products (same as getAllProducts)
    const productIds = featuredProducts.map((p: any) => p._id);
    if (productIds.length > 0) {
      const ratingAggregation = await Reviews.aggregate([
        {
          $match: {
            productId: { $in: productIds },
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
      ]);

      // Create a map of productId -> rating data
      const ratingMap = new Map();
      ratingAggregation.forEach((item: any) => {
        ratingMap.set(item._id.toString(), {
          averageRating: Math.round(item.averageRating * 100) / 100,
          ratingCount: item.ratingCount,
        });
      });

      // Add rating fields to each product
      featuredProducts.forEach((product: any) => {
        const ratingData = ratingMap.get(product._id.toString());
        product.averageRating = ratingData?.averageRating || 0;
        product.ratingCount = ratingData?.ratingCount || 0;
      });
    } else {
      // If no products, set default ratings
      featuredProducts.forEach((product: any) => {
        product.averageRating = 0;
        product.ratingCount = 0;
      });
    }

    // Add variants array to all featured products
    const featuredProductsWithVariants = featuredProducts
      .slice(0, maxCount)
      .map((product: any) => {
        // Add variants array based on hasStandupPouch
        const variantsArray =
          product.hasStandupPouch === true
            ? ["sachets", "stand_up_pouch"]
            : ["sachets"];

        // Remove existing variants if any and add fresh array
        const { variants: _, ...productWithoutVariants } = product;
        return {
          ...productWithoutVariants,
          variants: variantsArray,
        };
      });

    // Limit to maxCount and return full product objects
    // Note: isInCart will be set by the controller after checking cart
    return featuredProductsWithVariants;
  }

  /**
   * Get suggested products (non-included products) for cart
   * If stand-up pouch is in cart, suggest only stand-up pouch products
   * If sachets are in cart, suggest only sachet products
   */
  async getSuggestedProducts(
    userId: string,
    limit: number = 10,
    userLang: SupportedLanguage = DEFAULT_LANGUAGE
  ): Promise<any[]> {
    const cart = await this.getOrCreateCart(userId);

    // Get product IDs already in cart
    const cartProductIds = (cart.items || []).map((item: any) =>
      item.productId.toString()
    );

    // Determine variant type from cart items
    let suggestedVariant: ProductVariant | null = null;

    if (cart.items && cart.items.length > 0) {
      // Fetch products from cart to check their variant type
      const cartProducts = await Products.find({
        _id: { $in: cart.items.map((item: any) => item.productId) },
        isDeleted: false,
      })
        .select("variant")
        .lean();

      // Check if any product is STAND_UP_POUCH
      const hasStandUpPouch = cartProducts.some(
        (product: any) => product.variant === ProductVariant.STAND_UP_POUCH
      );

      // Check if any product is SACHETS
      const hasSachets = cartProducts.some(
        (product: any) => product.variant === ProductVariant.SACHETS
      );

      // Determine suggested variant based on cart contents
      if (hasStandUpPouch) {
        suggestedVariant = ProductVariant.STAND_UP_POUCH;
      } else if (hasSachets) {
        suggestedVariant = ProductVariant.SACHETS;
      }
    }

    // Build query for suggested products
    const query: any = {
      _id: {
        $nin: cartProductIds.map(
          (id: string) => new mongoose.Types.ObjectId(id)
        ),
      },
      isDeleted: false,
      status: true, // true = Active, false = Inactive
    };

    // Filter by variant type if determined from cart
    if (suggestedVariant) {
      query.variant = suggestedVariant;
    }

    // Fetch suggested product IDs
    const suggestedProductDocs = await Products.find(query)
      .select("_id")
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    const suggestedProductIds = suggestedProductDocs.map((doc: any) => doc._id);

    if (suggestedProductIds.length === 0) {
      return [];
    }

    // Get user's wishlist product IDs for is_liked field
    let wishlistProductIds: Set<string> = new Set();
    try {
      const wishlistItems = await Wishlists.find({
        userId: new mongoose.Types.ObjectId(userId),
      })
        .select("productId")
        .lean();
      wishlistProductIds = new Set(
        wishlistItems.map((item: any) => item.productId.toString())
      );
    } catch (error) {
      // If wishlist fetch fails, continue without wishlist data
      logger.warn("Failed to fetch wishlist for suggested products", error);
    }

    // Fetch and enrich suggested products using common service
    const enrichedProducts = await fetchAndEnrichProducts(
      suggestedProductIds.map((id: any) => new mongoose.Types.ObjectId(id)),
      {
        userId,
        userLang,
        wishlistProductIds,
      }
    );

    // Add isInCart: false and variants array since these are suggested products (not in cart)
    return enrichedProducts.map((product: any) => {
      // Add variants array based on hasStandupPouch
      const variantsArray =
        product.hasStandupPouch === true
          ? ["sachets", "stand_up_pouch"]
          : ["sachets"];

      // Remove existing variants if any and add fresh array
      const { variants: _, ...productWithoutVariants } = product;
      return {
        ...productWithoutVariants,
        variants: variantsArray,
        isInCart: false,
      };
    });
  }
}

export const cartService = new CartService();
