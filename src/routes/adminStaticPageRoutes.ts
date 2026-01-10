import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminStaticPageController } from "@/controllers/adminStaticPageController";
import {
  createStaticPageSchema,
  updateStaticPageSchema,
  staticPageIdParamsSchema,
  updateStaticPageStatusSchema,
  getStaticPagesSchema,
} from "@/validation/adminStaticPageValidation";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/static-pages
 * @desc Create a new static page
 * @access Admin
 * @note I18n fields (title, content) can be sent as plain strings or I18n objects. Plain strings will be automatically converted to I18n objects.
 */
router.post(
  "/",
  autoTranslateMiddleware("staticPages"), // Converts plain strings to I18n objects for supported fields
  validateJoi(createStaticPageSchema),
  adminStaticPageController.createStaticPage
);

/**
 * @route GET /api/v1/admin/static-pages
 * @desc Get paginated list of all static pages (Admin view)
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by title or slug
 * @query {String} [status] - Filter by status: "Published" or "Unpublished"
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @note I18n fields will be automatically transformed to single language strings based on detected language.
 */
router.get(
  "/",
  validateQuery(getStaticPagesSchema),
  transformResponseMiddleware("staticPages"),
  adminStaticPageController.getStaticPages
);

/**
 * @route GET /api/v1/admin/static-pages/:id
 * @desc Get static page by ID
 * @access Admin
 * @param {String} id - Static page ID (MongoDB ObjectId)
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @note I18n fields will be automatically transformed to single language strings based on detected language.
 */
router.get(
  "/:id",
  validateParams(staticPageIdParamsSchema),
  transformResponseMiddleware("staticPages"),
  adminStaticPageController.getStaticPageById
);

/**
 * @route PUT /api/v1/admin/static-pages/:id
 * @desc Update static page
 * @access Admin
 * @note I18n fields (title, content) can be sent as plain strings or I18n objects. Plain strings will be automatically converted to I18n objects.
 */
router.put(
  "/:id",
  validateParams(staticPageIdParamsSchema),
  autoTranslateMiddleware("staticPages"), // Converts plain strings to I18n objects for supported fields
  validateJoi(updateStaticPageSchema),
  adminStaticPageController.updateStaticPage
);

/**
 * @route PATCH /api/v1/admin/static-pages/:id/status
 * @desc Update static page status (publish/unpublish)
 * @access Admin
 * @param {String} id - Static page ID (MongoDB ObjectId)
 * @body {String} status - Static page status: "Published" or "Unpublished"
 */
router.patch(
  "/:id/status",
  validateParams(staticPageIdParamsSchema),
  validateJoi(updateStaticPageStatusSchema),
  adminStaticPageController.updateStaticPageStatus
);

/**
 * @route DELETE /api/v1/admin/static-pages/:id
 * @desc Delete static page (soft delete)
 * @access Admin
 * @param {String} id - Static page ID (MongoDB ObjectId)
 */
router.delete(
  "/:id",
  validateParams(staticPageIdParamsSchema),
  adminStaticPageController.deleteStaticPage
);

export default router;
