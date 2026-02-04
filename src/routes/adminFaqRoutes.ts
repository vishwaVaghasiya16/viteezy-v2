import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { adminFaqController } from "@/controllers/adminFaqController";
import {
  createFaqSchema,
  updateFaqSchema,
  faqIdParamsSchema,
} from "@/validation/adminFaqValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/faqs
 * @desc Create a new FAQ
 * @access Admin
 */
router.post(
  "/",
  autoTranslateMiddleware("faqs"), // Auto-translate English to all languages
  validateJoi(createFaqSchema),
  adminFaqController.createFaq
);

/**
 * @route GET /api/v1/admin/faqs
 * @desc Get FAQs grouped by category
 * @access Admin
 * @query {String} [status] - Filter by status: "Active", "Inactive", "Draft"
 * @query {String} [search] - Search by question or tags
 * @query {String} [categoryId] - Filter by specific category ID
 * @returns {Object} { categories: Array<{ category: Object, faqs: Array }>, total: Number }
 */
router.get(
  "/",
  transformResponseMiddleware("faqs"), // Detects language from admin token and transforms I18n fields to single language strings
  adminFaqController.getFaqs
);

/**
 * @route GET /api/v1/admin/faqs/:id
 * @desc Get FAQ by ID
 * @access Admin
 */
router.get(
  "/:id",
  transformResponseMiddleware("faqs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateParams(faqIdParamsSchema),
  adminFaqController.getFaqById
);

/**
 * @route PUT /api/v1/admin/faqs/:id
 * @desc Update FAQ
 * @access Admin
 */
router.put(
  "/:id",
  autoTranslateMiddleware("faqs"), // Auto-translate English to all languages
  validateParams(faqIdParamsSchema),
  validateJoi(updateFaqSchema),
  adminFaqController.updateFaq
);

/**
 * @route DELETE /api/v1/admin/faqs/:id
 * @desc Delete FAQ (soft delete)
 * @access Admin
 */
router.delete(
  "/:id",
  validateParams(faqIdParamsSchema),
  adminFaqController.deleteFaq
);

export default router;
