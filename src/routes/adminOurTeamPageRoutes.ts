import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { adminOurTeamPageController } from "@/controllers/adminOurTeamPageController";
import { updateOurTeamPageSchema } from "@/validation/ourTeamPageValidation";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/our-team-page
 * @desc Get Our Team Page settings (Admin view)
 * @access Admin
 * @query {String} [lang] - Language code (en, nl, de, fr, es). If not provided, uses authenticated user's language or defaults to English.
 * @note I18n fields will be automatically transformed to single language strings based on detected language.
 */
router.get(
  "/",
  transformResponseMiddleware("ourTeamPage"),
  adminOurTeamPageController.getOurTeamPage
);

/**
 * @route PUT /api/v1/admin/our-team-page
 * @desc Update Our Team Page settings (upsert)
 * @access Admin
 * @contentType multipart/form-data
 * @body {Object} banner - Banner section settings
 * @body {String|Object} banner.title - Title as plain string or I18n object {en, nl, de, fr, es}
 * @body {String|Object} banner.subtitle - Subtitle as plain string or I18n object {en, nl, de, fr, es}
 * @body {File} [banner_image] - Banner image file
 * @note I18n fields (title, subtitle) can be sent as plain strings or I18n objects. Plain strings will be automatically converted to I18n objects.
 */
router.put(
  "/",
  handleMulterError(upload.single("banner_image"), "banner_image"),
  autoTranslateMiddleware("ourTeamPage"), // Converts plain strings to I18n objects for supported fields
  validateJoi(updateOurTeamPageSchema),
  adminOurTeamPageController.updateOurTeamPage
);

export default router;
