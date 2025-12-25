import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "@/utils";
import { landingPageService } from "@/services/landingPageService";
import mongoose from "mongoose";

type SupportedLanguage = "en" | "nl" | "de" | "fr" | "es";
const DEFAULT_LANGUAGE: SupportedLanguage = "en";

/**
 * Map language name to language code
 */
const mapLanguageToCode = (language: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    english: "en",
    dutch: "nl",
    german: "de",
    french: "fr",
    spanish: "es",
    en: "en",
    nl: "nl",
    de: "de",
    fr: "fr",
    es: "es",
  };

  return languageMap[language.toLowerCase()] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request
 * Priority: 1. Query parameter (lang) 2. User token 3. Default to English
 */
const getUserLanguage = (req: Request): SupportedLanguage => {
  // Check query parameter first
  const langParam = req.query.lang as string;
  if (langParam) {
    const validLang = ["en", "nl", "de", "fr", "es"].includes(langParam.toLowerCase())
      ? (langParam.toLowerCase() as SupportedLanguage)
      : DEFAULT_LANGUAGE;
    return validLang;
  }

  // Check if user is authenticated and has language preference
  const authenticatedReq = req as any;
  if (authenticatedReq.user?.language) {
    return mapLanguageToCode(authenticatedReq.user.language);
  }

  // Default to English
  return DEFAULT_LANGUAGE;
};

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class LandingPageController {
  /**
   * Create new landing page
   * @route POST /api/v1/admin/landing-pages
   * @access Admin
   */
  createLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?._id;

      const result = await landingPageService.createLandingPage({
        ...req.body,
        createdBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Get all landing pages
   * @route GET /api/v1/admin/landing-pages
   * @access Admin
   */
  getAllLandingPages = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { isActive } = req.query;

      const filters: any = {};
      if (isActive !== undefined) {
        filters.isActive = isActive === "true";
      }

      const result = await landingPageService.getAllLandingPages(filters);

      res.status(200).json({
        success: true,
        message: "Landing pages retrieved successfully",
        data: result.landingPages,
      });
    }
  );

  /**
   * Get landing page by ID
   * @route GET /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  getLandingPageById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const result = await landingPageService.getLandingPageById(id);

      res.status(200).json({
        success: true,
        message: "Landing page retrieved successfully",
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Get active landing page (public endpoint)
   * @route GET /api/v1/landing-page?lang=en
   * @access Public
   * @query {String} [lang] - Language code (en, nl, de, fr, es) or language name (english, dutch, etc.)
   */
  getActiveLandingPage = asyncHandler(
    async (req: Request, res: Response) => {
      // Get language from query parameter or user token
      const lang = getUserLanguage(req);
      
      // Debug: Log the language being used
      console.log(`[Landing Page API] Language requested: ${req.query.lang}, Resolved: ${lang}`);
      
      const result = await landingPageService.getActiveLandingPage(lang);

      // Add language info to response headers
      res.setHeader("X-Content-Language", lang);
      
      res.status(200).json({
        success: true,
        message: "Landing page retrieved successfully",
        data: {
          landingPage: result.landingPage,
          language: lang, // Include language in response
        },
      });
    }
  );

  /**
   * Update landing page
   * @route PUT /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  updateLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId = req.user?._id;

      const result = await landingPageService.updateLandingPage(id, {
        ...req.body,
        updatedBy: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          landingPage: result.landingPage,
        },
      });
    }
  );

  /**
   * Delete landing page
   * @route DELETE /api/v1/admin/landing-pages/:id
   * @access Admin
   */
  deleteLandingPage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;

      const result = await landingPageService.deleteLandingPage(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }
  );
}

export const landingPageController = new LandingPageController();

