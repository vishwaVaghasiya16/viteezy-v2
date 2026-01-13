/**
 * @fileoverview Blog Routes
 * @description Routes for blog-related operations
 * @module routes/blogRoutes
 */

import { Router } from "express";
import { authMiddleware, optionalAuth } from "@/middleware/auth";
import { BlogController } from "@/controllers/blogController";
import { validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  getBlogsSchema,
  getBlogDetailsSchema,
  getBlogDetailsQuerySchema,
  getPopularBlogsSchema,
  incrementBlogViewsSchema,
  getBlogCategoriesQuerySchema,
} from "@/validation/blogValidation";

const router = Router();

/**
 * Blog Routes (Optional Authentication)
 * Language priority: query param > user token > default "en"
 * Most routes support optional authentication - if user is authenticated, their language preference is used
 */

// Get list of blog categories (optional authentication)
router.get(
  "/categories/list",
  optionalAuth,
  validateQuery(getBlogCategoriesQuerySchema),
  BlogController.getBlogCategories
);

// Get popular or latest blogs (top 3-5) - optional authentication
router.get(
  "/popular/list",
  optionalAuth,
  validateQuery(getPopularBlogsSchema),
  BlogController.getPopularBlogs
);

// Get paginated list of blogs with filters - optional authentication
router.get(
  "/",
  optionalAuth,
  validateQuery(getBlogsSchema),
  BlogController.getBlogs
);

// Get blog details by slug or ID - optional authentication
router.get(
  "/:slugOrId",
  optionalAuth,
  validateParams(getBlogDetailsSchema),
  validateQuery(getBlogDetailsQuerySchema),
  BlogController.getBlogDetails
);

// Increment blog view count - authenticated users only
router.post(
  "/:slugOrId/increment-views",
  optionalAuth,
  validateParams(incrementBlogViewsSchema),
  BlogController.incrementBlogViews
);

export default router;
