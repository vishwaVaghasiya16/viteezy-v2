import { Router } from "express";
import { productIngredientController } from "@/controllers/productIngredientController";
import { validateParams, validateQuery } from "@/middleware/joiValidation";
import { optionalAuth } from "@/middleware/auth";
import Joi from "joi";

const router = Router();

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const ingredientIdParamsSchema = Joi.object({
  id: Joi.string().pattern(objectIdPattern).required().label("Ingredient id"),
});

const productIdParamsSchema = Joi.object({
  productId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .label("Product id"),
});

const listIngredientsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().label("Page"),
  limit: Joi.number().integer().min(1).max(100).optional().label("Limit"),
  sort: Joi.string().optional().label("Sort field"),
  order: Joi.string().valid("asc", "desc").optional().label("Sort order"),
  search: Joi.string().trim().allow("", null).label("Search"),
  productId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .label("Product ID"),
});

/**
 * @route GET /api/v1/product-ingredients
 * @desc Get all active product ingredients (public)
 * @access Public
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by name or description
 * @query {String} [productId] - Filter by product ID
 */
router.get(
  "/",
  optionalAuth,
  validateQuery(listIngredientsQuerySchema),
  productIngredientController.getIngredients
);

/**
 * @route GET /api/v1/product-ingredients/:id
 * @desc Get product ingredient by ID (public)
 * @access Public (optional auth for language detection)
 * @param {String} id - Ingredient ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  optionalAuth,
  validateParams(ingredientIdParamsSchema),
  productIngredientController.getIngredientById
);

/**
 * @route GET /api/v1/product-ingredients/product/:productId
 * @desc Get all ingredients for a specific product (public)
 * @access Public (optional auth for language detection)
 * @param {String} productId - Product ID (MongoDB ObjectId)
 */
router.get(
  "/product/:productId",
  optionalAuth,
  validateParams(productIdParamsSchema),
  productIngredientController.getIngredientsByProductId
);

export default router;
