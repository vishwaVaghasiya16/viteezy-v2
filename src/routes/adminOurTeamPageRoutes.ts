import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { upload, handleMulterError } from "@/middleware/upload";
import { adminOurTeamPageController } from "@/controllers/adminOurTeamPageController";
import { updateOurTeamPageSchema } from "@/validation/ourTeamPageValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/our-team-page
 * @desc Get Our Team Page settings (Admin view - returns all languages)
 * @access Admin
 */
router.get("/", adminOurTeamPageController.getOurTeamPage);

/**
 * @route PUT /api/v1/admin/our-team-page
 * @desc Update Our Team Page settings (upsert)
 * @access Admin
 * @contentType multipart/form-data
 * @body {Object} banner - Banner section settings
 * @body {Object} banner.title - Title in multiple languages {en, nl, de, fr, es}
 * @body {Object} banner.subtitle - Subtitle/description in multiple languages
 * @body {File} [banner_image] - Banner image file
 */
router.put(
  "/",
  handleMulterError(upload.single("banner_image"), "banner_image"),
  validateJoi(updateOurTeamPageSchema),
  adminOurTeamPageController.updateOurTeamPage
);

export default router;
