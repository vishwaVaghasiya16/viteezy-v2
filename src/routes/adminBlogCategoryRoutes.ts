import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminBlogCategoryController } from "@/controllers/adminBlogCategoryController";
import {
  createBlogCategorySchema,
  updateBlogCategorySchema,
  blogCategoryIdParamsSchema,
} from "@/validation/blogCategoryValidation";
import { paginationQuerySchema } from "../validation/commonValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/blog-categories
 * @desc Create a new blog category
 * @access Admin
 * @body {Object} title - I18n object with en (required) and nl (optional) fields
 * @body {String} [slug] - Optional slug (auto-generated from title if not provided)
 * @body {Number} [sortOrder] - Optional sort order (default: 0)
 * @body {Boolean} [isActive] - Optional active status (default: true)
 */
router.post(
  "/",
  validateJoi(createBlogCategorySchema),
  adminBlogCategoryController.createCategory
);

/**
 * @route GET /api/v1/admin/blog-categories
 * @desc Get paginated list of blog categories
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by title or slug
 * @query {String} [status] - Filter by status: "active", "inactive", or "all"
 */
router.get(
  "/",
  validateQuery(paginationQuerySchema),
  adminBlogCategoryController.getCategories
);

/**
 * @route GET /api/v1/admin/blog-categories/:id
 * @desc Get blog category by ID
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(blogCategoryIdParamsSchema),
  adminBlogCategoryController.getCategoryById
);

/**
 * @route PUT /api/v1/admin/blog-categories/:id
 * @desc Update blog category
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 * @body {Object} [title] - I18n object with en and nl fields
 * @body {String} [slug] - Optional slug (auto-regenerated if title changes)
 * @body {Number} [sortOrder] - Optional sort order
 * @body {Boolean} [isActive] - Optional active status
 */
router.put(
  "/:id",
  validateParams(blogCategoryIdParamsSchema),
  validateJoi(updateBlogCategorySchema),
  adminBlogCategoryController.updateCategory
);

/**
 * @route DELETE /api/v1/admin/blog-categories/:id
 * @desc Delete blog category (soft delete)
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 * @note Cannot delete if blogs are assigned to this category
 */
router.delete(
  "/:id",
  validateParams(blogCategoryIdParamsSchema),
  adminBlogCategoryController.deleteCategory
);

export default router;
