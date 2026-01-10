import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { adminBlogController } from "@/controllers/adminBlogController";
import {
  createBlogSchema,
  updateBlogSchema,
  blogIdParamsSchema,
  updateBlogStatusSchema,
} from "@/validation/blogValidation";
import { paginationQuerySchema } from "../validation/commonValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/blogs
 * @desc Create a new blog post
 * @access Admin
 */
router.post(
  "/",
  handleMulterError(upload.single("coverImage"), "cover image"),
  autoTranslateMiddleware("blogs"), // Auto-translate English to all languages
  validateJoi(createBlogSchema),
  adminBlogController.createBlog
);

/**
 * @route GET /api/v1/admin/blogs
 * @desc Get paginated list of all blogs (Admin view)
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by title, slug, or tags
 * @query {String} [status] - Filter by status: "Draft" or "Published"
 * @query {String} [categoryId] - Filter by category ID
 * @note Response is automatically transformed based on admin's language preference from token.
 *       I18n objects are converted to single language strings (no object structure in response).
 *       Both blogs and blogBanners are transformed.
 */
router.get(
  "/",
  transformResponseMiddleware("blogs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateQuery(paginationQuerySchema),
  adminBlogController.getBlogs
);

/**
 * @route GET /api/v1/admin/blogs/:id
 * @desc Get blog by ID
 * @access Admin
 * @param {String} id - Blog ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  transformResponseMiddleware("blogs"), // Transform response based on user language
  validateParams(blogIdParamsSchema),
  adminBlogController.getBlogById
);

/**
 * @route PUT /api/v1/admin/blogs/:id
 * @desc Update blog post
 * @access Admin
 * @contentType multipart/form-data
 */
router.put(
  "/:id",
  handleMulterError(upload.single("coverImage"), "cover image"),
  autoTranslateMiddleware("blogs"), // Auto-translate English to all languages
  validateParams(blogIdParamsSchema),
  validateJoi(updateBlogSchema),
  adminBlogController.updateBlog
);

/**
 * @route PATCH /api/v1/admin/blogs/:id/status
 * @desc Update blog status (publish/unpublish)
 * @access Admin
 * @param {String} id - Blog ID (MongoDB ObjectId)
 * @body {String} status - Blog status: "Draft" or "Published"
 * @body {Date} [publishedAt] - Optional publication date
 */
router.patch(
  "/:id/status",
  validateParams(blogIdParamsSchema),
  validateJoi(updateBlogStatusSchema),
  adminBlogController.updateBlogStatus
);

/**
 * @route DELETE /api/v1/admin/blogs/:id
 * @desc Delete blog post (soft delete)
 * @access Admin
 * @param {String} id - Blog ID (MongoDB ObjectId)
 * @note Deletes cover image from cloud storage if exists
 */
router.delete(
  "/:id",
  validateParams(blogIdParamsSchema),
  adminBlogController.deleteBlog
);

export default router;
