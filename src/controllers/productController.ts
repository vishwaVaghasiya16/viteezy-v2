import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { productService } from "../services/productService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { getPaginationOptions, getPaginationMeta } from "../utils/pagination";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
}

export class ProductController {
  /**
   * Create new product
   */
  static async createProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id || req.userId;
      const result = await productService.createProduct({
        ...req.body,
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all products with pagination
   */
  static async getAllProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, status, variant, hasStandupPouch } = req.query;

      const result = await productService.getAllProducts(page, limit, skip, sort, {
        search: search as string,
        status: status as any,
        variant: variant as any,
        hasStandupPouch:
          hasStandupPouch !== undefined ? hasStandupPouch === "true" : undefined,
      });

      const pagination = getPaginationMeta(page, limit, result.total);

      res.status(200).json({
        success: true,
        message: "Products retrieved successfully",
        data: result.products,
        pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by ID
   */
  static async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.getProductById(id);

      res.status(200).json({
        success: true,
        message: "Product retrieved successfully",
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product by slug
   */
  static async getProductBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const result = await productService.getProductBySlug(slug);

      res.status(200).json({
        success: true,
        message: "Product retrieved successfully",
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update product
   */
  static async updateProduct(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || req.userId;

      const result = await productService.updateProduct(id, {
        ...req.body,
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          product: result.product,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete product
   */
  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await productService.deleteProduct(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get product statistics
   */
  static async getProductStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await productService.getProductStats();

      res.status(200).json({
        success: true,
        message: "Product statistics retrieved successfully",
        data: {
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

