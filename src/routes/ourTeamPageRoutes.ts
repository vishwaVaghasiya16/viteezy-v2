import { Router } from "express";
import { validateQuery } from "@/middleware/joiValidation";
import { ourTeamPageController } from "@/controllers/ourTeamPageController";
import { getOurTeamPageQuerySchema } from "@/validation/ourTeamPageValidation";

const router = Router();

/**
 * @route GET /api/v1/our-team-page
 * @desc Get Our Team Page settings with team members (Public)
 * @access Public
 * @query {String} [lang] - Language code: "en", "nl", "de", "fr", "es" (default: "en")
 */
router.get(
  "/",
  validateQuery(getOurTeamPageQuerySchema),
  ourTeamPageController.getOurTeamPage
);

export default router;
