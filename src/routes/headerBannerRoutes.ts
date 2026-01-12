import { Router } from "express";
import { optionalAuth } from "@/middleware/auth";
import { validateQuery } from "@/middleware/joiValidation";
import { headerBannerController } from "@/controllers/headerBannerController";
import { getActiveHeaderBannerQuerySchema } from "@/validation/adminHeaderBannerValidation";

const router = Router();

/**
 * @route   GET /api/v1/header-banner
 * @desc    Get active header banner by device type (Public endpoint with optional authentication)
 * @access  Public (optional authentication for language detection)
 * @query   {String} deviceType - Device type (WEB or MOBILE) - Required
 */
router.get(
  "/",
  optionalAuth, // Optional auth to detect user language from token
  validateQuery(getActiveHeaderBannerQuerySchema),
  headerBannerController.getActiveHeaderBanner
);

export default router;

