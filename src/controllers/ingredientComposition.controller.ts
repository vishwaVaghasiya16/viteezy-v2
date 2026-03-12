import { Request, Response } from "express";
import { ingredientCompositionService } from "../services/ingredientComposition.service";
import { logger } from "../utils/logger";
import { validationResult } from "express-validator";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

export class IngredientCompositionController {
  /**
   * Create a new ingredient composition
   */
  async createComposition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
        return;
      }

      const { product, ingredient, quantity, driPercentage } = req.body;
      const userId = req.user?._id;

      const composition = await ingredientCompositionService.createIngredientComposition({
        product,
        ingredient,
        quantity,
        driPercentage,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        message: "Ingredient composition created successfully",
        data: composition,
      });
    } catch (error: any) {
      logger.error("Error in createComposition:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create ingredient composition",
      });
    }
  }

  /**
   * Get all ingredient compositions
   */
  async getCompositions(req: Request, res: Response): Promise<void> {
    try {
      const {
        product,
        ingredient,
        page = "1",
        limit = "10",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;

      const result = await ingredientCompositionService.getIngredientCompositions({
        product: product as string,
        ingredient: ingredient as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      });

      res.json({
        success: true,
        message: "Ingredient compositions retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      logger.error("Error in getCompositions:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve ingredient compositions",
      });
    }
  }

  /**
   * Get ingredient composition by ID
   */
  async getCompositionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const composition = await ingredientCompositionService.getCompositionById(id);

      res.json({
        success: true,
        message: "Ingredient composition retrieved successfully",
        data: composition,
      });
    } catch (error: any) {
      logger.error("Error in getCompositionById:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Ingredient composition not found",
      });
    }
  }

  /**
   * Get all ingredient compositions for a specific product
   */
  async getCompositionsByProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;

      const compositions = await ingredientCompositionService.getCompositionsByProduct(productId);

      res.json({
        success: true,
        message: "Product ingredient compositions retrieved successfully",
        data: compositions,
      });
    } catch (error: any) {
      logger.error("Error in getCompositionsByProduct:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Failed to retrieve product ingredient compositions",
      });
    }
  }

  /**
   * Update an ingredient composition
   */
  async updateComposition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
        return;
      }

      const { id } = req.params;
      const { quantity, driPercentage } = req.body;
      const userId = req.user?._id;

      const composition = await ingredientCompositionService.updateIngredientComposition(id, {
        quantity,
        driPercentage,
        updatedBy: userId,
      });

      res.json({
        success: true,
        message: "Ingredient composition updated successfully",
        data: composition,
      });
    } catch (error: any) {
      logger.error("Error in updateComposition:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update ingredient composition",
      });
    }
  }

  /**
   * Delete an ingredient composition
   */
  async deleteComposition(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?._id;

      await ingredientCompositionService.deleteIngredientComposition(id, userId);

      res.json({
        success: true,
        message: "Ingredient composition deleted successfully",
      });
    } catch (error: any) {
      logger.error("Error in deleteComposition:", error);
      res.status(404).json({
        success: false,
        message: error.message || "Failed to delete ingredient composition",
      });
    }
  }

  /**
   * Bulk update ingredient compositions for a product
   */
  async bulkUpdateCompositions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
        return;
      }

      const { productId } = req.params;
      const { compositions } = req.body;
      const userId = req.user?._id;

      const result = await ingredientCompositionService.bulkUpdateCompositions(
        productId,
        compositions,
        userId
      );

      res.json({
        success: true,
        message: "Ingredient compositions bulk updated successfully",
        data: result,
      });
    } catch (error: any) {
      logger.error("Error in bulkUpdateCompositions:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to bulk update ingredient compositions",
      });
    }
  }
}

export const ingredientCompositionController = new IngredientCompositionController();
