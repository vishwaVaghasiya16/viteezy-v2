import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { faqService } from "@/services/faqService";

class FAQController {
  getFaqs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { search, category, lang = "en" } = req.query;

    const groupedFaqs = await faqService.getFaqsGrouped({
      search: search as string | undefined,
      category: category as string | undefined,
      lang: lang as "en" | "nl" | undefined,
    });

    res.apiSuccess({ categories: groupedFaqs }, "FAQs retrieved successfully");
  });

  getFaqCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { status = "active", lang = "en" } = req.query;

      const categories = await faqService.getCategories({
        status: (status as "active" | "all") || "active",
        lang: lang as "en" | "nl" | undefined,
      });

      res.apiSuccess({ categories }, "FAQ categories retrieved successfully");
    }
  );
}

const faqController = new FAQController();
export { faqController as FAQController };
