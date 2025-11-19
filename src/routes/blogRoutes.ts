/**
 * @fileoverview Blog Routes
 * @description Routes for blog-related operations
 * @module routes/blogRoutes
 */

import { Router } from "express";
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
 * Public Routes (No Authentication Required)
 * These routes are accessible without authentication token
 */

// Get list of blog categories
router.get(
  "/categories/list",
  validateQuery(getBlogCategoriesQuerySchema),
  BlogController.getBlogCategories
);

// Get popular or latest blogs (top 3-5)
router.get(
  "/popular/list",
  validateQuery(getPopularBlogsSchema),
  BlogController.getPopularBlogs
);

// Get paginated list of blogs with filters
router.get("/", validateQuery(getBlogsSchema), BlogController.getBlogs);

// Get blog details by slug or ID
router.get(
  "/:slugOrId",
  validateParams(getBlogDetailsSchema),
  BlogController.getBlogDetails
);

// Increment blog view count
router.post(
  "/:slugOrId/increment-views",
  validateParams(incrementBlogViewsSchema),
  BlogController.incrementBlogViews
);

export default router;
