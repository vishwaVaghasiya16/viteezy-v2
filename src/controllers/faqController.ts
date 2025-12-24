import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { faqService } from "@/services/faqService";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    language?: string;
  };
}

// Map language name to language code
const mapLanguageToCode = (language?: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    English: "en",
    Dutch: "nl",
    German: "de",
    French: "fr",
    Spanish: "es",
  };

  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

class FAQController {
  getFaqs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authenticatedReq = req as AuthenticatedRequest;
    const { search, category, lang } = req.body;

    // Get language from user token if authenticated, otherwise from body param, default to "en"
    let userLang: SupportedLanguage = DEFAULT_LANGUAGE;

    if (authenticatedReq.user?.language) {
      // Use language from user token
      userLang = mapLanguageToCode(authenticatedReq.user.language);
    } else if (lang) {
      // Use language from body parameter if provided
      const validLang = ["en", "nl", "de", "fr", "es"].includes(lang)
        ? (lang as SupportedLanguage)
        : DEFAULT_LANGUAGE;
      userLang = validLang;
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
      const { status = "active", lang, title } = req.body;

      // Get language from user token if authenticated, otherwise from body param, default to "en"
      let userLang: SupportedLanguage = DEFAULT_LANGUAGE;

      if (authenticatedReq.user?.language) {
        // Use language from user token
        userLang = mapLanguageToCode(authenticatedReq.user.language);
      } else if (lang) {
        // Use language from body parameter if provided
        const validLang = ["en", "nl", "de", "fr", "es"].includes(lang)
          ? (lang as SupportedLanguage)
          : DEFAULT_LANGUAGE;
        userLang = validLang;
      }

      const categories = await faqService.getCategories({
        status: (status as "active" | "all") || "active",
        lang: userLang,
        title: title as string | undefined,
      });

      res.apiSuccess({ categories }, "FAQ categories retrieved successfully");
    }
  );
}

const faqController = new FAQController();
export { faqController as FAQController };
