import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi, validateParams } from "@/middleware/joiValidation";
import { adminAboutUsController } from "@/controllers/adminAboutUsController";
import {
  upsertAboutUsSchema,
  updateSectionParamsSchema,
  bannerSectionDataSchema,
  founderStorySectionDataSchema,
  meetBrainsSectionDataSchema,
  timelineSectionDataSchema,
  peopleSectionDataSchema,
} from "@/validation/adminAboutUsValidation";
import { upload } from "@/middleware/upload";
import { parseAboutUsFormData } from "@/middleware/parseAboutUsFormData";
import { handleAboutUsImageUpload } from "@/middleware/aboutUsImageUpload";
import { AppError } from "@/utils/AppError";
import multer from "multer";
import Joi from "joi";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/about-us
 * @desc Get About Us page content
 * @access Admin
 */
router.get("/", adminAboutUsController.getAboutUs);

/**
 * @route POST /api/v1/admin/about-us
 * @desc Create or update About Us page content (supports form-data with file uploads)
 * @access Admin
 * @body {Object} [banner] - Banner section data
 * @body {Object} [founderStory] - Founder quote section data
 * @body {Object} [meetBrains] - Meet brains section data
 * @body {Object} [timeline] - Timeline section data
 * @body {Object} [people] - People section data
 * @body {File} [banner_image] - Banner image file
 * @body {File} [meet_brains_main_image] - Meet brains main image file
 */
router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.fields([
      { name: "banner_image", maxCount: 1 },
      { name: "meet_brains_main_image", maxCount: 1 },
      { name: "founder_image", maxCount: 1 },
      { name: "people_images", maxCount: 20 },
    ])(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new AppError(
                `Unexpected file field: ${err.field}. Allowed fields are: banner_image, meet_brains_main_image, founder_image, people_images`,
                400
              )
            );
          }
          return next(new AppError(`File upload error: ${err.message}`, 400));
        }
        return next(err);
      }
      next();
    });
  },
  parseAboutUsFormData,
  handleAboutUsImageUpload,
  validateJoi(upsertAboutUsSchema),
  adminAboutUsController.upsertAboutUs
);

/**
 * @route PUT /api/v1/admin/about-us
 * @desc Update About Us page content (supports form-data with file uploads)
 * @access Admin
 * @body {Object} [banner] - Banner section data
 * @body {Object} [founderStory] - Founder quote section data
 * @body {Object} [meetBrains] - Meet brains section data
 * @body {Object} [timeline] - Timeline section data
 * @body {Object} [people] - People section data
 * @body {File} [banner_image] - Banner image file
 * @body {File} [meet_brains_main_image] - Meet brains main image file
 * @body {File} [founder_image] - Founder image file
 * @body {File[]} [people_images] - People section images
 */
router.put(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.fields([
      { name: "banner_image", maxCount: 1 },
      { name: "meet_brains_main_image", maxCount: 1 },
      { name: "founder_image", maxCount: 1 },
      { name: "people_images", maxCount: 20 },
    ])(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new AppError(
                `Unexpected file field: ${err.field}. Allowed fields are: banner_image, meet_brains_main_image, founder_image, people_images`,
                400
              )
            );
          }
          return next(new AppError(`File upload error: ${err.message}`, 400));
        }
        return next(err);
      }
      next();
    });
  },
  parseAboutUsFormData,
  handleAboutUsImageUpload,
  validateJoi(upsertAboutUsSchema),
  adminAboutUsController.upsertAboutUs
);

/**
 * @route PATCH /api/v1/admin/about-us/sections/:section
 * @desc Update specific section of About Us page
 * @access Admin
 * @param {String} section - Section name (banner, founderStory, meetBrains, timeline, people)
 * @body {Object} sectionData - Section data to update
 * @body {File} [banner_image] - Banner image (if section is banner)
 * @body {File} [meet_brains_main_image] - Meet brains main image (if section is meetBrains)
 */
router.patch(
  "/sections/:section",
  (req: Request, res: Response, next: NextFunction) => {
    // Only upload images if the section requires them
    const section = req.params.section;
    const fields: multer.Field[] = [];

    if (section === "banner") {
      fields.push({ name: "banner_image", maxCount: 1 });
    } else if (section === "meetBrains") {
      fields.push({ name: "meet_brains_main_image", maxCount: 1 });
    }

    if (fields.length > 0) {
      upload.fields(fields)(req, res, (err: any) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return next(new AppError(`File upload error: ${err.message}`, 400));
          }
          return next(err);
        }
        next();
      });
    } else {
      next();
    }
  },
  parseAboutUsFormData,
  handleAboutUsImageUpload,
  validateParams(updateSectionParamsSchema),
  // Dynamic validation based on section type
  (req: Request, res: Response, next: NextFunction) => {
    const { section } = req.params;
    let schema: Joi.Schema | undefined;

    switch (section) {
      case "banner":
        schema = bannerSectionDataSchema;
        break;
      case "founderStory":
        schema = founderStorySectionDataSchema;
        break;
      case "meetBrains":
        schema = meetBrainsSectionDataSchema;
        break;
      case "timeline":
        schema = timelineSectionDataSchema;
        break;
      case "people":
        schema = peopleSectionDataSchema;
        break;
      default:
        return next();
    }

    if (schema) {
      // Custom validation for AlternativesSchema
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: false,
        allowUnknown: false,
        convert: true,
      });

      if (error) {
        const firstError = error.details[0];
        const errorMessage = firstError?.message || "Validation error";
        return next(
          new AppError(
            errorMessage.replace(/"/g, ""),
            400,
            true,
            "Validation Error"
          )
        );
      }

      req.body = value;
    }
    next();
  },
  adminAboutUsController.updateSection
);

/**
 * @route DELETE /api/v1/admin/about-us
 * @desc Delete About Us page (soft delete)
 * @access Admin
 */
router.delete("/", adminAboutUsController.deleteAboutUs);

export default router;
