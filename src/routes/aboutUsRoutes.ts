import { Router } from "express";
import { aboutUsController } from "@/controllers/aboutUsController";
import { validateQuery } from "@/middleware/joiValidation";
import { getAboutUsQuerySchema } from "@/validation/aboutUsValidation";

const router = Router();

/**
 * @route GET /api/v1/about-us
 * @desc Get About Us page content (Public)
 * @access Public
 * @query {String} [lang] - Language code: "en", "nl", "de", "fr", "es" (default: "en")
 */
router.get(
  "/",
  validateQuery(getAboutUsQuerySchema),
  aboutUsController.getAboutUs
);

export default router;
