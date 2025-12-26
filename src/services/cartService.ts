import { type ICart, Carts } from "../models/commerce/carts.model";
import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { ProductIngredients } from "../models/commerce/productIngredients.model";
import { Wishlists } from "../models/commerce/wishlists.model";
import { Reviews } from "../models/cms/reviews.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import mongoose from "mongoose";
import { ProductVariant, ReviewStatus } from "../models/enums";
import { DEFAULT_LANGUAGE, SupportedLanguage } from "../models/common.model";
import { fetchAndEnrichProducts } from "./productEnrichmentService";

interface AddCartItemData {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface UpdateCartItemData {
  productId: string;
  variantId?: string;
  quantity?: number;
}

interface RemoveCartItemData {
  productId: string;
  variantId?: string;
  quantity?: number; // Optional, defaults to 1 if not provided
}

interface CartItemWithDetails {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  quantity: number;
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
      subtotalAmount += item.price.amount * item.quantity;
      // Tax rate is now a direct amount (not percentage), so add it directly
      // Multiply by quantity because tax is per item
      totalTaxAmount += (item.price.taxRate || 0) * item.quantity;
    });

    const taxAmount = totalTaxAmount;
    const totalAmount = subtotalAmount + taxAmount + shippingAmount - discountAmount;

    // Since taxRate is now a direct amount (not percentage), we use 0 as taxRate in totals
    // The actual tax amount is stored in tax.amount
    return {
      subtotal: {
        currency,
        amount: Math.round(subtotalAmount * 100) / 100,
        taxRate: 0,
      },
      tax: { currency, amount: Math.round(taxAmount * 100) / 100, taxRate: 0 },
      shipping: { currency, amount: Math.round(shippingAmount * 100) / 100, taxRate: 0 },
      discount: { currency, amount: Math.round(discountAmount * 100) / 100, taxRate: 0 },
      total: { currency, amount: Math.round(totalAmount * 100) / 100, taxRate: 0 },
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
        subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
        tax: { currency: "EUR", amount: 0, taxRate: 0 },
        shipping: { currency: "EUR", amount: 0, taxRate: 0 },
        discount: { currency: "EUR", amount: 0, taxRate: 0 },
        total: { currency: "EUR", amount: 0, taxRate: 0 },
      });
      cart = newCart.toObject();
    }

    return cart;
  }

  /**
   * Validate product and variant, get pricing and stock
   */
  private async validateAndGetPricing(
    productId: string,
    variantId: string | undefined,
    requestedQuantity: number
  ): Promise<{
    product: any;
    variant?: any;
    price: { currency: string; amount: number; taxRate: number };
    stockWarning?: {
      available: number;
      requested: number;
      isLowStock: boolean;
      message: string;
    };
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

    let variant: any = null;
    let price = product.price;

    // If variant is provided, validate it
    if (variantId) {
      variant = await ProductVariants.findOne({
        _id: new mongoose.Types.ObjectId(variantId),
        productId: new mongoose.Types.ObjectId(productId),
        isDeleted: { $ne: true },
        isActive: true,
      }).lean();

      if (!variant) {
        throw new AppError("Product variant not found or not available", 404);
      }

      // Use variant price
      price = variant.price;

      // Check stock if tracking is enabled
      if (variant.inventory.trackQuantity) {
        const availableQuantity =
          variant.inventory.quantity - variant.inventory.reserved;

        // Validate quantity doesn't exceed available stock
        if (
          !variant.inventory.allowBackorder &&
          requestedQuantity > availableQuantity
        ) {
          throw new AppError(
            `Insufficient stock. Available: ${availableQuantity}, Requested: ${requestedQuantity}`,
            400
          );
        }
      }
    }

    return {
      product,
      variant: variant || undefined,
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
  ): Promise<{ cart: any; suggestedProducts?: any[]; paymentDetails?: any }> {
    const cart = await this.getOrCreateCart(userId);

    if (!cart.items || cart.items.length === 0) {
      const emptyTotals = {
        subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
        tax: { currency: "EUR", amount: 0, taxRate: 0 },
        shipping: { currency: "EUR", amount: 0, taxRate: 0 },
        discount: { currency: "EUR", amount: 0, taxRate: 0 },
        total: { currency: "EUR", amount: 0, taxRate: 0 },
      };

      const paymentDetails = {
        subtotal: emptyTotals.subtotal,
        discount: emptyTotals.discount,
        shipping: emptyTotals.shipping,
        tax: emptyTotals.tax,
        grandTotal: emptyTotals.total,
        couponCode: cart.couponCode || null,
      };

      const result: {
        cart: any;
        suggestedProducts?: any[];
        paymentDetails?: any;
      } = {
        cart: {
          ...cart,
          items: [],
          ...emptyTotals,
        },
        paymentDetails,
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

    // Get product IDs and variant IDs
    const productIds = cart.items.map((item: any) => item.productId);
    const variantIds = cart.items
      .map((item: any) => item.variantId)
      .filter((id: any) => id);

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

    // Fetch variants
    const variants =
      variantIds.length > 0
        ? await ProductVariants.find({
            _id: { $in: variantIds },
            isDeleted: { $ne: true },
            isActive: true,
          }).lean()
        : [];

    // Create maps for quick lookup
    const productMap = new Map(
      enrichedProducts.map((p: any) => [p._id.toString(), p])
    );
    const variantMap = new Map(variants.map((v: any) => [v._id.toString(), v]));

    // Build items with full product details
    const itemsWithDetails = (cart.items || []).map((item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        return {
          ...item,
          product: null,
          variant: item.variantId
            ? variantMap.get(item.variantId.toString()) || undefined
            : undefined,
        };
      }

      const variant = item.variantId
        ? variantMap.get(item.variantId.toString())
        : null;

      // Add variant info if exists
      let variantInfo = null;
      if (variant) {
        variantInfo = {
          _id: variant._id,
          name: variant.name,
          sku: variant.sku,
          attributes: variant.attributes,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
        };
      }

      // Add isInCart: true since this product is in the cart
      const productWithCartFlag = product
        ? { ...product, isInCart: true }
        : null;

      return {
        ...item,
        product: productWithCartFlag, // Already enriched with full details from common service
        variant: variantInfo || undefined,
      };
    });

    // Get shipping and discount from cart (if set)
    const shippingAmount = cart.shipping?.amount || 0;
    const discountAmount = cart.discount?.amount || 0;

    // Calculate totals including shipping and discount
    const totals = this.calculateCartTotals(
      itemsWithDetails,
      shippingAmount,
      discountAmount
    );

    // Build payment details
    const paymentDetails = {
      subtotal: totals.subtotal,
      discount: totals.discount,
      shipping: totals.shipping,
      tax: totals.tax,
      grandTotal: totals.total,
      couponCode: cart.couponCode || null,
    };

    const result: {
      cart: any;
      suggestedProducts?: any[];
      paymentDetails?: any;
    } = {
      cart: {
        ...cart,
        items: itemsWithDetails,
        ...totals,
      },
      paymentDetails,
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
   * Returns true if product (with optional variantId) exists in cart
   */
  async isProductInCart(
    userId: string,
    productId: string,
    variantId?: string | null
  ): Promise<boolean> {
    try {
      const cart = await this.getOrCreateCart(userId);
      if (!cart.items || cart.items.length === 0) {
        return false;
      }

      const productObjectId = productId.toString();
      const variantObjectId = variantId ? variantId.toString() : null;

      const itemExists = cart.items.some((item: any) => {
        const productMatch =
          item.productId.toString() === productObjectId ||
          item.productId.toString() === productObjectId.toString();
        const variantMatch = variantObjectId
          ? (item.variantId?.toString() === variantObjectId ||
             item.variantId?.toString() === variantObjectId.toString())
          : !item.variantId; // If variantId not provided, match items without variantId

        return productMatch && variantMatch;
      });

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

      return new Set(
        cart.items.map((item: any) => item.productId.toString())
      );
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
    const { productId, variantId, quantity } = data;

    // Validate and get pricing
    const { product, variant, price } = await this.validateAndGetPricing(
      productId,
      variantId,
      quantity
    );

    const cart = await this.getOrCreateCart(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const variantObjectId = variantId
      ? new mongoose.Types.ObjectId(variantId)
      : null;

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        (variantId ? item.variantId?.toString() === variantId : !item.variantId)
    );

    let updatedItems = [...(cart.items || [])];

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;

      // Re-validate stock with new total quantity
      if (variant && variant.inventory.trackQuantity) {
        const available =
          variant.inventory.quantity - variant.inventory.reserved;
        if (!variant.inventory.allowBackorder && newQuantity > available) {
          throw new AppError(
            `Cannot add more items. Available: ${available}, Current in cart: ${existingItem.quantity}, Requested additional: ${quantity}`,
            400
          );
        }
      }

      updatedItems[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        price, // Update price in case it changed
      };
    } else {
      // Add new item
      updatedItems.push({
        productId: productObjectId,
        variantId: variantObjectId,
        quantity,
        price,
        addedAt: new Date(),
      });
    }

    // Get existing shipping and discount from cart
    const shippingAmount = cart.shipping?.amount || 0;
    const discountAmount = cart.discount?.amount || 0;

    // Calculate totals
    const totals = this.calculateCartTotals(
      updatedItems,
      shippingAmount,
      discountAmount
    );

    // Update cart
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        // Keep existing shipping and discount if they exist, otherwise update to 0
        shipping: cart.shipping || totals.shipping,
        discount: cart.discount || totals.discount,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(`Item added to cart for user ${userId}`);

    return {
      cart: updatedCart,
      message:
        existingItemIndex >= 0
          ? "Cart item quantity updated"
          : "Item added to cart",
    };
  }

  /**
   * Update cart item quantity by productId
   * If quantity is not provided, removes the item from cart entirely
   */
  async updateItem(
    userId: string,
    data: UpdateCartItemData
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    const { productId, variantId, quantity } = data;

    // Find the item in cart by productId and variantId (if provided)
    const itemIndex = cart.items.findIndex((item: any) => {
      const productMatch =
        item.productId.toString() === productId ||
        item.productId.toString() === productId.toString();
      const variantMatch = variantId
        ? item.variantId?.toString() === variantId ||
          item.variantId?.toString() === variantId.toString()
        : !item.variantId; // If variantId not provided, match items without variantId

      return productMatch && variantMatch;
    });

    if (itemIndex === -1) {
      throw new AppError("Cart item not found", 404);
    }

    const item = cart.items[itemIndex];

    // If quantity is not provided, remove the item entirely
    if (quantity === undefined || quantity === null) {
      const updatedItems = [...(cart.items || [])];
      updatedItems.splice(itemIndex, 1);

      // Calculate totals
      const totals = this.calculateCartTotals(updatedItems, 0, 0);

      // Update cart
      const updatedCart = await Carts.findByIdAndUpdate(
        cart._id,
        {
          items: updatedItems,
          ...totals,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean();

      logger.info(
        `Cart item removed for user ${userId} (productId: ${productId})`
      );

      return {
        cart: updatedCart,
        message: "Cart item removed successfully",
      };
    }

    // Validate stock if variant exists
    if (item.variantId) {
      const variant = await ProductVariants.findById(item.variantId).lean();
      if (variant && variant.inventory.trackQuantity) {
        const available =
          variant.inventory.quantity - variant.inventory.reserved;
        if (!variant.inventory.allowBackorder && quantity > available) {
          throw new AppError(
            `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
            400
          );
        }
      }
    }

    // Update item quantity
    const updatedItems = [...(cart.items || [])];
    updatedItems[itemIndex] = {
      ...item,
      quantity,
      price: item.price, // Keep existing price
    };

    // Get existing shipping and discount from cart
    const shippingAmount = cart.shipping?.amount || 0;
    const discountAmount = cart.discount?.amount || 0;

    // Calculate totals
    const totals = this.calculateCartTotals(
      updatedItems,
      shippingAmount,
      discountAmount
    );

    // Update cart
    const updatedCart = await Carts.findByIdAndUpdate(
      cart._id,
      {
        items: updatedItems,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        // Keep existing shipping and discount if they exist
        shipping: cart.shipping || totals.shipping,
        discount: cart.discount || totals.discount,
        updatedAt: new Date(),
      },
      { new: true }
    ).lean();

    logger.info(
      `Cart item updated for user ${userId} (productId: ${productId}, quantity: ${quantity})`
    );

    return {
      cart: updatedCart,
      message: "Cart item updated successfully",
    };
  }

  /**
   * Remove item from cart
   * If quantity is not provided, removes the entire item from cart
   */
  async removeItem(
    userId: string,
    data: RemoveCartItemData
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);
    const { productId, variantId, quantity } = data;

    // Find the item in cart by productId and variantId (if provided)
    const itemIndex = cart.items.findIndex((item: any) => {
      const productMatch =
        item.productId.toString() === productId ||
        item.productId.toString() === productId.toString();
      const variantMatch = variantId
        ? item.variantId?.toString() === variantId ||
          item.variantId?.toString() === variantId.toString()
        : !item.variantId; // If variantId not provided, match items without variantId

      return productMatch && variantMatch;
    });

    if (itemIndex === -1) {
      throw new AppError("Cart item not found", 404);
    }

    const item = cart.items[itemIndex];
    const currentQuantity = item.quantity;

    // If quantity is not provided, remove the entire item
    if (quantity === undefined || quantity === null) {
      const updatedItems = [...(cart.items || [])];
      updatedItems.splice(itemIndex, 1);

      // Calculate totals
      const totals = this.calculateCartTotals(updatedItems, 0, 0);

      // Update cart
      const updatedCart = await Carts.findByIdAndUpdate(
        cart._id,
        {
          items: updatedItems,
          ...totals,
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

    const removeQuantity = quantity;

    // If removing all or more than available, remove the entire item
    if (removeQuantity >= currentQuantity) {
      const updatedItems = [...(cart.items || [])];
      updatedItems.splice(itemIndex, 1);

      // Get existing shipping and discount from cart
      const shippingAmount = cart.shipping?.amount || 0;
      const discountAmount = cart.discount?.amount || 0;

      // Calculate totals
      const totals = this.calculateCartTotals(
        updatedItems,
        shippingAmount,
        discountAmount
      );

      // Update cart
      const updatedCart = await Carts.findByIdAndUpdate(
        cart._id,
        {
          items: updatedItems,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          // Keep existing shipping and discount if they exist
          shipping: cart.shipping || totals.shipping,
          discount: cart.discount || totals.discount,
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
    } else {
      // Reduce quantity
      const updatedItems = [...(cart.items || [])];
      updatedItems[itemIndex] = {
        ...item,
        quantity: currentQuantity - removeQuantity,
      };

      // Get existing shipping and discount from cart
      const shippingAmount = cart.shipping?.amount || 0;
      const discountAmount = cart.discount?.amount || 0;

      // Calculate totals
      const totals = this.calculateCartTotals(
        updatedItems,
        shippingAmount,
        discountAmount
      );

      // Update cart
      const updatedCart = await Carts.findByIdAndUpdate(
        cart._id,
        {
          items: updatedItems,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          // Keep existing shipping and discount if they exist
          shipping: cart.shipping || totals.shipping,
          discount: cart.discount || totals.discount,
          updatedAt: new Date(),
        },
        { new: true }
      ).lean();

      logger.info(
        `Item quantity reduced in cart for user ${userId} (productId: ${productId}, removed: ${removeQuantity})`
      );

      return {
        cart: updatedCart,
        message: `Removed ${removeQuantity} item(s) from cart`,
      };
    }
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string): Promise<{ message: string }> {
    const cart = await this.getOrCreateCart(userId);

    await Carts.findByIdAndUpdate(cart._id, {
      items: [],
      subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
      tax: { currency: "EUR", amount: 0, taxRate: 0 },
      shipping: { currency: "EUR", amount: 0, taxRate: 0 },
      discount: { currency: "EUR", amount: 0, taxRate: 0 },
      total: { currency: "EUR", amount: 0, taxRate: 0 },
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
      variantId?: string;
      quantity: number;
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

    // Batch fetch all products and variants at once for better performance
    const productIds = cart.items.map((item: any) => item.productId);
    const variantIds = cart.items
      .map((item: any) => item.variantId)
      .filter((id: any) => id);

    const [products, variants] = await Promise.all([
      Products.find({
        _id: { $in: productIds },
        isDeleted: false,
        status: true,
      }).lean(),
      variantIds.length > 0
        ? ProductVariants.find({
            _id: { $in: variantIds },
            isDeleted: { $ne: true },
            isActive: true,
          }).lean()
        : Promise.resolve([]),
    ]);

    // Create maps for O(1) lookup
    const productMap = new Map(products.map((p: any) => [p._id.toString(), p]));
    const variantMap = new Map(variants.map((v: any) => [v._id.toString(), v]));

    // Process all items and calculate member prices in parallel
    const itemProcessingPromises = cart.items.map(async (item: any) => {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        errors.push(`Product ${item.productId} is not available`);
        return null;
      }

      let variant: any = null;
      if (item.variantId) {
        variant = variantMap.get(item.variantId.toString());
        if (!variant) {
          errors.push(`Variant ${item.variantId} is not available`);
          return null;
        }
      }

      // Get price source (variant price takes precedence)
      const productMetadata = (product as any).metadata || {};
      const variantMetadata = variant ? (variant as any).metadata || {} : {};

      const priceSource: ProductPriceSource = {
        price: variant?.price || product.price,
        memberPrice:
          variantMetadata?.memberPrice || productMetadata?.memberPrice,
        memberDiscountOverride:
          variantMetadata?.memberDiscountOverride ||
          productMetadata?.memberDiscountOverride,
      };

      // Calculate member price
      const memberPriceResult = await calculateMemberPrice(priceSource, userId);

      const originalItemPrice = priceSource.price.amount;
      const memberItemPrice = memberPriceResult.memberPrice.amount;
      const originalItemTotal = originalItemPrice * item.quantity;
      const memberItemTotal = memberItemPrice * item.quantity;

      return {
        productId: item.productId.toString(),
        variantId: item.variantId?.toString(),
        quantity: item.quantity,
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
          variantId: processedItem.variantId,
          quantity: processedItem.quantity,
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
    const taxAmount = cart.tax?.amount || 0;
    const shippingAmount = cart.shipping?.amount || 0;
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

    // Get product IDs and variant IDs
    const productIds = cart.items.map((item: any) => item.productId);
    const variantIds = cart.items
      .map((item: any) => item.variantId)
      .filter((id: any) => id);

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
    const variantMap = new Map(variants.map((v: any) => [v._id.toString(), v]));

    // Build products array with all pricing details
    const checkoutProductsPromises = cart.items.map(async (item: any) => {
      const product = productMap.get(item.productId.toString());
      const variant = item.variantId
        ? variantMap.get(item.variantId.toString())
        : null;

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
      const variantPrice = variant?.price || null;

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
        : variantPrice || productPrice;

      // Calculate member pricing if applicable
      const priceSource: ProductPriceSource = {
        price: priceForMemberCalculation,
        memberPrice: product.memberPrice,
        memberDiscountOverride: product.memberDiscountOverride,
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
        : variantPrice || productPrice;

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
        quantity: item.quantity,
        isInCart: true, // This product is in cart
        // Pricing details
        pricing: {
          // Cart price (current price in cart - selected plan price)
          cartPrice: {
            currency: cartPrice.currency,
            amount: cartPrice.amount,
            taxRate: cartPrice.taxRate,
            totalAmount: Math.round(
              (cartPrice.amount + cartPrice.taxRate) * 100
            ) / 100,
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
            totalAmount: Math.round(
              (originalPrice.amount + originalPrice.taxRate) * 100
            ) / 100,
          },
          // Member price (only if user is a member)
          memberPrice: memberPrice
            ? {
                currency: memberPrice.currency,
                amount: memberPrice.amount,
                taxRate: memberPrice.taxRate,
                totalAmount: Math.round(
                  (memberPrice.amount + memberPrice.taxRate) * 100
                ) / 100,
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
          // Variant pricing (if applicable)
          variantPricing: variant
            ? {
                price: variant.price,
                compareAtPrice: variant.compareAtPrice,
                costPrice: variant.costPrice,
              }
            : null,
        },
        // Product details
        categories: product.categories || [],
        ingredients: product.ingredients || [],
        variant: variant
          ? {
              _id: variant._id,
              name: variant.name,
              sku: variant.sku,
              attributes: variant.attributes,
            }
          : null,
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
    // taxRate is now a direct amount per item, so multiply by quantity
    let taxAmount = 0;
    cart.items.forEach((item: any) => {
      taxAmount += (item.price.taxRate || 0) * item.quantity;
    });

    validProducts.forEach((product: any) => {
      const originalItemTotal =
        product.pricing.originalPrice.amount * product.quantity;
      originalSubtotal += originalItemTotal;

      // Only apply member pricing if user is actually a member
      // Check if memberPrice exists AND discount amount > 0 (indicating member discount was applied)
      const hasMemberDiscount =
        product.pricing.memberPrice &&
        product.pricing.discount &&
        product.pricing.discount.amount > 0;

      const memberItemTotal = hasMemberDiscount
        ? product.pricing.memberPrice.amount * product.quantity
        : originalItemTotal;
      memberSubtotal += memberItemTotal;

      if (hasMemberDiscount) {
        membershipDiscountAmount +=
          (product.pricing.originalPrice.amount -
            product.pricing.memberPrice.amount) *
          product.quantity;
      }
    });
    const shippingAmount = cart.shipping?.amount || 0;
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
      .populate("categories", "sId slug name description sortOrder icon image productCount")
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
        .populate("categories", "sId slug name description sortOrder icon image productCount")
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
