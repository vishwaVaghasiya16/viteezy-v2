import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import { productReviewController } from "@/controllers/productReviewController";
import {
  productReviewParamsSchema,
  reviewIdParamsSchema,
  createProductReviewSchema,
  updateProductReviewSchema,
} from "@/validation/productReviewValidation";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /products/:productId
 * Add a new product review for a specific product
 * Requires: User must have purchased the product
 * Body: rating, comment (optional)
 */
router.post(
  "/products/:productId",
  validateParams(productReviewParamsSchema),
  validateJoi(createProductReviewSchema),
  productReviewController.addProductReview
);

/**
 * GET /products
 * List all product reviews posted by the authenticated user
 * Returns: Array of reviews with product details attached
 */
router.get("/products", productReviewController.listMyProductReviews);

/**
 * PUT /products/:reviewId
 * Update an existing product review
 * Requires: Review must belong to the authenticated user
 * Body: rating (optional), comment (optional)
 */
router.put(
  "/products/:reviewId",
  validateParams(reviewIdParamsSchema),
  validateJoi(updateProductReviewSchema),
  productReviewController.updateProductReview
);

/**
 * DELETE /products/:reviewId
 * Delete (soft delete) a product review
 * Requires: Review must belong to the authenticated user
 */
router.delete(
  "/products/:reviewId",
  validateParams(reviewIdParamsSchema),
  productReviewController.deleteProductReview
);

export default router;
