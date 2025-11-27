import { Router } from "express";
import { FAQController } from "@/controllers/faqController";
import { validateQuery } from "@/middleware/joiValidation";
import {
  getFaqCategoriesQuerySchema,
  getFaqsQuerySchema,
} from "@/validation/faqValidation";

const router = Router();

router.get(
  "/categories/list",
  validateQuery(getFaqCategoriesQuerySchema),
  FAQController.getFaqCategories
);

router.get("/", validateQuery(getFaqsQuerySchema), FAQController.getFaqs);

export default router;
