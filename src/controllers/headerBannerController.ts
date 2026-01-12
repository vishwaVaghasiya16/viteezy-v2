import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { HeaderBanner } from "@/models/cms/headerBanner.model";
import { DeviceType, DEVICE_TYPE_VALUES } from "@/models/enums";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    language?: string;
    _id?: string;
  };
}

/**
 * Get translated string from I18nStringType
 */
const getTranslatedString = (
  i18nString: any,
  lang: SupportedLanguage
): string => {
  if (!i18nString) return "";

  if (typeof i18nString === "string") {
    return i18nString;
  }

  if (
    typeof i18nString === "object" &&
    !Array.isArray(i18nString) &&
    i18nString !== null
  ) {
    return i18nString[lang] || i18nString.en || "";
  }

  return "";
};

/**
 * Map user language name to language code
 */
const mapLanguageToCode = (language?: string): SupportedLanguage => {
  const languageMap: Record<string, SupportedLanguage> = {
    English: "en",
    Spanish: "es",
    French: "fr",
    Dutch: "nl",
    German: "de",
  };

  if (!language) {
    return DEFAULT_LANGUAGE;
  }

  return languageMap[language] || DEFAULT_LANGUAGE;
};

/**
 * Get user language from request (from token if authenticated, otherwise default to English)
 */
const getUserLanguage = (req: AuthenticatedRequest): SupportedLanguage => {
  if (req.user?.language) {
    return mapLanguageToCode(req.user.language);
  }

  return DEFAULT_LANGUAGE;
};

class HeaderBannerController {
  /**
   * Get active header banner by device type (Public endpoint)
   * @route GET /api/v1/header-banner?deviceType=WEB
   * @access Public
   */
  getActiveHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { deviceType } = req.query;

      if (!deviceType || !DEVICE_TYPE_VALUES.includes(deviceType as DeviceType)) {
        throw new AppError(
          `Device type is required and must be one of: ${DEVICE_TYPE_VALUES.join(", ")}`,
          400
        );
      }

      // Get user language from token (if authenticated)
      const userLang = getUserLanguage(req);

      // Find active banner for the specified device type
      const headerBanner = await HeaderBanner.findOne({
        deviceType: deviceType as DeviceType,
        isActive: true,
        isDeleted: { $ne: true },
      }).lean();

      if (!headerBanner) {
        res.status(200).json({
          success: true,
          message: "No active header banner found",
          data: {
            headerBanner: null,
            deviceType: deviceType as DeviceType,
          },
        });
        return;
      }

      // Transform I18n text to user's language
      const translatedText = getTranslatedString(headerBanner.text, userLang);

      res.status(200).json({
        success: true,
        message: "Active header banner retrieved successfully",
        data: {
          headerBanner: {
            _id: headerBanner._id,
            text: translatedText,
            deviceType: headerBanner.deviceType,
            isActive: headerBanner.isActive,
            createdAt: headerBanner.createdAt,
            updatedAt: headerBanner.updatedAt,
          },
          deviceType: deviceType as DeviceType,
          language: userLang,
        },
      });
    }
  );
}

export const headerBannerController = new HeaderBannerController();

