import { Response } from "express";
import { IngredientCompositionService } from "../services/ingredientComposition.service";
import { IIngredientComposition } from "../models/commerce/ingredientComposition.model";
import { ResponseHelper } from "../utils/response";

// Import AuthenticatedRequest from auth middleware
interface AuthenticatedRequest {
  user?: {
    _id: string;
    [key: string]: any;
  };
  params?: any;
  query?: any;
  body?: any;
  [key: string]: any;
}

export class IngredientCompositionController {
  /**
   * Create a new ingredient composition
   */
  static async createComposition(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseHelper.unauthorized(res, "User not authenticated");
      }
      const userId = req.user._id;
      const composition = await IngredientCompositionService.createComposition(
        req.body,
        userId
      );

      return ResponseHelper.created(res, {
        message: "Ingredient composition created successfully",
        data: composition,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to create ingredient composition",
        error: error.error || error,
      });
    }
  }

  /**
   * Get all ingredient compositions with optional filtering
   */
  static async getAllCompositions(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        page = 1,
        limit = 10,
        productId,
        ingredientId,
      } = req.query;

      const result = await IngredientCompositionService.getAllCompositions(
        Number(page),
        Number(limit),
        productId as string,
        ingredientId as string
      );

      return ResponseHelper.paginated(res, result.compositions, {
        page: result.page,
        limit: Number(limit),
        total: result.total,
        pages: result.totalPages,
      }, "Ingredient compositions retrieved successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve ingredient compositions",
        error: error.error || error,
      });
    }
  }

  /**
   * Get ingredient composition by ID
   */
  static async getCompositionById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const composition = await IngredientCompositionService.getCompositionById(id);

      return ResponseHelper.success(res, composition, "Ingredient composition retrieved successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve ingredient composition",
        error: error.error || error,
      });
    }
  }

  /**
   * Get ingredient compositions by product ID
   */
  static async getCompositionsByProduct(req: AuthenticatedRequest, res: Response) {
    try {
      const { productId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await IngredientCompositionService.getCompositionsByProduct(
        productId,
        Number(page),
        Number(limit)
      );

      return ResponseHelper.paginated(res, result.compositions, {
        page: result.page,
        limit: Number(limit),
        total: result.total,
        pages: result.totalPages,
      }, "Product ingredient compositions retrieved successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve product ingredient compositions",
        error: error.error || error,
      });
    }
  }

  /**
   * Update ingredient composition
   */
  static async updateComposition(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseHelper.unauthorized(res, "User not authenticated");
      }
      const { id } = req.params;
      const userId = req.user._id;

      const composition = await IngredientCompositionService.updateComposition(
        id,
        req.body,
        userId
      );

      return ResponseHelper.success(res, composition, "Ingredient composition updated successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to update ingredient composition",
        error: error.error || error,
      });
    }
  }

  /**
   * Delete ingredient composition (soft delete)
   */
  static async deleteComposition(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseHelper.unauthorized(res, "User not authenticated");
      }
      const { id } = req.params;
      const userId = req.user._id;

      const composition = await IngredientCompositionService.deleteComposition(
        id,
        userId
      );

      return ResponseHelper.success(res, composition, "Ingredient composition deleted successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to delete ingredient composition",
        error: error.error || error,
      });
    }
  }

  /**
   * Bulk update compositions for a product
   */
  static async bulkUpdateCompositions(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user) {
        return ResponseHelper.unauthorized(res, "User not authenticated");
      }
      const { productId } = req.params;
      const { compositions } = req.body;
      const userId = req.user._id;

      const result = await IngredientCompositionService.bulkUpdateCompositions(
        productId,
        compositions,
        userId
      );

      return ResponseHelper.success(res, result, "Ingredient compositions bulk updated successfully");
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to bulk update ingredient compositions",
        error: error.error || error,
      });
    }
  }
}
