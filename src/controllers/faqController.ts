import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { faqService } from "@/services/faqService";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

// Map language name to language code
const mapLanguageToCode = (language?: string): "en" | "nl" => {
  const languageMap: Record<string, "en" | "nl"> = {
    English: "en",
    Dutch: "nl",
    German: "en", // Fallback to English
    French: "en", // Fallback to English
    Spanish: "en", // Fallback to English
  };

  if (!language) {
    return "en"; // Default to English
  }

  return languageMap[language] || "en";
};

class FAQController {
  getFaqs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authenticatedReq = req as AuthenticatedRequest;
    const { search, category, lang } = req.query;

    // Get language from user token if authenticated, otherwise from query param, default to "en"
    let userLang: "en" | "nl" = "en";

    if (authenticatedReq.user?.language) {
      // Use language from user token
      userLang = mapLanguageToCode(authenticatedReq.user.language);
    } else if (lang) {
      // Use language from query parameter if provided
      userLang = (lang === "nl" ? "nl" : "en") as "en" | "nl";
    }

    const groupedFaqs = await faqService.getFaqsGrouped({
      search: search as string | undefined,
      category: category as string | undefined,
      lang: userLang,
    });

    res.apiSuccess({ categories: groupedFaqs }, "FAQs retrieved successfully");
  });

  getFaqCategories = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const authenticatedReq = req as AuthenticatedRequest;
      const { status = "active", lang } = req.query;

      // Get language from user token if authenticated, otherwise from query param, default to "en"
      let userLang: "en" | "nl" = "en";

      if (authenticatedReq.user?.language) {
        // Use language from user token
        userLang = mapLanguageToCode(authenticatedReq.user.language);
      } else if (lang) {
        // Use language from query parameter if provided
        userLang = (lang === "nl" ? "nl" : "en") as "en" | "nl";
      }

      const categories = await faqService.getCategories({
        status: (status as "active" | "all") || "active",
        lang: userLang,
      });

      res.apiSuccess({ categories }, "FAQ categories retrieved successfully");
    }
  );
}

const faqController = new FAQController();
export { faqController as FAQController };
