import { Request, Response, NextFunction } from "express";
import { prepareDataForTranslation } from "@/utils/translationUtils";
import { prepareProductDataForTranslation } from "@/utils/productTranslationUtils";
import { prepareAboutUsDataForTranslation } from "@/utils/aboutUsTranslationUtils";
import { logger } from "@/utils/logger";

/**
 * Translation field mappings for each model
 * Maps model names to their I18n field names
 */
const MODEL_I18N_FIELDS: Record<
  string,
  { i18nString: string[]; i18nText: string[] }
> = {
  // CMS Models
  aboutUs: {
    i18nString: [
      "banner.banner_title",
      "banner.banner_button_text",
      "founderNote.headline",
      "meetBrains.meet_brains_title",
      "timeline.timeline_section_title",
      "people.title",
    ],
    i18nText: [
      "banner.banner_description",
      "founderNote.description",
      "meetBrains.meet_brains_subtitle",
      "timeline.timeline_section_description",
      "people.subtitle",
    ],
  },
  blogs: {
    i18nString: ["title", "description"],
    i18nText: [],
  },
  blogBanners: {
    i18nString: ["heading"],
    i18nText: ["description"],
  },
  headerBanners: {
    i18nString: ["text"],
    i18nText: [],
  },
  blogCategories: {
    i18nString: ["title"],
    i18nText: [],
  },
  faqs: {
    i18nString: ["question"],
    i18nText: ["answer"],
  },
  faqCategories: {
    i18nString: ["title"],
    i18nText: [],
  },
  landingPage: {
    i18nString: [
      "label",
      "title",
      "highlightedText",
      "subTitle",
      "title",
      "subTitle",
      "label",
      "title",
      "subTitle",
      "title",
      "question",
      "title",
    ],
    i18nText: [
      "description",
      "description",
      "description",
      "description",
      "description",
      "description",
      "answer",
      "description",
    ],
  },
  ourTeamPage: {
    i18nString: ["banner.title"], // Nested path: banner.title
    i18nText: ["banner.subtitle"], // Nested path: banner.subtitle
  },
  pages: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  reviews: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  staticPages: {
    i18nString: ["title"],
    i18nText: ["content"],
  },
  teamMembers: {
    i18nString: ["name", "designation"],
    i18nText: ["content"],
  },
  // Commerce Models
  campaigns: {
    i18nString: ["title"],
    i18nText: ["description", "terms"],
  },
  categories: {
    i18nString: ["name"],
    i18nText: ["description"],
  },
  coupons: {
    i18nString: ["name", "description"],
    i18nText: [],
  },
  membershipPlans: {
    i18nString: ["shortDescription"],
    i18nText: ["description"],
  },
  productFaqs: {
    i18nString: ["question"],
    i18nText: ["answer"],
  },
  productIngredients: {
    i18nString: ["name"],
    i18nText: ["description"],
  },
  productVariants: {
    i18nString: ["name"],
    i18nText: [],
  },
  products: {
    i18nString: ["title"],
    i18nText: ["description", "nutritionInfo", "howToUse"],
  },
  // Other Models
  avatarJobs: {
    i18nString: [],
    i18nText: [],
  },
  experts: {
    i18nString: [],
    i18nText: ["bio"],
  },
  generalSettings: {
    i18nString: ["tagline"],
    i18nText: [],
  },
};

/**
 * Get I18n fields for a model
 * @param modelName - Name of the model
 * @returns Object with i18nString and i18nText field arrays
 */
const getI18nFieldsForModel = (
  modelName: string
): { i18nString: string[]; i18nText: string[] } => {
  return MODEL_I18N_FIELDS[modelName] || { i18nString: [], i18nText: [] };
};

/**
 * Middleware to auto-translate I18n fields on create/update
 * This middleware should be used before the controller handler
 */
export const autoTranslateMiddleware = (modelName: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Only process POST, PUT, PATCH requests
      if (!["POST", "PUT", "PATCH"].includes(req.method)) {
        return next();
      }

      // Skip if body is empty
      if (!req.body || Object.keys(req.body).length === 0) {
        return next();
      }

      const { i18nString, i18nText } = getI18nFieldsForModel(modelName);

      // If no I18n fields for this model, skip translation
      if (i18nString.length === 0 && i18nText.length === 0) {
        return next();
      }

      // Special handling for products (handles arrays and nested structures)
      if (modelName === "products") {
        req.body = await prepareProductDataForTranslation(req.body);
        logger.info(`Auto-translated product data with all text fields (including arrays and nested structures)`);
      } else if (modelName === "aboutUs") {
        // Special handling for aboutUs (handles timeline events arrays)
        req.body = await prepareAboutUsDataForTranslation(req.body);
        logger.info(`Auto-translated aboutUs data with all text fields (including timeline events arrays)`);
      } else {
        // Standard translation for other models
        req.body = await prepareDataForTranslation(
          req.body,
          i18nString,
          i18nText
        );
        logger.info(`Auto-translated ${modelName} data`, {
          model: modelName,
          i18nStringFields: i18nString.length,
          i18nTextFields: i18nText.length,
        });
      }

      next();
    } catch (error: any) {
      logger.error(`Translation middleware error for ${modelName}`, {
        error: error.message,
        model: modelName,
      });
      // Continue without translation on error
      next();
    }
  };
};
