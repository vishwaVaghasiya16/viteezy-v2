import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { languageMigrationService } from "@/services/languageMigrationService";
import { normalizeLanguageCode, isValidLanguageCode } from "@/constants/languageConstants";
import { DEFAULT_LANGUAGE } from "@/constants/languageConstants";

/**
 * Admin Language Migration Controller
 * Handles cleanup and migration of language data
 */
class AdminLanguageMigrationController {
  /**
   * Get language usage statistics
   * Shows how many documents contain a specific language
   * @route GET /api/v1/admin/languages/:code/usage-stats
   * @access Admin
   */
  getLanguageUsageStats = asyncHandler(
    async (req: Request, res: Response) => {
      const { code } = req.params;

      if (!isValidLanguageCode(code)) {
        throw new AppError("Invalid language code format", 400);
      }

      const languageCode = normalizeLanguageCode(code).toLowerCase();

      // Prevent checking default language (always in use)
      if (languageCode === DEFAULT_LANGUAGE.CODE.toLowerCase()) {
        throw new AppError(
          "Cannot get usage stats for default language (always in use)",
          400
        );
      }

      const stats = await languageMigrationService.getLanguageUsageStats(
        languageCode
      );

      res.apiSuccess(stats, "Language usage statistics retrieved successfully");
    }
  );

  /**
   * Remove language from all collections (dry run)
   * Shows what would be changed without actually modifying data
   * @route POST /api/v1/admin/languages/:code/cleanup?dryRun=true
   * @access Admin
   */
  cleanupLanguageData = asyncHandler(
    async (req: Request, res: Response) => {
      const { code } = req.params;
      const { dryRun = "true", collections } = req.query;

      if (!isValidLanguageCode(code)) {
        throw new AppError("Invalid language code format", 400);
      }

      const languageCode = normalizeLanguageCode(code).toLowerCase();

      // Prevent cleaning up default language
      if (languageCode === DEFAULT_LANGUAGE.CODE.toLowerCase()) {
        throw new AppError(
          "Cannot clean up default language data",
          400
        );
      }

      const isDryRun = String(dryRun).toLowerCase() === "true" || dryRun === "1";
      const collectionsArray = collections
        ? (Array.isArray(collections) ? collections : [collections]).map(
            (c) => String(c)
          )
        : undefined;

      const result = await languageMigrationService.removeLanguageFromAllCollections(
        languageCode,
        {
          dryRun: isDryRun,
          collections: collectionsArray,
        }
      );

      res.apiSuccess(
        {
          ...result,
          message: isDryRun
            ? "Dry run completed. No data was modified."
            : "Language data cleanup completed successfully.",
        },
        isDryRun
          ? `Dry run: ${result.totalDocuments} documents would be affected`
          : `Successfully cleaned up language data from ${result.totalDocuments} documents`
      );
    }
  );
}

export const adminLanguageMigrationController =
  new AdminLanguageMigrationController();

