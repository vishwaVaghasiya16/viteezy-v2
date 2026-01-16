import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import { adminLanguageController } from "@/controllers/adminLanguageController";
import { adminLanguageMigrationController } from "@/controllers/adminLanguageMigrationController";
import {
  addLanguageSchema,
  updateLanguageSchema,
  languageCodeParamsSchema,
} from "@/validation/adminLanguageValidation";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/languages
 * @desc Get all languages (enabled and disabled)
 * @access Admin
 */
router.get("/", adminLanguageController.getLanguages);

/**
 * @route POST /api/v1/admin/languages
 * @desc Add a new language
 * @access Admin
 * @body {String} code - Language code (2-letter ISO 639-1, e.g., "IT", "PT", "RU")
 * @body {String} name - Language name (e.g., "Italian", "Portuguese", "Russian")
 * @body {Boolean} [isEnabled] - Enable language immediately (default: false)
 */
router.post(
  "/",
  validateJoi(addLanguageSchema),
  adminLanguageController.addLanguage
);

/**
 * @route PUT /api/v1/admin/languages/:code
 * @desc Update a language (name or status)
 * @access Admin
 * @param {String} code - Language code (e.g., "NL", "DE", "FR")
 * @body {String} [name] - Language name
 * @body {Boolean} [isEnabled] - Enable/disable language
 */
router.put(
  "/:code",
  validateParams(languageCodeParamsSchema),
  validateJoi(updateLanguageSchema),
  adminLanguageController.updateLanguage
);

/**
 * @route PATCH /api/v1/admin/languages/:code/toggle
 * @desc Toggle language status (enable/disable)
 * @access Admin
 * @param {String} code - Language code (e.g., "NL", "DE", "FR")
 */
router.patch(
  "/:code/toggle",
  validateParams(languageCodeParamsSchema),
  adminLanguageController.toggleLanguageStatus
);

/**
 * @route DELETE /api/v1/admin/languages/:code
 * @desc Delete a language
 * @access Admin
 * @param {String} code - Language code (e.g., "NL", "DE", "FR")
 * @note Cannot delete English (EN) as it's the default language
 * @note Old language data in collections is preserved. Use cleanup endpoint to remove it.
 */
router.delete(
  "/:code",
  validateParams(languageCodeParamsSchema),
  adminLanguageController.deleteLanguage
);

/**
 * @route GET /api/v1/admin/languages/:code/usage-stats
 * @desc Get language usage statistics across all collections
 * @access Admin
 * @param {String} code - Language code (e.g., "IT", "NL", "DE")
 * @returns Statistics about how many documents contain this language
 */
router.get(
  "/:code/usage-stats",
  validateParams(languageCodeParamsSchema),
  adminLanguageMigrationController.getLanguageUsageStats
);

/**
 * @route POST /api/v1/admin/languages/:code/cleanup
 * @desc Clean up language data from all collections
 * @access Admin
 * @param {String} code - Language code (e.g., "IT", "NL", "DE")
 * @query {Boolean} dryRun - If true (default), only shows what would be changed
 * @query {String[]} collections - Optional: specific collections to clean (comma-separated)
 * @note By default, runs in dry-run mode. Set dryRun=false to actually remove data.
 */
router.post(
  "/:code/cleanup",
  validateParams(languageCodeParamsSchema),
  adminLanguageMigrationController.cleanupLanguageData
);

export default router;

