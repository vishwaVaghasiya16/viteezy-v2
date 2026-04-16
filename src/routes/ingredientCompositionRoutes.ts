import { Router } from "express";
import { IngredientCompositionController } from "../controllers/ingredientComposition.controller";
import { validateRequest } from "../middleware/validation";
import {
  createCompositionSchema,
  updateCompositionSchema,
  bulkUpdateCompositionsSchema,
  listCompositionsQuerySchema,
  objectIdSchema,
} from "../validation/ingredientCompositionValidation";
import { authMiddleware, authorize } from "../middleware/auth";

const router = Router();

/**
 * @route   POST /api/v1/ingredient-compositions
 * @desc    Create a new ingredient composition
 * @access  Private (Admin only)
 */
router.post(
  "/",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.createComposition
);

/**
 * @route   GET /api/v1/ingredient-compositions
 * @desc    Get all ingredient compositions with optional filtering
 * @access  Private (Admin only)
 */
router.get(
  "/",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.getAllCompositions
);

/**
 * @route   GET /api/v1/ingredient-compositions/:id
 * @desc    Get ingredient composition by ID
 * @access  Private (Admin only)
 */
router.get(
  "/:id",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.getCompositionById
);

/**
 * @route   GET /api/v1/ingredient-compositions/product/:productId
 * @desc    Get ingredient compositions by product ID
 * @access  Private (Admin only)
 */
router.get(
  "/product/:productId",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.getCompositionsByProduct
);

/**
 * @route   PUT /api/v1/ingredient-compositions/:id
 * @desc    Update ingredient composition
 * @access  Private (Admin only)
 */
router.put(
  "/:id",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.updateComposition
);

/**
 * @route   DELETE /api/v1/ingredient-compositions/:id
 * @desc    Delete ingredient composition (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  "/:id",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.deleteComposition
);

/**
 * @route   PUT /api/v1/ingredient-compositions/product/:productId/bulk
 * @desc    Bulk update compositions for a product
 * @access  Private (Admin only)
 */
router.put(
  "/product/:productId/bulk",
  authMiddleware,
  authorize("admin"),
  IngredientCompositionController.bulkUpdateCompositions
);

export default router;
