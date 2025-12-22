import { type ICart, Carts } from "../models/commerce/carts.model";
import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  calculateMemberPrice,
  ProductPriceSource,
} from "../utils/membershipPrice";
import mongoose from "mongoose";
import { ProductVariant } from "../models/enums";

interface AddCartItemData {
  productId: string;
  variantId?: string;
  quantity: number;
}

interface UpdateCartItemData {
  quantity: number;
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
  private calculateCartTotals(items: CartItemWithDetails[]): {
    subtotal: { currency: string; amount: number; taxRate: number };
    tax: { currency: string; amount: number; taxRate: number };
    total: { currency: string; amount: number; taxRate: number };
  } {
    if (items.length === 0) {
      return {
        subtotal: { currency: "EUR", amount: 0, taxRate: 0 },
        tax: { currency: "EUR", amount: 0, taxRate: 0 },
        total: { currency: "EUR", amount: 0, taxRate: 0 },
      };
    }

    // Use currency from first item (assuming all items have same currency)
    const currency = items[0].price.currency;
    const taxRate = items[0].price.taxRate;

    let subtotalAmount = 0;
    items.forEach((item) => {
      subtotalAmount += item.price.amount * item.quantity;
    });

    const taxAmount = subtotalAmount * taxRate;
    const totalAmount = subtotalAmount + taxAmount;

    return {
      subtotal: {
        currency,
        amount: Math.round(subtotalAmount * 100) / 100,
        taxRate,
      },
      tax: { currency, amount: Math.round(taxAmount * 100) / 100, taxRate },
      total: { currency, amount: Math.round(totalAmount * 100) / 100, taxRate },
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
    includeSuggested: boolean = true
  ): Promise<{ cart: any; suggestedProducts?: any[] }> {
    const cart = await this.getOrCreateCart(userId);

    // Populate product and variant details
    const itemsWithDetails: CartItemWithDetails[] = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        const product = await Products.findById(item.productId).lean();
        let variant = null;
        if (item.variantId) {
          variant = await ProductVariants.findById(item.variantId).lean();
        }

        return {
          ...item,
          product,
          variant: variant || undefined,
        };
      })
    );

    const totals = this.calculateCartTotals(itemsWithDetails);

    const result: { cart: any; suggestedProducts?: any[] } = {
      cart: {
        ...cart,
        items: itemsWithDetails,
        ...totals,
      },
    };

    // Include suggested products if requested
    if (includeSuggested) {
      const suggestedProducts = await this.getSuggestedProducts(userId, 10);
      result.suggestedProducts = suggestedProducts;
    }

    return result;
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

    // Calculate totals
    const totals = this.calculateCartTotals(updatedItems);

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
   * Update cart item quantity
   */
  async updateItem(
    userId: string,
    itemIndex: number,
    data: UpdateCartItemData
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);

    if (itemIndex < 0 || itemIndex >= (cart.items || []).length) {
      throw new AppError("Cart item not found", 404);
    }

    const item = cart.items[itemIndex];
    const { quantity } = data;

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

    // Calculate totals
    const totals = this.calculateCartTotals(updatedItems);

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

    logger.info(`Cart item updated for user ${userId}`);

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
    itemIndex: number
  ): Promise<{ cart: any; message: string }> {
    const cart = await this.getOrCreateCart(userId);

    if (itemIndex < 0 || itemIndex >= (cart.items || []).length) {
      throw new AppError("Cart item not found", 404);
    }

    // Remove item
    const updatedItems = [...(cart.items || [])];
    updatedItems.splice(itemIndex, 1);

    // Calculate totals
    const totals = this.calculateCartTotals(updatedItems);

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

    logger.info(`Item removed from cart for user ${userId}`);

    return {
      cart: updatedCart,
      message: "Item removed from cart",
    };
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
    let taxRate = cart.items[0]?.price?.taxRate || 0;

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
          taxRate,
        },
        originalSubtotal: {
          currency,
          amount: Math.round((originalSubtotal + Number.EPSILON) * 100) / 100,
          taxRate,
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
          taxRate,
        },
        shipping: {
          currency,
          amount: Math.round((shippingAmount + Number.EPSILON) * 100) / 100,
          taxRate: 0,
        },
        total: {
          currency,
          amount: Math.round((totalAmount + Number.EPSILON) * 100) / 100,
          taxRate,
        },
      },
      items: validatedItems,
    };
  }

  /**
   * Get suggested products (non-included products) for cart
   * If stand-up pouch is in cart, suggest only stand-up pouch products
   * If sachets are in cart, suggest only sachet products
   */
  async getSuggestedProducts(
    userId: string,
    limit: number = 10
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

    // Fetch suggested products
    const suggestedProducts = await Products.find(query)
      .select(
        "title slug skuRoot productImage price variant sachetPrices standupPouchPrice categories"
      )
      .populate("categories", "name slug")
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    return suggestedProducts;
  }
}

export const cartService = new CartService();
