/**
 * @fileoverview Blog Routes
 * @description Routes for blog-related operations
 * @module routes/blogRoutes
 */

import { Router } from "express";
import { authMiddleware } from "@/middleware/auth";
import { BlogController } from "@/controllers/blogController";
import { validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  getBlogsSchema,
  getBlogDetailsSchema,
  getPopularBlogsSchema,
  incrementBlogViewsSchema,
  getBlogCategoriesQuerySchema,
} from "@/validation/blogValidation";

const router = Router();

/**
 * Protected Routes (Authentication Required)
 * User must be logged in to access blogs
 * Language is automatically detected from user's profile preference
 */

// Get list of blog categories (authenticated users only)
router.get(
  "/categories/list",
  authMiddleware,
  validateQuery(getBlogCategoriesQuerySchema),
  BlogController.getBlogCategories
);

// Get popular or latest blogs (top 3-5) - authenticated users only
router.get(
  "/popular/list",
  authMiddleware,
  validateQuery(getPopularBlogsSchema),
  BlogController.getPopularBlogs
);

// Get paginated list of blogs with filters - authenticated users only
router.get(
  "/",
  authMiddleware,
  validateQuery(getBlogsSchema),
  BlogController.getBlogs
);

// Get blog details by slug or ID - authenticated users only
router.get(
  "/:slugOrId",
  authMiddleware,
  validateParams(getBlogDetailsSchema),
  BlogController.getBlogDetails
);

// Increment blog view count - authenticated users only
router.post(
  "/:slugOrId/increment-views",
  authMiddleware,
  validateParams(incrementBlogViewsSchema),
  BlogController.incrementBlogViews
);

export default router;
