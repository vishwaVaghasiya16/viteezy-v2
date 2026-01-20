import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { adminHeaderBannerController } from "@/controllers/adminHeaderBannerController";
import {
  createHeaderBannerSchema,
  updateHeaderBannerSchema,
  headerBannerIdParamsSchema,
  getAllHeaderBannersQuerySchema,
} from "@/validation/adminHeaderBannerValidation";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route   POST /api/v1/admin/header-banners
 * @desc    Create header banner (Admin only)
 * @access  Private (Admin)
 * @body    {String} text - Banner text in English only (simple string, not I18n object)
 * @body    {String} deviceType - Device type (WEB or MOBILE)
 * @body    {Boolean} [isActive] - Active status (default: false)
 * @note    Auto-translate middleware will convert English text to all supported languages (en, nl, de, fr, es) and store in database
 */
router.post(
  "/",
  autoTranslateMiddleware("headerBanners"), // Auto-translate English to all languages
  validateJoi(createHeaderBannerSchema),
  adminHeaderBannerController.createHeaderBanner
);

/**
 * @route   GET /api/v1/admin/header-banners
 * @desc    Get all header banners with pagination and filters (Admin only)
 * @access  Private (Admin)
 * @query   {Number} [page] - Page number (default: 1)
 * @query   {Number} [limit] - Items per page (default: 10)
 * @query   {String} [search] - Search by text in any language
 * @query   {String} [deviceType] - Filter by device type (WEB or MOBILE)
 * @query   {Boolean} [isActive] - Filter by active status
 * @note    Returns full I18n object (all languages stored) - no translation middleware
 */
router.get(
  "/",
  validateQuery(getAllHeaderBannersQuerySchema),
  adminHeaderBannerController.getAllHeaderBanners
);

/**
 * @route   GET /api/v1/admin/header-banners/:id
 * @desc    Get header banner by ID (Admin only)
 * @access  Private (Admin)
 * @note    Returns full I18n object (all languages stored) - no translation middleware
 */
router.get(
  "/:id",
  validateParams(headerBannerIdParamsSchema),
  adminHeaderBannerController.getHeaderBannerById
);

/**
 * @route   PUT /api/v1/admin/header-banners/:id
 * @desc    Update header banner (Admin only)
 * @access  Private (Admin)
 * @body    {String} [text] - I18n text object (JSON string or object)
 * @body    {String} [deviceType] - Device type (WEB or MOBILE)
 * @body    {Boolean} [isActive] - Active status
 */
router.put(
  "/:id",
  autoTranslateMiddleware("headerBanners"), // Auto-translate English to all languages
  validateParams(headerBannerIdParamsSchema),
  validateJoi(updateHeaderBannerSchema),
  adminHeaderBannerController.updateHeaderBanner
);

/**
 * @route   PATCH /api/v1/admin/header-banners/:id/toggle-status
 * @desc    Toggle header banner active status (Admin only)
 * @access  Private (Admin)
 */
router.patch(
  "/:id/toggle-status",
  validateParams(headerBannerIdParamsSchema),
  adminHeaderBannerController.toggleHeaderBannerStatus
);

/**
 * @route   DELETE /api/v1/admin/header-banners/:id
 * @desc    Delete header banner (Admin only) - Soft delete
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  validateParams(headerBannerIdParamsSchema),
  adminHeaderBannerController.deleteHeaderBanner
);

export default router;

