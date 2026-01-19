import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { getPaginationMeta } from "@/utils/pagination";
import { HeaderBanner } from "@/models/cms/headerBanner.model";
import { DeviceType } from "@/models/enums";
import { logger } from "@/utils/logger";
import { SupportedLanguage, DEFAULT_LANGUAGE } from "@/models/common.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    role?: string;
    email?: string;
    language?: string;
  };
}

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

class AdminHeaderBannerController {
  /**
   * Create header banner (Admin only)
   * @route POST /api/v1/admin/header-banners
   * @access Private (Admin)
   * @body {String} text - Banner text in English only (simple string)
   * @body {String} deviceType - Device type (WEB or MOBILE)
   * @body {Boolean} [isActive] - Active status (default: false)
   * @note Auto-translate middleware will convert English text to all supported languages
   */
  createHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { text, deviceType, isActive } = req.body;

      // Validate text - can be either a string or I18n object
      let i18nText: any;
      if (typeof text === "string") {
        // Plain string - validate it's not empty
        if (text.trim().length === 0) {
          throw new AppError("Banner text must be a non-empty string", 400);
        }
        // After autoTranslateMiddleware, text will be converted to I18n object
        // But if middleware didn't run, use the string as English
        i18nText = { en: text.trim() };
      } else if (text && typeof text === "object" && "en" in text) {
        // I18n object - validate English field is present and not empty
        if (!text.en || typeof text.en !== "string" || text.en.trim().length === 0) {
          throw new AppError("Banner text I18n object must have a non-empty 'en' field", 400);
        }
        // Use the I18n object directly (after translation middleware, it will have all languages)
        i18nText = text;
      } else {
        throw new AppError("Banner text must be a non-empty string or I18n object with 'en' field", 400);
      }

