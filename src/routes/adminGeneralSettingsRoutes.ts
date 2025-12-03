import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { adminGeneralSettingsController } from "@/controllers/adminGeneralSettingsController";
import {
  updateGeneralSettingsSchema,
  updateLanguageStatusSchema,
} from "@/validation/adminGeneralSettingsValidation";
import { logoUpload, handleLogoUploadError } from "@/middleware/logoUpload";
import { parseFormDataJson } from "@/middleware/parseFormData";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/general-settings
 * @desc Get general settings (creates default if not exists)
 * @access Admin
 */
router.get("/", adminGeneralSettingsController.getGeneralSettings);

/**
 * @route PUT /api/v1/admin/general-settings
 * @desc Update general settings
 * @access Admin
 * @body {String} [tagline] - Tagline or short description
 * @body {String} [supportEmail] - Support email
 * @body {String} [supportPhone] - Support phone
 * @body {Object} [address] - Address object
 * @body {Object} [socialMedia] - Social media links
 * @body {Array} [languages] - Language settings array
 * @formData {File} [logoLight] - Light theme logo
 * @formData {File} [logoDark] - Dark theme logo
 */
router.put(
  "/",
  handleLogoUploadError(
    logoUpload.fields([
      { name: "logoLight", maxCount: 1 },
      { name: "logoDark", maxCount: 1 },
    ])
  ),
  parseFormDataJson(["address", "socialMedia", "languages"]),
  validateJoi(updateGeneralSettingsSchema),
  adminGeneralSettingsController.updateGeneralSettings
);

/**
 * @route PATCH /api/v1/admin/general-settings/languages/:code
 * @desc Update language status (enable/disable)
 * @access Admin
 * @param {String} code - Language code (EN, NL, DE, FR, ES)
 * @body {Boolean} isEnabled - Enable or disable the language
 */
router.patch(
  "/languages/:code",
  validateJoi(updateLanguageStatusSchema),
  adminGeneralSettingsController.updateLanguageStatus
);

export default router;
