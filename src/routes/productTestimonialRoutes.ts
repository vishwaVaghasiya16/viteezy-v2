import { Router } from "express";
import { productTestimonialController } from "@/controllers/productTestimonialController";
import { validateQuery } from "@/middleware/joiValidation";
import { optionalAuth } from "@/middleware/auth";
import Joi from "joi";

const router = Router();

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const listTestimonialsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().label("Page"),
  limit: Joi.number().integer().min(1).max(100).optional().label("Limit"),
  sort: Joi.string().optional().label("Sort field"),
  order: Joi.string().valid("asc", "desc").optional().label("Sort order"),
  productId: Joi.string()
    .pattern(objectIdPattern)
    .optional()
    .label("Product ID"),
  isFeatured: Joi.boolean().optional().label("Filter by featured"),
  isVisibleInLP: Joi.boolean()
    .optional()
    .label("Filter by visible in landing page"),
});

/**
 * @route GET /api/v1/product-testimonials
 * @desc Get all active product testimonials (public)
 * @access Public (optional auth for language detection)
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [productId] - Filter by product ID
 * @query {Boolean} [isFeatured] - Filter by featured flag
 * @query {Boolean} [isVisibleInLP] - Filter by visible in landing page flag
 * @note If isVisibleInLP=true and no testimonials found, returns latest 6 testimonials
 * @note Product titles are returned in user's language preference (detected from token)
 */
router.get(
  "/",
  optionalAuth,
  validateQuery(listTestimonialsQuerySchema),
  productTestimonialController.getTestimonials
);

export default router;
