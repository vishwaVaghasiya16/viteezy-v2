/**
 * @fileoverview About Us Controller (Public)
 * @description Controller for public About Us page operations
 * @module controllers/aboutUsController
 */

import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AboutUs } from "@/models/cms";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";
import { getLanguageCodeFromName, DEFAULT_LANGUAGE_CODE, normalizeLanguageCode } from "@/utils/languageConstants";
import { languageService } from "@/services/languageService";

/**
 * Get language from query parameter, default to "en"
 * Validates against configured languages dynamically
 */
const getLanguageFromQuery = async (lang?: string): Promise<SupportedLanguage> => {
  if (!lang) {
    return DEFAULT_LANGUAGE_CODE;
  }

  const normalized = normalizeLanguageCode(lang);
  
  // Validate against configured languages
  const isValid = await languageService.isValidLanguage(normalized);
  if (!isValid) {
    return DEFAULT_LANGUAGE_CODE;
  }

  return normalized as SupportedLanguage;
};

/**
 * Extract single language value from i18n object
 */
const getI18nValue = (obj: any, lang: SupportedLanguage): string => {
  if (!obj) return "";
  return obj[lang] || obj.en || "";
};

class AboutUsController {
  /**
   * Get About Us page content (Public)
   * Language is passed via query parameter
   */
  getAboutUs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const lang = await getLanguageFromQuery(req.query.lang as string);

      const aboutUs = await AboutUs.findOne({
        isDeleted: false,
      }).lean();

      if (!aboutUs) {
        // Return empty structure if not found
        const emptyAboutUs = {
          banner: {
            banner_image: null,
            banner_title: "",
            banner_subtitle: "",
            banner_button_text: "",
            banner_button_link: "",
          },
          founderQuote: {
            founder_image: null,
            founder_quote_text: "",
            founder_name: "",
            founder_designation: "",
            note: "",
          },
          meetBrains: {
            meet_brains_title: "",
            meet_brains_subtitle: "",
            meet_brains_main_image: null,
          },
          timeline: {
            timeline_section_title: "",
            timeline_section_description: "",
            timeline_events: [],
          },
          people: {
            title: "",
            subtitle: "",
            images: [],
          },
        };
        res.apiSuccess(
          { aboutUs: emptyAboutUs },
          "About Us content retrieved successfully"
        );
        return;
      }

      // Transform to single language response
      const transformedAboutUs = {
        banner: {
          banner_image: aboutUs.banner?.banner_image || null,
          banner_title: getI18nValue(aboutUs.banner?.banner_title, lang),
          banner_subtitle: getI18nValue(aboutUs.banner?.banner_subtitle, lang),
          banner_button_text: getI18nValue(
            aboutUs.banner?.banner_button_text,
            lang
          ),
          banner_button_link: aboutUs.banner?.banner_button_link || "",
        },
        founderQuote: {
          founder_image: aboutUs.founderQuote?.founder_image || null,
          founder_quote_text: getI18nValue(
            aboutUs.founderQuote?.founder_quote_text,
            lang
          ),
          founder_name: getI18nValue(aboutUs.founderQuote?.founder_name, lang),
          founder_designation: getI18nValue(
            aboutUs.founderQuote?.founder_designation,
            lang
          ),
          note: getI18nValue(aboutUs.founderQuote?.note, lang),
        },
        meetBrains: {
          meet_brains_title: getI18nValue(
            aboutUs.meetBrains?.meet_brains_title,
            lang
          ),
          meet_brains_subtitle: getI18nValue(
            aboutUs.meetBrains?.meet_brains_subtitle,
            lang
          ),
          meet_brains_main_image:
            aboutUs.meetBrains?.meet_brains_main_image || null,
        },
        timeline: {
          timeline_section_title: getI18nValue(
            aboutUs.timeline?.timeline_section_title,
            lang
          ),
          timeline_section_description: getI18nValue(
            aboutUs.timeline?.timeline_section_description,
            lang
          ),
          timeline_events: (aboutUs.timeline?.timeline_events || [])
            .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
            .map((event: any) => ({
              year: event.year,
              title: getI18nValue(event.title, lang),
              description: getI18nValue(event.description, lang),
              order: event.order,
            })),
        },
        people: {
          title: getI18nValue(aboutUs.people?.title, lang),
          subtitle: getI18nValue(aboutUs.people?.subtitle, lang),
          images: aboutUs.people?.images || [],
        },
      };

      res.apiSuccess(
        { aboutUs: transformedAboutUs },
        "About Us content retrieved successfully"
      );
    }
  );
}

export const aboutUsController = new AboutUsController();
