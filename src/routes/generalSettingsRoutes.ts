import { Router } from "express";
import { generalSettingsController } from "@/controllers/generalSettingsController";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { optionalAuth } from "@/middleware/auth";

const router = Router();

/**
 * @route GET /api/v1/general-settings
 * @desc Get general settings (creates default if not exists)
 * @access Public (optional authentication - if authenticated, uses user's language preference)
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @header {String} [Authorization] - Optional Bearer token. If provided and valid, uses authenticated user's language preference.
 * @note The tagline field will be automatically transformed to the requested language:
 *   - Priority 1: Query parameter (?lang=nl)
 *   - Priority 2: Authenticated user's language preference (if token provided)
 *   - Priority 3: Default English
 */
router.get(
  "/",
  optionalAuth, // Optional authentication - doesn't fail if no token, but uses user language if authenticated
  transformResponseMiddleware("generalSettings"), // Detects language from query param, authenticated user, or defaults to English, transforms I18n fields to single language strings
  generalSettingsController.getGeneralSettings
);

export default router;
