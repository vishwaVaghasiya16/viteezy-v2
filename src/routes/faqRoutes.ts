import { Router } from "express";
import { FAQController } from "@/controllers/faqController";
import { validateQuery } from "@/middleware/joiValidation";
import { optionalAuth } from "@/middleware/auth";
import {
  getFaqCategoriesQuerySchema,
  getFaqsQuerySchema,
} from "@/validation/faqValidation";

const router = Router();

router.get(
  "/categories/list",
  optionalAuth,
  validateQuery(getFaqCategoriesQuerySchema),
  FAQController.getFaqCategories
);

router.get(
  "/",
  optionalAuth,
  validateQuery(getFaqsQuerySchema),
  FAQController.getFaqs
);

export default router;
