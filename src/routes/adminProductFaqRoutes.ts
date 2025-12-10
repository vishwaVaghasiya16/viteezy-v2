import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminProductFaqController } from "@/controllers/adminProductFaqController";
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
 */
router.post(
  "/",
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
  validateParams(productFaqIdParamsSchema),
  adminProductFaqController.getProductFaqById
);

/**
 * @route PUT /api/v1/admin/product-faqs/:id
 * @desc Update product FAQ
 * @access Admin
 */
router.put(
  "/:id",
  validateParams(productFaqIdParamsSchema),
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
