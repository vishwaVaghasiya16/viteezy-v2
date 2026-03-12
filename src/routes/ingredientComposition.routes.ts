import { Router } from "express";
import { ingredientCompositionController } from "../controllers/ingredientComposition.controller";
import { authMiddleware, authorize } from "../middleware/auth";
import { validateJoi, validateParams, validateQuery } from "../middleware/joiValidation";
import { validationResult } from "express-validator";
import {
  createIngredientCompositionValidation,
  updateIngredientCompositionValidation,
  bulkUpdateCompositionsValidation,
  getCompositionByIdValidation,
  getCompositionsByProductValidation,
  getCompositionsQueryValidation,
  deleteCompositionValidation,
} from "../validation/ingredientComposition.validation";

const router = Router();

// Require admin auth for all ingredient composition routes
router.use(authMiddleware);
router.use(authorize("Admin"));

// Custom validation middleware for express-validator
const validateExpress = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }
  next();
};

/**
 * @route   POST /api/ingredient-compositions
 * @desc    Create a new ingredient composition
 * @access  Private (Admin)
 */
router.post(
  "/",
  createIngredientCompositionValidation,
  validateExpress,
  ingredientCompositionController.createComposition
);

/**
 * @route   GET /api/ingredient-compositions
 * @desc    Get all ingredient compositions with filtering and pagination
 * @access  Private (Admin)
 */
router.get(
  "/",
  getCompositionsQueryValidation,
  validateExpress,
  ingredientCompositionController.getCompositions
);

/**
 * @route   GET /api/ingredient-compositions/:id
 * @desc    Get ingredient composition by ID
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  getCompositionByIdValidation,
  validateExpress,
  ingredientCompositionController.getCompositionById
);

/**
 * @route   GET /api/ingredient-compositions/product/:productId
 * @desc    Get all ingredient compositions for a specific product
 * @access  Private (Admin)
 */
router.get(
  "/product/:productId",
  getCompositionsByProductValidation,
  validateExpress,
  ingredientCompositionController.getCompositionsByProduct
);

/**
 * @route   PUT /api/ingredient-compositions/:id
 * @desc    Update an ingredient composition
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  updateIngredientCompositionValidation,
  validateExpress,
  ingredientCompositionController.updateComposition
);

/**
 * @route   DELETE /api/ingredient-compositions/:id
 * @desc    Delete an ingredient composition (soft delete)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  deleteCompositionValidation,
  validateExpress,
  ingredientCompositionController.deleteComposition
);

/**
 * @route   PUT /api/ingredient-compositions/product/:productId/bulk
 * @desc    Bulk update ingredient compositions for a product
 * @access  Private (Admin)
 */
router.put(
  "/product/:productId/bulk",
  bulkUpdateCompositionsValidation,
  validateExpress,
  ingredientCompositionController.bulkUpdateCompositions
);

export default router;
