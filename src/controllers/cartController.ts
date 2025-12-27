import { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cartService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import {
  I18nStringType,
  I18nTextType,
  DEFAULT_LANGUAGE,
  SupportedLanguage,
} from "../models/common.model";
import { User } from "../models/core";

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
const getUserLanguage = async (
  req: AuthenticatedRequest,
  userId: string
): Promise<SupportedLanguage> => {
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
  }

  // Fetch user language from database if not in request
  try {
    const user = await User.findById(userId).select("language").lean();
    if (user?.language) {
      return mapLanguageToCode(user.language);
    }
  } catch (error) {
    // If user not found or error, default to English
  }

  return DEFAULT_LANGUAGE;
};

export class CartController {
  /**
   * Get user's cart
   */
  static async getCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const userLang = await getUserLanguage(req, userId);
      const includeSuggested = req.query.includeSuggested !== "false"; // Default true
      const result = await cartService.getCart(
        userId,
        includeSuggested,
        userLang
      );

      res.status(200).json({
        success: true,
        message: "Cart retrieved successfully",
        data: {
          cart: result.cart,
          ...(result.suggestedProducts && {
            suggestedProducts: result.suggestedProducts,
          }),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add item to cart
   */
  static async addItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await cartService.addItem(userId, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cart item by productId
   */
  static async updateItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const { productId } = req.body;

      if (!productId) {
        throw new AppError("productId is required", 400);
      }

      const result = await cartService.updateItem(userId, {
        productId,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove item from cart by productId
   */
  static async removeItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const { productId } = req.body;

      if (!productId) {
        throw new AppError("productId is required", 400);
      }

      const result = await cartService.removeItem(userId, {
        productId,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clear cart
   */
  static async clearCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await cartService.clearCart(userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate cart and calculate member pricing
   */
  static async validateCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await cartService.validateCart(userId);

      res.status(200).json({
        success: true,
        message: result.isValid
          ? "Cart validation successful"
          : "Cart validation failed",
        data: {
          isValid: result.isValid,
          errors: result.errors,
          cart: result.cart,
          pricing: result.pricing,
          items: result.items,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get suggested products (non-included products) for cart
   */
  static async getSuggestedProducts(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const userLang = await getUserLanguage(req, userId);
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const suggestedProducts = await cartService.getSuggestedProducts(
        userId,
        limit,
        userLang
      );

      res.status(200).json({
        success: true,
        message: "Suggested products retrieved successfully",
        data: {
          products: suggestedProducts,
          count: suggestedProducts.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply coupon to cart
   */
  static async applyCoupon(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const { couponCode } = req.body;

      if (!couponCode) {
        throw new AppError("Coupon code is required", 400);
      }

      const result = await cartService.applyCoupon(userId, couponCode);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
          couponDiscountAmount: result.couponDiscountAmount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove coupon from cart
   */
  static async removeCoupon(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await cartService.removeCoupon(userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
