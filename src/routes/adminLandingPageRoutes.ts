import { Router } from "express";
import { landingPageController } from "../controllers/landingPageController";
import { authMiddleware, authorize } from "../middleware/auth";
import { validateJoi } from "../middleware/joiValidation";
import {
  createLandingPageSchema,
  updateLandingPageSchema,
} from "../validation/landingPageValidation";
import { upload } from "../middleware/upload";
import { parseLandingPageFormData } from "../middleware/parseLandingPageFormData";
import { handleLandingPageImageUpload } from "../middleware/landingPageImageUpload";
import { Request, Response, NextFunction } from "express";
import { AppError } from "@/utils/AppError";
import multer from "multer";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/landing-pages
 * @desc Create a new landing page (supports form-data with file uploads)
 * @access Admin
 */
router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    upload.fields([
      { name: "heroSection_media_url", maxCount: 1 },
      { name: "membershipBackgroundImage", maxCount: 1 },
      { name: "missionBackgroundImage", maxCount: 1 },
      { name: "howItWorksStepImages", maxCount: 10 },
      { name: "designedByScienceStepImages", maxCount: 10 },
      { name: "featureIcons", maxCount: 10 },
    ])(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new AppError(
                `Unexpected file field: ${err.field}. Allowed fields are: heroSection_media_url, membershipBackgroundImage, missionBackgroundImage, howItWorksStepImages, designedByScienceStepImages, featureIcons`,
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
  parseLandingPageFormData,
  handleLandingPageImageUpload,
  validateJoi(createLandingPageSchema),
  landingPageController.createLandingPage
);

/**
 * @route GET /api/v1/admin/landing-pages
 * @desc Get all landing pages
 * @access Admin
 */
router.get("/", landingPageController.getAllLandingPages);

/**
 * @route GET /api/v1/admin/landing-pages/:id
 * @desc Get landing page by ID
 * @access Admin
 */
router.get("/:id", landingPageController.getLandingPageById);

/**
 * @route PUT /api/v1/admin/landing-pages/:id
 * @desc Update landing page (supports form-data with file uploads)
 * @access Admin
 */
router.put(
  "/:id",
  (req: Request, res: Response, next: NextFunction) => {
    upload.fields([
      { name: "heroSection_media_url", maxCount: 1 },
      { name: "membershipBackgroundImage", maxCount: 1 },
      { name: "missionBackgroundImage", maxCount: 1 },
      { name: "howItWorksStepImages", maxCount: 10 },
      { name: "designedByScienceStepImages", maxCount: 10 },
      { name: "featureIcons", maxCount: 10 },
    ])(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new AppError(
                `Unexpected file field: ${err.field}. Allowed fields are: heroSection_media_url, membershipBackgroundImage, missionBackgroundImage, howItWorksStepImages, designedByScienceStepImages, featureIcons`,
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
  parseLandingPageFormData,
  handleLandingPageImageUpload,
  validateJoi(updateLandingPageSchema),
  landingPageController.updateLandingPage
);

/**
 * @route DELETE /api/v1/admin/landing-pages/:id
 * @desc Delete landing page (soft delete)
 * @access Admin
 */
router.delete("/:id", landingPageController.deleteLandingPage);

export default router;

