import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { GeneralSettings } from "@/models/cms";
import { languageService } from "@/services/languageService";
import {
  DEFAULT_LANGUAGE,
  isValidLanguageCode,
  normalizeLanguageCode,
} from "@/constants/languageConstants";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

class AdminLanguageController {
  /**
   * Get all languages
   * @route GET /api/v1/admin/languages
   * @access Admin
   */
  getLanguages = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const languages = await languageService.getLanguageSettings();

      res.apiSuccess({ languages }, "Languages retrieved successfully");
    }
  );

  /**
   * Add a new language
   * @route POST /api/v1/admin/languages
   * @access Admin
   */
  addLanguage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { code, name, isEnabled = false } = req.body;

      if (!code || !name) {
        throw new AppError("Language code and name are required", 400);
      }

      // Validate code format (ISO 639-1: 2 letters)
      if (!isValidLanguageCode(code)) {
        throw new AppError(
          `Language code must be a valid 2-letter ISO 639-1 code (e.g., EN, NL, DE, FR, ES, IT, PT, etc.). Received: ${code}`,
          400
        );
      }

      const languageCode = normalizeLanguageCode(code).toUpperCase();

      // Check if language already exists
      const isValid = await languageService.isValidLanguage(languageCode);
      if (isValid) {
        throw new AppError(
          `Language with code ${languageCode} already exists`,
          400
        );
      }

      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      if (!settings) {
        // Create default settings if they don't exist
        const defaultLanguages = [
          {
            code: DEFAULT_LANGUAGE.CODE.toUpperCase(),
            name: DEFAULT_LANGUAGE.NAME,
            isEnabled: true,
          },
          { code: languageCode, name: name.trim(), isEnabled },
        ];
        settings = await GeneralSettings.create({
          languages: defaultLanguages,
          createdBy: req.user?._id,
          updatedBy: req.user?._id,
        });
      } else {
        // Add new language to existing settings
        if (!settings.languages) {
          settings.languages = [];
        }

        // Check if language already exists
        const exists = settings.languages.some(
          (lang) => lang.code === languageCode
        );
        if (exists) {
          throw new AppError(
            `Language with code ${languageCode} already exists`,
            400
          );
        }

        settings.languages.push({
          code: languageCode,
          name: name.trim(),
          isEnabled: isEnabled === true,
        });
        settings.updatedBy = req.user?._id as any;
        await settings.save();
      }

      // Clear cache
      languageService.clearCache();

      res.apiSuccess(
        {
          language: {
            code: languageCode,
            name,
            isEnabled,
          },
        },
        `Language ${languageCode} added successfully`
      );
    }
  );

  /**
   * Update a language
   * @route PUT /api/v1/admin/languages/:code
   * @access Admin
   */
  updateLanguage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { code } = req.params;
      const { name, isEnabled } = req.body;

      const languageCode = normalizeLanguageCode(code).toUpperCase();

      // Validate code format
      if (!isValidLanguageCode(languageCode)) {
        throw new AppError(
          `Invalid language code format. Must be a valid 2-letter ISO 639-1 code. Received: ${languageCode}`,
          400
        );
      }

      // Prevent disabling default language
      if (
        languageCode === DEFAULT_LANGUAGE.CODE.toUpperCase() &&
        isEnabled === false
      ) {
        throw new AppError(
          `Cannot disable ${DEFAULT_LANGUAGE.NAME} (default language)`,
          400
        );
      }

      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      if (!settings) {
        throw new AppError("General settings not found", 404);
      }

      if (!settings.languages || settings.languages.length === 0) {
        throw new AppError("No languages configured", 404);
      }

      const languageIndex = settings.languages.findIndex(
        (lang) => lang.code === languageCode
      );

      if (languageIndex === -1) {
        throw new AppError(`Language with code ${languageCode} not found`, 404);
      }

      // Update language
      if (name !== undefined) {
        settings.languages[languageIndex].name = name.trim();
      }
      if (isEnabled !== undefined) {
        settings.languages[languageIndex].isEnabled = isEnabled === true;
      }

      settings.updatedBy = req.user?._id as any;
      await settings.save();

      // Clear cache
      languageService.clearCache();

      res.apiSuccess(
        {
          language: settings.languages[languageIndex],
        },
        `Language ${languageCode} updated successfully`
      );
    }
  );

  /**
   * Delete a language
   * @route DELETE /api/v1/admin/languages/:code
   * @access Admin
   */
  deleteLanguage = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { code } = req.params;

      const languageCode = normalizeLanguageCode(code).toUpperCase();

      // Prevent deleting default language
      if (languageCode === DEFAULT_LANGUAGE.CODE.toUpperCase()) {
        throw new AppError(
          `Cannot delete ${DEFAULT_LANGUAGE.NAME} (default language)`,
          400
        );
      }

      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      if (!settings) {
        throw new AppError("General settings not found", 404);
      }

      if (!settings.languages || settings.languages.length === 0) {
        throw new AppError("No languages configured", 404);
      }

      const languageIndex = settings.languages.findIndex(
        (lang) => lang.code === languageCode
      );

      if (languageIndex === -1) {
        throw new AppError(`Language with code ${languageCode} not found`, 404);
      }

      // Check if it's the only language
      if (settings.languages.length === 1) {
        throw new AppError(
          "Cannot delete the only language. At least one language must exist.",
          400
        );
      }

      // Get usage stats before deletion (for response)
      const { languageMigrationService } = await import(
        "@/services/languageMigrationService"
      );
      const usageStats = await languageMigrationService.getLanguageUsageStats(
        languageCode
      );

      // Remove language from GeneralSettings
      settings.languages.splice(languageIndex, 1);
      settings.updatedBy = req.user?._id as any;
      await settings.save();

      // Clear cache
      languageService.clearCache();

      // Note: Old language data in other collections is NOT automatically deleted
      // This is intentional to preserve data integrity. The data will:
      // 1. Still exist in the database (won't cause errors)
      // 2. Not be returned in API responses (transformation middleware ignores it)
      // 3. Can be cleaned up manually using the migration service if needed

      res.apiSuccess(
        {
          deletedLanguage: languageCode,
          usageStats: {
            affectedCollections: usageStats.collections.length,
            totalDocuments: usageStats.totalDocuments,
            collections: usageStats.collections.map((c) => ({
              name: c.name,
              documentsWithLanguage: c.fieldsWithLanguage,
            })),
          },
          note: "Old language data in other collections is preserved. Use migration service to clean up if needed.",
        },
        `Language ${languageCode} deleted successfully. ${usageStats.totalDocuments} documents contain this language data.`
      );
    }
  );

  /**
   * Toggle language status (enable/disable)
   * @route PATCH /api/v1/admin/languages/:code/toggle
   * @access Admin
   */
  toggleLanguageStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { code } = req.params;

      const languageCode = normalizeLanguageCode(code).toUpperCase();

      // Prevent disabling default language
      if (languageCode === DEFAULT_LANGUAGE.CODE.toUpperCase()) {
        throw new AppError(
          `Cannot disable ${DEFAULT_LANGUAGE.NAME} (default language)`,
          400
        );
      }

      let settings = await GeneralSettings.findOne({
        isDeleted: { $ne: true },
      });

      if (!settings) {
        throw new AppError("General settings not found", 404);
      }

      if (!settings.languages || settings.languages.length === 0) {
        throw new AppError("No languages configured", 404);
      }

      const languageIndex = settings.languages.findIndex(
        (lang) => lang.code === languageCode
      );

      if (languageIndex === -1) {
        throw new AppError(`Language with code ${languageCode} not found`, 404);
      }

      // Toggle status
      settings.languages[languageIndex].isEnabled =
        !settings.languages[languageIndex].isEnabled;
      settings.updatedBy = req.user?._id as any;
      await settings.save();

      // Clear cache
      languageService.clearCache();

      res.apiSuccess(
        {
          language: settings.languages[languageIndex],
        },
        `Language ${languageCode} ${
          settings.languages[languageIndex].isEnabled ? "enabled" : "disabled"
        } successfully`
      );
    }
  );
}

export const adminLanguageController = new AdminLanguageController();
