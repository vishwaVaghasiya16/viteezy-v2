import { Router } from "express";
import { adminProductIngredientController } from "@/controllers/adminProductIngredientController";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
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
 */
router.post(
  "/",
  handleMulterError(upload.single("image"), "image"),
  validateJoi(createProductIngredientSchema),
  adminProductIngredientController.createIngredient
);

/**
 * GET /api/v1/admin/product-ingredients
 * List ingredients with pagination, search, status filter, and linked count.
 */
router.get(
  "/",
  validateQuery(listProductIngredientQuerySchema),
  adminProductIngredientController.listIngredients
);

/**
 * GET /api/v1/admin/product-ingredients/:id
 * Fetch full ingredient details plus linked product count by id.
 */
router.get(
  "/:id",
  validateParams(productIngredientIdParamsSchema),
  adminProductIngredientController.getIngredientById
);

/**
 * PUT /api/v1/admin/product-ingredients/:id
 * Update ingredient fields (name, description, products, image, status).
 */
router.put(
  "/:id",
  handleMulterError(upload.single("image"), "image"),
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
