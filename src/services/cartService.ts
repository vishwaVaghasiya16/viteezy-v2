import { type ICart, Carts } from "../models/commerce/carts.model";
import { Products } from "../models/commerce/products.model";
import { ProductVariants } from "../models/commerce/productVariants.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import mongoose from "mongoose";

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
  stockWarning?: {
    available: number;
    requested: number;
    isLowStock: boolean;
    message: string;
  };
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
      subtotal: { currency, amount: Math.round(subtotalAmount * 100) / 100, taxRate },
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
      status: "Active",
    }).lean();

    if (!product) {
      throw new AppError("Product not found or not available", 404);
    }

    let variant: any = null;
    let price = product.price;
    let availableQuantity = Infinity; // Products without variants have unlimited stock
    let stockWarning: any = undefined;

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
        availableQuantity = variant.inventory.quantity - variant.inventory.reserved;

        // Validate quantity doesn't exceed available stock
        if (!variant.inventory.allowBackorder && requestedQuantity > availableQuantity) {
          throw new AppError(
            `Insufficient stock. Available: ${availableQuantity}, Requested: ${requestedQuantity}`,
            400
          );
        }

        // Generate stock warning if low stock
        if (availableQuantity <= this.LOW_STOCK_THRESHOLD) {
          stockWarning = {
            available: availableQuantity,
            requested: requestedQuantity,
            isLowStock: true,
            message:
              availableQuantity === 0
                ? "This item is out of stock"
                : `Only ${availableQuantity} items available in stock`,
          };
        } else if (requestedQuantity > availableQuantity - this.LOW_STOCK_THRESHOLD) {
          stockWarning = {
            available: availableQuantity,
            requested: requestedQuantity,
            isLowStock: false,
            message: `Low stock warning: Only ${availableQuantity} items remaining`,
          };
        }
      }
    }

    return {
      product,
      variant: variant || undefined,
      price,
      stockWarning,
    };
  }

  /**
   * Get user's cart
   */
  async getCart(userId: string): Promise<{ cart: any; warnings: any[] }> {
    const cart = await this.getOrCreateCart(userId);

    // Populate product and variant details
    const itemsWithDetails: CartItemWithDetails[] = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        const product = await Products.findById(item.productId).lean();
        let variant = null;
        if (item.variantId) {
          variant = await ProductVariants.findById(item.variantId).lean();
        }

        let stockWarning: any = undefined;
        if (variant && variant.inventory.trackQuantity) {
          const available = variant.inventory.quantity - variant.inventory.reserved;
          if (available <= this.LOW_STOCK_THRESHOLD) {
            stockWarning = {
              available,
              requested: item.quantity,
              isLowStock: available === 0,
              message:
                available === 0
                  ? "This item is out of stock"
                  : `Only ${available} items available in stock`,
            };
          }
        }

        return {
          ...item,
          product,
          variant: variant || undefined,
          stockWarning,
        };
      })
    );

    const warnings = itemsWithDetails
      .filter((item) => item.stockWarning)
      .map((item) => ({
        productId: item.productId.toString(),
        variantId: item.variantId?.toString(),
        message: item.stockWarning?.message,
        available: item.stockWarning?.available,
      }));

    const totals = this.calculateCartTotals(itemsWithDetails);

    return {
      cart: {
        ...cart,
        items: itemsWithDetails,
        ...totals,
      },
      warnings,
    };
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string,
    data: AddCartItemData
  ): Promise<{ cart: any; warnings: any[]; message: string }> {
    const { productId, variantId, quantity } = data;

    // Validate and get pricing
    const { product, variant, price, stockWarning } = await this.validateAndGetPricing(
      productId,
      variantId,
      quantity
    );

    const cart = await this.getOrCreateCart(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);
    const variantObjectId = variantId ? new mongoose.Types.ObjectId(variantId) : null;

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item: any) =>
        item.productId.toString() === productId &&
        (variantId ? item.variantId?.toString() === variantId : !item.variantId)
    );

    let updatedItems = [...(cart.items || [])];
    const warnings: any[] = [];

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const existingItem = updatedItems[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;

      // Re-validate stock with new total quantity
      if (variant && variant.inventory.trackQuantity) {
        const available = variant.inventory.quantity - variant.inventory.reserved;
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

    if (stockWarning) {
      warnings.push({
        productId,
        variantId: variantId || null,
        message: stockWarning.message,
        available: stockWarning.available,
      });
    }

    logger.info(`Item added to cart for user ${userId}`);

    return {
      cart: updatedCart,
      warnings,
      message: existingItemIndex >= 0 ? "Cart item quantity updated" : "Item added to cart",
    };
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    userId: string,
    itemIndex: number,
    data: UpdateCartItemData
  ): Promise<{ cart: any; warnings: any[]; message: string }> {
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
        const available = variant.inventory.quantity - variant.inventory.reserved;
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

    // Check for stock warnings
    const warnings: any[] = [];
    if (item.variantId) {
      const variant = await ProductVariants.findById(item.variantId).lean();
      if (variant && variant.inventory.trackQuantity) {
        const available = variant.inventory.quantity - variant.inventory.reserved;
        if (available <= this.LOW_STOCK_THRESHOLD) {
          warnings.push({
            productId: item.productId.toString(),
            variantId: item.variantId.toString(),
            message:
              available === 0
                ? "This item is out of stock"
                : `Only ${available} items available in stock`,
            available,
          });
        }
      }
    }

    logger.info(`Cart item updated for user ${userId}`);

    return {
      cart: updatedCart,
      warnings,
      message: "Cart item updated successfully",
    };
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, itemIndex: number): Promise<{ cart: any; message: string }> {
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
}

export const cartService = new CartService();