      // If setting as active, deactivate all other banners for this device type
      if (isActive === true) {
        await HeaderBanner.updateMany(
          {
            deviceType: deviceType as DeviceType,
            isActive: true,
            isDeleted: { $ne: true },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      // Create header banner with I18n text object (all languages stored)
      const headerBanner = await HeaderBanner.create({
        text: i18nText,
        deviceType: deviceType as DeviceType,
        isActive: isActive === true,
        createdBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
        updatedBy: req.user?._id
          ? new mongoose.Types.ObjectId(req.user._id)
          : undefined,
      });

      logger.info(
        `Header banner created: ${headerBanner._id} by admin ${req.user?._id}`
      );

      res.status(201).json({
        success: true,
        message: "Header banner created successfully",
        data: { headerBanner },
      });
    }
  );

  /**
   * Get all header banners (Admin only)
   * @route GET /api/v1/admin/header-banners
   * @access Private (Admin)
   */
  getAllHeaderBanners = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        page = "1",
        limit = "10",
        search,
        deviceType,
        isActive,
      } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
        deviceType?: string;
        isActive?: string;
      };

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = {
        isDeleted: { $ne: true }, // Exclude soft-deleted records
      };

      // Filter by device type
      if (deviceType) {
        query.deviceType = deviceType;
      }

      // Filter by active status
      if (isActive !== undefined) {
        query.isActive = isActive === "true";
      }

      // Search functionality - by text in any language
      if (search) {
        query.$or = [
          { "text.en": { $regex: search, $options: "i" } },
          { "text.nl": { $regex: search, $options: "i" } },
          { "text.de": { $regex: search, $options: "i" } },
          { "text.fr": { $regex: search, $options: "i" } },
          { "text.es": { $regex: search, $options: "i" } },
        ];
      }

      const [banners, total] = await Promise.all([
        HeaderBanner.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        HeaderBanner.countDocuments(query),
      ]);

      // Get user language from token (default to English)
      const userLang = getUserLanguage(req);

      // Transform I18n text to user's selected language (keep response structure same)
      const transformedBanners = banners.map((banner: any) => ({
        ...banner,
        text: getTranslatedString(banner.text, userLang), // Convert I18n object to single language string
      }));

      const paginationMeta = getPaginationMeta(pageNum, limitNum, total);

      res.status(200).json({
        success: true,
        message: "Header banners retrieved successfully",
        data: transformedBanners,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get header banner by ID (Admin only)
   * @route GET /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  getHeaderBannerById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      }).lean();

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      // Get user language from token (default to English)
      const userLang = getUserLanguage(req);

      // Transform I18n text to user's selected language (keep response structure same)
      const transformedBanner = {
        ...headerBanner,
        text: getTranslatedString(headerBanner.text, userLang), // Convert I18n object to single language string
      };

      res.status(200).json({
        success: true,
        message: "Header banner retrieved successfully",
        data: { headerBanner: transformedBanner },
      });
    }
  );

  /**
   * Update header banner (Admin only)
   * @route PUT /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  updateHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { text, deviceType, isActive } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      // If device type is being changed, check if new device type already has an active banner
      if (deviceType && deviceType !== headerBanner.deviceType) {
        // If setting as active, deactivate all other banners for the new device type
        if (isActive === true) {
          await HeaderBanner.updateMany(
            {
              deviceType: deviceType as DeviceType,
              isActive: true,
              isDeleted: { $ne: true },
              _id: { $ne: new mongoose.Types.ObjectId(id) },
            },
            {
              $set: { isActive: false },
            }
          );
        }
        headerBanner.deviceType = deviceType as DeviceType;
      }

      // If setting as active, deactivate all other banners for this device type
      if (isActive === true && headerBanner.isActive !== true) {
        await HeaderBanner.updateMany(
          {
            deviceType: headerBanner.deviceType,
            isActive: true,
            isDeleted: { $ne: true },
            _id: { $ne: new mongoose.Types.ObjectId(id) },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      // Update fields
      if (text !== undefined) {
        // Validate text - can be either a string or I18n object
        if (typeof text === "string") {
          // Plain string - validate it's not empty
          if (text.trim().length === 0) {
            throw new AppError("Banner text must be a non-empty string", 400);
          }
          // After autoTranslateMiddleware, text will be converted to I18n object
          // But if middleware didn't run, use the string as English
          headerBanner.text = { en: text.trim() };
        } else if (text && typeof text === "object" && "en" in text) {
          // I18n object - validate English field is present and not empty
          if (!text.en || typeof text.en !== "string" || text.en.trim().length === 0) {
            throw new AppError("Banner text I18n object must have a non-empty 'en' field", 400);
          }
          // Use the I18n object directly (after translation middleware, it will have all languages)
          headerBanner.text = text;
        } else if (text === null || text === "") {
          throw new AppError("Banner text cannot be empty", 400);
        } else {
          throw new AppError("Banner text must be a non-empty string or I18n object with 'en' field", 400);
        }
      }
      if (isActive !== undefined) {
        headerBanner.isActive = isActive === true;
      }

      headerBanner.updatedBy = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      await headerBanner.save();

      logger.info(
        `Header banner updated: ${headerBanner._id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Header banner updated successfully",
        data: { headerBanner },
      });
    }
  );

  /**
   * Delete header banner (Admin only) - Soft delete
   * @route DELETE /api/v1/admin/header-banners/:id
   * @access Private (Admin)
   */
  deleteHeaderBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      // Perform soft delete
      headerBanner.isDeleted = true;
      headerBanner.deletedAt = new Date();
      await headerBanner.save();

      logger.info(
        `Header banner soft deleted: ${id} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: "Header banner deleted successfully",
      });
    }
  );

  /**
   * Toggle header banner active status (Admin only)
   * @route PATCH /api/v1/admin/header-banners/:id/toggle-status
   * @access Private (Admin)
   */
  toggleHeaderBannerStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid header banner ID", 400);
      }

      const headerBanner = await HeaderBanner.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!headerBanner) {
        throw new AppError("Header banner not found", 404);
      }

      const newActiveStatus = !headerBanner.isActive;

      // If setting as active, deactivate all other banners for this device type
      if (newActiveStatus === true) {
        await HeaderBanner.updateMany(
          {
            deviceType: headerBanner.deviceType,
            isActive: true,
            isDeleted: { $ne: true },
            _id: { $ne: new mongoose.Types.ObjectId(id) },
          },
          {
            $set: { isActive: false },
          }
        );
      }

      headerBanner.isActive = newActiveStatus;
      headerBanner.updatedBy = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      await headerBanner.save();

      logger.info(
        `Header banner status toggled: ${headerBanner._id} to ${newActiveStatus} by admin ${req.user?._id}`
      );

      res.status(200).json({
        success: true,
        message: `Header banner ${newActiveStatus ? "activated" : "deactivated"} successfully`,
        data: { headerBanner },
      });
    }
  );
}

export const adminHeaderBannerController = new AdminHeaderBannerController();

