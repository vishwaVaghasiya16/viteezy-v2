import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminProductFaqController } from "@/controllers/adminProductFaqController";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import {
  createProductFaqSchema,
  updateProductFaqSchema,
  productFaqIdParamsSchema,
  getProductFaqsSchema,
  productIdParamsSchema,
} from "@/validation/adminProductFaqValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/product-faqs
 * @desc Create a new product FAQ
 * @access Admin
 * @body {String} question - FAQ question in English (plain string, will be auto-translated to all languages)
 * @body {String} [answer] - FAQ answer in English (plain string, will be auto-translated to all languages)
 */
router.post(
  "/",
  autoTranslateMiddleware("productFaqs"), // Auto-translate English to all languages - converts plain strings to I18n objects
  validateJoi(createProductFaqSchema),
  adminProductFaqController.createProductFaq
);

/**
 * @route GET /api/v1/admin/product-faqs
 * @desc Get paginated list of all product FAQs (Admin view)
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [productId] - Filter by product ID
 * @query {String} [search] - Search by question or answer
 * @query {String} [status] - Filter by status: "Active" or "Inactive"
 * @query {Boolean} [isActive] - Filter by active status
 */
router.get(
  "/",
  transformResponseMiddleware("productFaqs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateQuery(getProductFaqsSchema),
  adminProductFaqController.getProductFaqs
);

/**
 * @route GET /api/v1/admin/product-faqs/product/:productId
 * @desc Get all FAQs for a specific product
 * @access Admin
 * @param {String} productId - Product ID (MongoDB ObjectId)
 */
router.get(
  "/product/:productId",
  transformResponseMiddleware("productFaqs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateParams(productIdParamsSchema),
  adminProductFaqController.getProductFaqsByProductId
);

/**
 * @route GET /api/v1/admin/product-faqs/:id
 * @desc Get product FAQ by ID
 * @access Admin
 * @param {String} id - Product FAQ ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  transformResponseMiddleware("productFaqs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateParams(productFaqIdParamsSchema),
  adminProductFaqController.getProductFaqById
);

/**
 * @route PUT /api/v1/admin/product-faqs/:id
 * @desc Update product FAQ
 * @access Admin
 * @body {String} [question] - FAQ question in English (plain string, will be auto-translated to all languages)
 * @body {String} [answer] - FAQ answer in English (plain string, will be auto-translated to all languages)
 */
router.put(
  "/:id",
  validateParams(productFaqIdParamsSchema),
  autoTranslateMiddleware("productFaqs"), // Auto-translate English to all languages - converts plain strings to I18n objects
  validateJoi(updateProductFaqSchema),
  adminProductFaqController.updateProductFaq
);

/**
 * @route DELETE /api/v1/admin/product-faqs/:id
 * @desc Delete product FAQ (soft delete)
 * @access Admin
 * @param {String} id - Product FAQ ID (MongoDB ObjectId)
 */
router.delete(
  "/:id",
  validateParams(productFaqIdParamsSchema),
  adminProductFaqController.deleteProductFaq
);

export default router;
