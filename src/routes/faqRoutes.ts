import { Router } from "express";
import { FAQController } from "@/controllers/faqController";
import { validateQuery, validateJoi } from "@/middleware/joiValidation";
import { optionalAuth } from "@/middleware/auth";
import {
  getFaqCategoriesQuerySchema,
  getFaqCategoriesBodySchema,
  getFaqsQuerySchema,
  getFaqsBodySchema,
} from "@/validation/faqValidation";

const router = Router();

router.post(
  "/categories/list",
  optionalAuth,
  validateJoi(getFaqCategoriesBodySchema),
  FAQController.getFaqCategories
);

router.post(
  "/",
  optionalAuth,
  validateJoi(getFaqsBodySchema),
  FAQController.getFaqs
);

export default router;
