import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { adminBlogBannerController } from "@/controllers/adminBlogBannerController";
import {
  createBlogBannerSchema,
  updateBlogBannerSchema,
  blogBannerIdParamsSchema,
  getAllBlogBannersQuerySchema,
} from "@/validation/adminBlogBannerValidation";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route   POST /api/v1/admin/blog-banners
 * @desc    Create blog banner (Admin only)
 * @access  Private (Admin)
 * @contentType multipart/form-data
 * @formData {File} [banner_image] - Banner image file
 * @formData {String} [heading] - I18n heading object (JSON string)
 * @formData {String} [description] - I18n description object (JSON string)
 */
router.post(
  "/",
  handleMulterError(upload.single("banner_image"), "banner image"),
  validateJoi(createBlogBannerSchema),
  adminBlogBannerController.createBlogBanner
);

/**
 * @route   GET /api/v1/admin/blog-banners
 * @desc    Get all blog banners with pagination and filters (Admin only)
 * @access  Private (Admin)
 * @query   {Number} [page] - Page number (default: 1)
 * @query   {Number} [limit] - Items per page (default: 10)
 * @query   {String} [search] - Search by heading in any language
 */
router.get(
  "/",
  validateQuery(getAllBlogBannersQuerySchema),
  adminBlogBannerController.getAllBlogBanners
);

/**
 * @route   GET /api/v1/admin/blog-banners/:id
 * @desc    Get blog banner by ID (Admin only)
 * @access  Private (Admin)
 */
router.get(
  "/:id",
  validateParams(blogBannerIdParamsSchema),
  adminBlogBannerController.getBlogBannerById
);

/**
 * @route   PUT /api/v1/admin/blog-banners/:id
 * @desc    Update blog banner (Admin only)
 * @access  Private (Admin)
 * @contentType multipart/form-data
 * @formData {File} [banner_image] - Banner image file
 * @formData {String} [heading] - I18n heading object (JSON string)
 * @formData {String} [description] - I18n description object (JSON string)
 */
router.put(
  "/:id",
  handleMulterError(upload.single("banner_image"), "banner image"),
  validateParams(blogBannerIdParamsSchema),
  validateJoi(updateBlogBannerSchema),
  adminBlogBannerController.updateBlogBanner
);

/**
 * @route   DELETE /api/v1/admin/blog-banners/:id
 * @desc    Delete blog banner (Admin only) - Soft delete
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  validateParams(blogBannerIdParamsSchema),
  adminBlogBannerController.deleteBlogBanner
);

export default router;
