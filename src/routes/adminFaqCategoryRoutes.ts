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

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/faq-categories
 * @desc Create a new FAQ category
 * @access Admin
 */
router.post(
  "/",
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
 */
router.put(
  "/:id",
  validateParams(faqCategoryIdParamsSchema),
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
