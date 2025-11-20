import { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cartService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

export class CartController {
  /**
   * Get user's cart
   */
  static async getCart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const result = await cartService.getCart(userId);

      res.status(200).json({
        success: true,
        message: "Cart retrieved successfully",
        data: {
          cart: result.cart,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Add item to cart
   */
  static async addItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
          warnings: result.warnings,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update cart item quantity
   */
  static async updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const itemIndex = parseInt(req.params.index, 10);
      if (isNaN(itemIndex)) {
        throw new AppError("Invalid item index", 400);
      }

      const result = await cartService.updateItem(userId, itemIndex, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          cart: result.cart,
          warnings: result.warnings,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove item from cart
   */
  static async removeItem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User authentication required", 401);
      }

      const itemIndex = parseInt(req.params.index, 10);
      if (isNaN(itemIndex)) {
        throw new AppError("Invalid item index", 400);
      }

      const result = await cartService.removeItem(userId, itemIndex);

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
  static async clearCart(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
}

