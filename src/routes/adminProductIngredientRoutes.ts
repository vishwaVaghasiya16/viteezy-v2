import { Router } from "express";
import { adminProductIngredientController } from "@/controllers/adminProductIngredientController";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import {
  createProductIngredientSchema,
  updateProductIngredientSchema,
  productIngredientIdParamsSchema,
  listProductIngredientQuerySchema,
} from "@/validation/productIngredientValidation";

const router = Router();

// Require admin auth for all ingredient routes
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * POST /api/v1/admin/product-ingredients
 * Create a new ingredient entry with products, name, description (HTML), and image.
 * @body {String} name - Ingredient name in English (plain string, will be auto-translated to all languages)
 * @body {String} [description] - Ingredient description in English (plain string, will be auto-translated to all languages)
 */
router.post(
  "/",
  handleMulterError(upload.single("image"), "image"),
  autoTranslateMiddleware("productIngredients"), // Auto-translate English to all languages - converts plain strings to I18n objects
  validateJoi(createProductIngredientSchema),
  adminProductIngredientController.createIngredient
);

/**
 * GET /api/v1/admin/product-ingredients
 * List ingredients with pagination, search, status filter, and linked count.
 */
router.get(
  "/",
  transformResponseMiddleware("productIngredients"), // Detects language from admin token and transforms I18n fields to single language strings
  validateQuery(listProductIngredientQuerySchema),
  adminProductIngredientController.listIngredients
);

/**
 * GET /api/v1/admin/product-ingredients/:id
 * Fetch full ingredient details plus linked product count by id.
 */
router.get(
  "/:id",
  transformResponseMiddleware("productIngredients"), // Detects language from admin token and transforms I18n fields to single language strings
  validateParams(productIngredientIdParamsSchema),
  adminProductIngredientController.getIngredientById
);

/**
 * PUT /api/v1/admin/product-ingredients/:id
 * Update ingredient fields (name, description, products, image, status).
 * @body {String} [name] - Ingredient name in English (plain string, will be auto-translated to all languages)
 * @body {String} [description] - Ingredient description in English (plain string, will be auto-translated to all languages)
 */
router.put(
  "/:id",
  handleMulterError(upload.single("image"), "image"),
  autoTranslateMiddleware("productIngredients"), // Auto-translate English to all languages - converts plain strings to I18n objects
  validateParams(productIngredientIdParamsSchema),
  validateJoi(updateProductIngredientSchema),
  adminProductIngredientController.updateIngredient
);

/**
 * DELETE /api/v1/admin/product-ingredients/:id
 * Soft delete ingredient if it is not linked to any product.
 */
router.delete(
  "/:id",
  validateParams(productIngredientIdParamsSchema),
  adminProductIngredientController.deleteIngredient
);

export default router;
