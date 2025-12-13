import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminFaqCategoryController } from "@/controllers/adminFaqCategoryController";
import {
  createFaqCategorySchema,
  updateFaqCategorySchema,
  faqCategoryIdParamsSchema,
} from "@/validation/adminFaqCategoryValidation";
import { paginationQuerySchema } from "../validation/commonValidation";
import {
  categoryImageUpload,
  handleCategoryImageUploadError,
} from "@/middleware/categoryImageUpload";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/faq-categories
 * @desc Create a new FAQ category
 * @access Admin
 * @body {Object} title - I18n object with en (required) and nl (optional)
 * @body {String} [slug] - Optional slug (auto-generated from title if not provided)
 * @body {File} [icon] - Optional icon file (multipart/form-data)
 * @body {Boolean} [isActive] - Optional active status (default: true)
 */
router.post(
  "/",
  handleCategoryImageUploadError(
    categoryImageUpload.fields([{ name: "icon", maxCount: 1 }])
  ),
  validateJoi(createFaqCategorySchema),
  adminFaqCategoryController.createCategory
);

/**
 * @route GET /api/v1/admin/faq-categories
 * @desc Get paginated list of FAQ categories
 * @access Admin
 */
router.get(
  "/",
  validateQuery(paginationQuerySchema),
  adminFaqCategoryController.getCategories
);

/**
 * @route GET /api/v1/admin/faq-categories/:id
 * @desc Get FAQ category by ID
 * @access Admin
 */
router.get(
  "/:id",
  validateParams(faqCategoryIdParamsSchema),
  adminFaqCategoryController.getCategoryById
);

/**
 * @route PUT /api/v1/admin/faq-categories/:id
 * @desc Update FAQ category
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 * @body {Object} [title] - I18n object with en and nl fields
 * @body {String} [slug] - Optional slug (auto-regenerated if title changes)
 * @body {File} [icon] - Optional icon file (multipart/form-data)
 * @body {Boolean} [isActive] - Optional active status
 */
router.put(
  "/:id",
  validateParams(faqCategoryIdParamsSchema),
  handleCategoryImageUploadError(
    categoryImageUpload.fields([{ name: "icon", maxCount: 1 }])
  ),
  validateJoi(updateFaqCategorySchema),
  adminFaqCategoryController.updateCategory
);

/**
 * @route DELETE /api/v1/admin/faq-categories/:id
 * @desc Delete FAQ category (soft delete)
 * @access Admin
 */
router.delete(
  "/:id",
  validateParams(faqCategoryIdParamsSchema),
  adminFaqCategoryController.deleteCategory
);

export default router;
