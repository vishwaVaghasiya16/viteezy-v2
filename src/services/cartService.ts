import { type ICart, Carts } from "../models/commerce/carts.model";
import { Products } from "../models/commerce/products.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { Wishlists } from "../models/commerce/wishlists.model";
import { Coupons } from "../models/commerce/coupons.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import mongoose from "mongoose";
import { ProductVariant, CouponType } from "../models/enums";
import { DEFAULT_LANGUAGE, SupportedLanguage } from "../models/common.model";
import { fetchAndEnrichProducts } from "./productEnrichmentService";

interface AddCartItemData {
  productId: string;
  variantType: ProductVariant; // Required: SACHETS or STAND_UP_POUCH
}

interface UpdateCartItemData {
  productId: string;
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
  product?: any;
  variant?: any;
}

class CartService {
  private readonly LOW_STOCK_THRESHOLD = 10; // Warn if stock < 10

  /**
   * Calculate cart totals based on variantType pricing
   * Returns numbers for all price fields and currency separately
   */
  private async calculateCartTotalsWithVariantType(
    items: any[],
    variantType: ProductVariant,
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

    // Calculate subtotal, tax, and discount based on variantType
    let subtotalAmount = 0;
    let totalTaxAmount = 0;
    let totalDiscount = 0; // Sum of (amount - discountedPrice) for all products
    const currency = "EUR";

    items.forEach((item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) return;

      let originalAmount = 0;
      let discountedPrice = 0;
      let taxRate = 0;

      if (variantType === ProductVariant.SACHETS && product.sachetPrices) {
        // Use 30 days plan price for SACHETS
        const thirtyDaysPlan = product.sachetPrices.thirtyDays;
        if (thirtyDaysPlan) {
          originalAmount =
            thirtyDaysPlan.amount || thirtyDaysPlan.totalAmount || 0;
          discountedPrice =
            thirtyDaysPlan.discountedPrice ||
            thirtyDaysPlan.amount ||
            thirtyDaysPlan.totalAmount ||
            0;
          taxRate = thirtyDaysPlan.taxRate || 0;
        }
      } else if (
        variantType === ProductVariant.STAND_UP_POUCH &&
        product.standupPouchPrice
      ) {
        // Use count30 price for STAND_UP_POUCH
        const standupPrice = product.standupPouchPrice as any;
        if (standupPrice.count30) {
          originalAmount = standupPrice.count30.amount || 0;
          discountedPrice =
            standupPrice.count30.discountedPrice ||
            standupPrice.count30.amount ||
            0;
          taxRate = standupPrice.count30.taxRate || 0;
        } else if (standupPrice.amount) {
          originalAmount = standupPrice.amount || 0;
          discountedPrice =
            standupPrice.discountedPrice || standupPrice.amount || 0;
          taxRate = standupPrice.taxRate || 0;
        }
      } else {
        // Fallback to item price
        originalAmount = item.price?.amount || 0;
        discountedPrice = item.price?.amount || 0;
        taxRate = item.price?.taxRate || 0;
      }

      subtotalAmount += originalAmount;
      totalTaxAmount += taxRate; // taxRate is already an amount, not percentage
      // Calculate discount as difference: amount - discountedPrice
      const itemDiscount = originalAmount - discountedPrice;
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

    // Get cart variantType
    const cartVariantType = cart.variantType as ProductVariant;

    // Build items with full product details and calculate prices based on variantType
    const itemsWithDetails = (cart.items || []).map((item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        return {
          ...item,
          product: null,
        };
      }

      // Calculate price based on cart variantType
      let originalAmount = 0;
      let discountedPrice = 0;
      let currency = "EUR";
      let taxRate = 0;

      if (cartVariantType === ProductVariant.SACHETS && product.sachetPrices) {
        // Use 30 days plan price for SACHETS
        const thirtyDaysPlan = product.sachetPrices.thirtyDays;
        if (thirtyDaysPlan) {
          currency = thirtyDaysPlan.currency || "EUR";
          taxRate = thirtyDaysPlan.taxRate || 0;
          // Original amount (for subtotal) - use amount field
          originalAmount =
            thirtyDaysPlan.amount || thirtyDaysPlan.totalAmount || 0;
          // Discounted price (for discount field) - use discountedPrice field
          discountedPrice =
            thirtyDaysPlan.discountedPrice ||
            thirtyDaysPlan.amount ||
            thirtyDaysPlan.totalAmount ||
            0;
        }
      } else if (
        cartVariantType === ProductVariant.STAND_UP_POUCH &&
        product.standupPouchPrice
      ) {
        // Use count30 price for STAND_UP_POUCH
        const standupPrice = product.standupPouchPrice as any;
        if (standupPrice.count30) {
          currency = standupPrice.count30.currency || "EUR";
          taxRate = standupPrice.count30.taxRate || 0;
          // Original amount (for subtotal) - use amount field
          originalAmount = standupPrice.count30.amount || 0;
          // Discounted price (for discount field) - use discountedPrice field
          discountedPrice =
            standupPrice.count30.discountedPrice ||
            standupPrice.count30.amount ||
            0;
        } else if (standupPrice.amount) {
          // Fallback to simple price structure
          currency = standupPrice.currency || "EUR";
          taxRate = standupPrice.taxRate || 0;
          originalAmount = standupPrice.amount || 0;
          discountedPrice =
            standupPrice.discountedPrice || standupPrice.amount || 0;
        }
      } else {
        // Fallback to item price if no variantType match
        currency = item.price?.currency || "EUR";
        taxRate = item.price?.taxRate || 0;
        originalAmount = item.price?.amount || 0;
        discountedPrice = item.price?.amount || 0;
      }

      const calculatedPrice = {
        currency,
        amount: discountedPrice, // Use discounted price for display
        taxRate,
      };

      // Add isInCart: true since this product is in the cart
      const productWithCartFlag = product
        ? { ...product, isInCart: true }
        : null;

      // Build item object
      return {
        productId: item.productId,
        price: calculatedPrice, // Update with calculated price
        addedAt: item.addedAt,
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
    const { productId, variantType } = data;

    // Validate and get pricing
    const { product, price } = await this.validateAndGetPricing(productId);

    const cart = await this.getOrCreateCart(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    // Get product variant type
    const productVariantType = product.variant as ProductVariant;

    // Validate that product supports the requested variantType
    // A product supports STAND_UP_POUCH if:
    // 1. product.variant === "STAND_UP_POUCH", OR
    // 2. product.variant === "SACHETS" AND product.hasStandupPouch === true
    // A product supports SACHETS if:
    // 1. product.variant === "SACHETS"
    let isVariantSupported = false;

    if (variantType === ProductVariant.STAND_UP_POUCH) {
      // Check if product supports STAND_UP_POUCH
      isVariantSupported =
        productVariantType === ProductVariant.STAND_UP_POUCH ||
        (productVariantType === ProductVariant.SACHETS &&
          product.hasStandupPouch === true);
    } else if (variantType === ProductVariant.SACHETS) {
      // Check if product supports SACHETS
      isVariantSupported = productVariantType === ProductVariant.SACHETS;
    }

    if (!isVariantSupported) {
      throw new AppError(
        `Product does not support variant type "${variantType}". Product has variant type "${productVariantType}"${
          product.hasStandupPouch ? " with stand-up pouch support" : ""
        }.`,
        400
      );
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId
    );

    let updatedItems = [...(cart.items || [])];
    let updatedVariantType: ProductVariant;

    // Manage variantType based on cart state
    if (cart.items && cart.items.length > 0) {
      // Cart already has items, validate that new item's variantType matches cart's variantType
      if (cart.variantType && cart.variantType !== variantType) {
        throw new AppError(
          `You can only add ${
            cart.variantType === ProductVariant.SACHETS
              ? "sachets"
              : "stand-up pouch"
          } products to this cart. Please clear your cart or remove existing items to add different variant types.`,
          400
        );
      }
      // Keep existing variantType (should always exist if cart has items)
      updatedVariantType = cart.variantType || variantType;
    } else {
      // Cart is empty, set variantType from first item being added
      updatedVariantType = variantType;
    }

    // Calculate price based on variantType (same as getCart)
    let calculatedPrice = price; // Default to validated price
    let currency = "EUR";
    let taxRate = 0;

    if (variantType === ProductVariant.SACHETS && product.sachetPrices) {
      // Use 30 days plan price for SACHETS
      const thirtyDaysPlan = product.sachetPrices.thirtyDays;
      if (thirtyDaysPlan) {
        currency = thirtyDaysPlan.currency || "EUR";
        taxRate = thirtyDaysPlan.taxRate || 0;
        calculatedPrice = {
          currency,
          amount:
            thirtyDaysPlan.discountedPrice ||
            thirtyDaysPlan.totalAmount ||
            thirtyDaysPlan.amount ||
            0,
          taxRate,
        };
      }
    } else if (
      variantType === ProductVariant.STAND_UP_POUCH &&
      product.standupPouchPrice
    ) {
      // Use count30 price for STAND_UP_POUCH
      const standupPrice = product.standupPouchPrice as any;
      if (standupPrice.count30) {
        currency = standupPrice.count30.currency || "EUR";
        taxRate = standupPrice.count30.taxRate || 0;
        calculatedPrice = {
          currency,
          amount:
            standupPrice.count30.discountedPrice ||
            standupPrice.count30.amount ||
            0,
          taxRate,
        };
      } else if (standupPrice.amount) {
        currency = standupPrice.currency || "EUR";
        taxRate = standupPrice.taxRate || 0;
        calculatedPrice = {
          currency,
          amount: standupPrice.discountedPrice || standupPrice.amount || 0,
          taxRate,
        };
      }
    }

    if (existingItemIndex >= 0) {
      // Item already exists, update price with calculated price
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        price: calculatedPrice, // Update with calculated price based on variantType
      };
    } else {
      // Add new item with calculated price
      updatedItems.push({
        productId: productObjectId,
        price: calculatedPrice,
        addedAt: new Date(),
      });
    }

    // Calculate totals first without coupon to get order amount
    const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      updatedVariantType,
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
      updatedVariantType,
      couponDiscountAmount
    );

    // Update cart with calculated values (all as numbers)
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        variantType: updatedVariantType,
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
    const { productId } = data;

    // Find the item in cart by productId
    const itemIndex = cart.items.findIndex(
      (item: any) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      throw new AppError("Cart item not found", 404);
    }

    const item = cart.items[itemIndex];

    // Validate and get updated pricing
    const { product, price } = await this.validateAndGetPricing(productId);

    // Get cart variantType
    const cartVariantType = cart.variantType as ProductVariant;

    // Calculate price based on variantType (same as getCart)
    let calculatedPrice = price;
    if (cartVariantType === ProductVariant.SACHETS && product.sachetPrices) {
      const thirtyDaysPlan = product.sachetPrices.thirtyDays;
      if (thirtyDaysPlan) {
        calculatedPrice = {
          currency: thirtyDaysPlan.currency || "EUR",
          amount:
            thirtyDaysPlan.discountedPrice ||
            thirtyDaysPlan.totalAmount ||
            thirtyDaysPlan.amount ||
            0,
          taxRate: thirtyDaysPlan.taxRate || 0,
        };
      }
    } else if (
      cartVariantType === ProductVariant.STAND_UP_POUCH &&
      product.standupPouchPrice
    ) {
      const standupPrice = product.standupPouchPrice as any;
      if (standupPrice.count30) {
        calculatedPrice = {
          currency: standupPrice.count30.currency || "EUR",
          amount:
            standupPrice.count30.discountedPrice ||
            standupPrice.count30.amount ||
            0,
          taxRate: standupPrice.count30.taxRate || 0,
        };
      } else if (standupPrice.amount) {
        calculatedPrice = {
          currency: standupPrice.currency || "EUR",
          amount: standupPrice.discountedPrice || standupPrice.amount || 0,
          taxRate: standupPrice.taxRate || 0,
        };
      }
    }

    // Update item price
    const updatedItems = [...(cart.items || [])];
    updatedItems[itemIndex] = {
      ...item,
      price: calculatedPrice, // Update with calculated price based on variantType
    };

    // Calculate totals first without coupon to get order amount
    const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
      updatedItems,
      cartVariantType,
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
      cartVariantType,
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

    // If cart is empty, clear variantType
    let updatedVariantType = cart.variantType;
    if (updatedItems.length === 0) {
      updatedVariantType = undefined;
    }

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
      const totalsWithoutCoupon = await this.calculateCartTotalsWithVariantType(
        updatedItems,
        updatedVariantType as ProductVariant,
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
        updatedVariantType as ProductVariant,
        couponDiscountAmount
      );
    }

    // Update cart with calculated values (all as numbers)
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        variantType: updatedVariantType,
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
    const totals = await this.calculateCartTotalsWithVariantType(
      cart.items,
      cart.variantType as ProductVariant,
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
      cart.variantType as ProductVariant,
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
    const totals = await this.calculateCartTotalsWithVariantType(
      cart.items,
      cart.variantType as ProductVariant,
      0 // No coupon discount
    );

    // Update cart to remove coupon
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        couponCode: undefined,
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
    const cart = await this.getOrCreateCart(userId);

    await Carts.findByIdAndUpdate(cart._id, {
      items: [],
      variantType: undefined,
      subtotal: 0,
      tax: 0,
      discount: 0,
      total: 0,
      currency: "EUR",
      couponCode: undefined,
      couponDiscountAmount: 0,
      updatedAt: new Date(),
    });

    logger.info(`Cart cleared for user ${userId}`);

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
          | "count30"
          | "count60";
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

        // If not found in subscription, check oneTime options
        if (selectedPlan.type === "default" && sachetPrices.oneTime) {
          if (sachetPrices.oneTime.count30) {
            const count30Price =
              sachetPrices.oneTime.count30.discountedPrice ||
              sachetPrices.oneTime.count30.amount;
            if (Math.abs(cartAmount - count30Price) < 0.01) {
              selectedPlan = {
                type: "oneTime",
                plan: "count30",
                price: sachetPrices.oneTime.count30,
              };
            }
          }
          if (selectedPlan.type === "default" && sachetPrices.oneTime.count60) {
            const count60Price =
              sachetPrices.oneTime.count60.discountedPrice ||
              sachetPrices.oneTime.count60.amount;
            if (Math.abs(cartAmount - count60Price) < 0.01) {
              selectedPlan = {
                type: "oneTime",
                plan: "count60",
                price: sachetPrices.oneTime.count60,
              };
            }
          }
        }
      }

      // Check standupPouchPrice if hasStandupPouch
      if (
        selectedPlan.type === "default" &&
        product.hasStandupPouch &&
        product.standupPouchPrice
      ) {
        if (product.standupPouchPrice.count30) {
          const count30Price =
            product.standupPouchPrice.count30.discountedPrice ||
            product.standupPouchPrice.count30.amount;
          if (Math.abs(cartPrice.amount - count30Price) < 0.01) {
            selectedPlan = {
              type: "oneTime",
              plan: "count30",
              price: product.standupPouchPrice.count30,
            };
          }
        }
        if (
          selectedPlan.type === "default" &&
          product.standupPouchPrice.count60
        ) {
          const count60Price =
            product.standupPouchPrice.count60.discountedPrice ||
            product.standupPouchPrice.count60.amount;
          if (Math.abs(cartPrice.amount - count60Price) < 0.01) {
            selectedPlan = {
              type: "oneTime",
              plan: "count60",
              price: product.standupPouchPrice.count60,
            };
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
      .populate("categories", "name slug description image")
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
        .populate("categories", "name slug description image")
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

    // Limit to maxCount and return full product objects
    // Note: isInCart will be set by the controller after checking cart
    return featuredProducts.slice(0, maxCount);
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

    // Add isInCart: false since these are suggested products (not in cart)
    return enrichedProducts.map((product: any) => ({
      ...product,
      isInCart: false,
    }));
  }
}

export const cartService = new CartService();
