import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminProductCategoryController } from "@/controllers/adminProductCategoryController";
import {
  createProductCategorySchema,
  updateProductCategorySchema,
  productCategoryIdParamsSchema,
  getProductCategoriesQuerySchema,
} from "@/validation/adminProductCategoryValidation";
import {
  categoryImageUpload,
  handleCategoryImageUploadError,
} from "@/middleware/categoryImageUpload";
import { parseFormDataJson } from "@/middleware/parseFormData";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/product-categories
 * @desc Create a new product category
 * @access Admin
 * @body {Object} name - I18n object with en (required) and nl (optional)
 * @body {String} [slug] - Optional slug (auto-generated from name if not provided)
 * @body {Object} [description] - I18n description object
 * @body {Number} [sortOrder] - Optional sort order (default: 0)
 * @body {File} [icon] - Optional icon file (multipart/form-data)
 * @body {File} [image] - Optional image file (multipart/form-data)
 * @body {String} [image] - Optional image object as JSON string (if not uploading file)
 * @body {Object} [seo] - Optional SEO object (as JSON string in form-data)
 * @body {Boolean} [isActive] - Optional active status (default: true)
 */
router.post(
  "/",
  handleCategoryImageUploadError(
    categoryImageUpload.fields([
      { name: "icon", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ])
  ),
  parseFormDataJson(["name", "description", "seo", "image"]),
  validateJoi(createProductCategorySchema),
  adminProductCategoryController.createCategory
);

/**
 * @route GET /api/v1/admin/product-categories
 * @desc Get paginated list of product categories
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search by name or slug
 * @query {Boolean} [isActive] - Filter by active status
 */
router.get(
  "/",
  validateQuery(getProductCategoriesQuerySchema),
  adminProductCategoryController.getProductCategory
);

/**
 * @route GET /api/v1/admin/product-categories/:id
 * @desc Get product category by ID
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(productCategoryIdParamsSchema),
  adminProductCategoryController.getCategoryById
);

/**
 * @route PUT /api/v1/admin/product-categories/:id
 * @desc Update product category
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 * @body {Object} [name] - I18n object with en and nl fields (as JSON string in form-data)
 * @body {String} [slug] - Optional slug (auto-regenerated if name changes)
 * @body {Object} [description] - I18n description object (as JSON string in form-data)
 * @body {Number} [sortOrder] - Optional sort order
 * @body {File} [icon] - Optional icon file (multipart/form-data)
 * @body {File} [image] - Optional image file (multipart/form-data)
 * @body {String} [image] - Optional image object as JSON string (if not uploading file)
 * @body {Object} [seo] - Optional SEO object (as JSON string in form-data)
 * @body {Boolean} [isActive] - Optional active status
 */
router.put(
  "/:id",
  validateParams(productCategoryIdParamsSchema),
  handleCategoryImageUploadError(
    categoryImageUpload.fields([
      { name: "icon", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ])
  ),
  parseFormDataJson(["name", "description", "seo", "image"]),
  validateJoi(updateProductCategorySchema),
  adminProductCategoryController.updateCategory
);

/**
 * @route DELETE /api/v1/admin/product-categories/:id
 * @desc Delete product category (soft delete)
 * @access Admin
 * @param {String} id - Category ID (MongoDB ObjectId)
 * @note Cannot delete if products are assigned
 */
router.delete(
  "/:id",
  validateParams(productCategoryIdParamsSchema),
  adminProductCategoryController.deleteCategory
);

export default router;
