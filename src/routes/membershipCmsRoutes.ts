import { Router } from "express";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { membershipCmsController } from "@/controllers/membershipCmsController";

const router = Router();

/**
 * @route GET /api/v1/membership-cms
 * @desc Get active Membership CMS entry
 * @access Public
 * @note Response is automatically transformed based on user's language preference from token.
 *       If no token or no language preference, defaults to English.
 *       I18n objects are converted to single language strings (no object structure in response).
 *       Since there's only one Membership CMS record, this returns the single active record.
 */
router.get(
  "/",
  transformResponseMiddleware("membershipCms"), // Detects language from user token and transforms I18n fields to single language strings
  membershipCmsController.getActiveMembershipCms
);

export default router;

