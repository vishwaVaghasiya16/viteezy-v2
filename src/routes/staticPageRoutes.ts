import { Router } from "express";
import { getStaticPages, getStaticPageByIdOrSlug } from "@/controllers/staticPageController";
import { validateQuery } from "@/middleware/joiValidation";
import Joi from "joi";

const router = Router();

// Query validation schema
const getStaticPagesQuerySchema = Joi.object({
  lang: Joi.string()
    .valid("en", "nl", "de", "fr", "es")
    .optional()
    .default("en")
    .messages({
      "any.only": "Language must be one of: en, nl, de, fr, es",
    }),
});

/**
 * @route   GET /api/v1/static-pages
 * @desc    Get list of active static pages (excluding system pages like about-us, our-team)
 * @access  Public
 * @query   {String} [lang] - Language code (en, nl, de, fr, es) - defaults to 'en'
 */
router.get(
  "/",
  validateQuery(getStaticPagesQuerySchema),
  getStaticPages
);

/**
 * @route   GET /api/v1/static-pages/:idOrSlug
 * @desc    Get static page by ID or slug
 * @access  Public
 * @param   {String} idOrSlug - Static page ID (MongoDB ObjectId) or slug
 * @query   {String} [lang] - Language code (en, nl, de, fr, es) - defaults to 'en'
 */
router.get(
  "/:idOrSlug",
  validateQuery(getStaticPagesQuerySchema),
  getStaticPageByIdOrSlug
);

export default router;

