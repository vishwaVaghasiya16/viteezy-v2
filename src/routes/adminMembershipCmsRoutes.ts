import { Router, Request, Response, NextFunction } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { autoTranslateMiddleware } from "@/middleware/translationMiddleware";
import { transformResponseMiddleware } from "@/middleware/responseTransformMiddleware";
import { adminMembershipCmsController } from "@/controllers/adminMembershipCmsController";
import { createMembershipCmsSchema } from "@/validation/adminMembershipCmsValidation";
import { upload } from "@/middleware/upload";
import { AppError } from "@/utils/AppError";
import multer from "multer";

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/membership-cms
 * @desc Get Membership CMS content
 * @access Admin
 * @note Response is automatically transformed based on admin's language preference from token.
 *       I18n objects are converted to single language strings (no object structure in response).
 *       Since there's only one Membership CMS record, this returns the single record.
 */
router.get(
  "/",
  transformResponseMiddleware("membershipCms"), // Detects language from admin token and transforms I18n fields to single language strings
  adminMembershipCmsController.getMembershipCms
);

/**
 * @route POST /api/v1/admin/membership-cms
 * @desc Create or update Membership CMS content (supports form-data with file uploads)
 * @access Admin
 * @note Since there's only one Membership CMS record, this acts as upsert (create if not exists, update if exists).
 *       Admin enters data in English, and it's automatically translated to all supported languages (en, nl, de, fr, es).
 * @body {String|Object} [heading] - Heading text (plain string in English for auto-translation, or I18n object)
 * @body {String|Object} [description] - Description text (plain string in English for auto-translation, or I18n object)
 * @body {String|Array} [membershipBenefits] - Array of benefit objects (max 3) as JSON string or array.
 *       Each benefit: { title: string|object, subtitle: string|object, image: string }
 *       Admin enters title and subtitle in English, automatically translated to all languages (en, nl, de, fr, es).
 * @body {String|Object} [ctaButtonText] - CTA button text (plain string in English for auto-translation, or I18n object)
 * @body {String|Object} [note] - Note text (plain string in English for auto-translation, or I18n object)
 * @body {Boolean} [isActive] - Active status (default: true)
 * @body {String} [coverImage] - Cover image URL (optional, or upload file)
 * @body {File} [coverImage] - Cover image file (multipart/form-data)
 * @body {File} [benefitImage_0] - Benefit image for first benefit (multipart/form-data)
 * @body {File} [benefitImage_1] - Benefit image for second benefit (multipart/form-data)
 * @body {File} [benefitImage_2] - Benefit image for third benefit (multipart/form-data)
 */
router.post(
  "/",
  (req: Request, res: Response, next: NextFunction) => {
    // Create dynamic fields array for benefit images (up to 3)
    const fields: multer.Field[] = [
      { name: "coverImage", maxCount: 1 },
    ];
    for (let i = 0; i < 3; i++) {
      fields.push({ name: `benefitImage_${i}`, maxCount: 1 });
    }

    upload.fields(fields)(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return next(
              new AppError(
                `Unexpected file field: ${err.field}. Allowed fields are: coverImage, benefitImage_0, benefitImage_1, benefitImage_2`,
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
  autoTranslateMiddleware("membershipCms"), // Auto-translate English to all languages (en, nl, de, fr, es)
  validateJoi(createMembershipCmsSchema),
  adminMembershipCmsController.upsertMembershipCms
);

/**
 * @route DELETE /api/v1/admin/membership-cms
 * @desc Delete Membership CMS entry (soft delete)
 * @access Admin
 * @note Since there's only one Membership CMS record, this deletes the single record
 */
router.delete(
  "/",
  adminMembershipCmsController.deleteMembershipCms
);

export default router;

