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
import { paginationQuerySchema } from "../validation/commonValidation";

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
 * @desc Get paginated list of FAQs
 * @access Admin
 */
router.get(
  "/",
  transformResponseMiddleware("faqs"), // Detects language from admin token and transforms I18n fields to single language strings
  validateQuery(paginationQuerySchema),
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
