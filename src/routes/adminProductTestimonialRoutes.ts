import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateQuery,
  validateParams,
  validateJoi,
} from "@/middleware/joiValidation";
import { adminProductTestimonialController } from "@/controllers/adminProductTestimonialController";
import {
  createProductTestimonialSchema,
  updateProductTestimonialSchema,
  productTestimonialIdParamsSchema,
  listProductTestimonialsQuerySchema,
} from "@/validation/adminProductTestimonialValidation";
import {
  videoAndThumbnailUpload,
  handleVideoAndThumbnailUploadError,
} from "@/middleware/videoUpload";
import { parseFormDataJson } from "@/middleware/parseFormData";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/product-testimonials
 * @desc Create a new product testimonial
 * @access Admin
 * @body {Array} products - Array of product IDs
 * @body {Boolean} [isVisibleOnHomepage] - Show on homepage (default: false)
 * @body {Number} [displayOrder] - Display order (default: 0)
 * @body {String} [metadata] - JSON string for metadata
 * @body {File} video - Video file (MP4, MPEG, MOV, AVI, WEBM, OGG) - Required
 * @body {File} [thumbnail] - Thumbnail image file (JPEG, PNG, GIF, WEBP) - Optional
 */
router.post(
  "/",
  handleVideoAndThumbnailUploadError(
    videoAndThumbnailUpload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ])
  ),
  parseFormDataJson(["products", "metadata"]),
  validateJoi(createProductTestimonialSchema),
  adminProductTestimonialController.createTestimonial
);

/**
 * @route GET /api/v1/admin/product-testimonials
 * @desc Get all product testimonials with pagination and filters
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [search] - Search term
 * @query {Boolean} [isVisibleOnHomepage] - Filter by homepage visibility
 * @query {Boolean} [isActive] - Filter by active status
 */
router.get(
  "/",
  validateQuery(listProductTestimonialsQuerySchema),
  adminProductTestimonialController.getAllTestimonials
);

/**
 * @route GET /api/v1/admin/product-testimonials/:id
 * @desc Get product testimonial by ID
 * @access Admin
 */
router.get(
  "/:id",
  validateParams(productTestimonialIdParamsSchema),
  adminProductTestimonialController.getTestimonialById
);

/**
 * @route PUT /api/v1/admin/product-testimonials/:id
 * @desc Update product testimonial
 * @access Admin
 * @body {Array} [products] - Array of product IDs
 * @body {Boolean} [isVisibleOnHomepage] - Show on homepage
 * @body {Number} [displayOrder] - Display order
 * @body {String} [metadata] - JSON string for metadata
 * @body {File} [video] - New video file (optional)
 * @body {File} [thumbnail] - New thumbnail image file (optional)
 */
router.put(
  "/:id",
  handleVideoAndThumbnailUploadError(
    videoAndThumbnailUpload.fields([
      { name: "video", maxCount: 1 },
      { name: "thumbnail", maxCount: 1 },
    ])
  ),
  parseFormDataJson(["products", "metadata"]),
  validateParams(productTestimonialIdParamsSchema),
  validateJoi(updateProductTestimonialSchema),
  adminProductTestimonialController.updateTestimonial
);

/**
 * @route PATCH /api/v1/admin/product-testimonials/:id/status
 * @desc Toggle testimonial active status
 * @access Admin
 */
router.patch(
  "/:id/status",
  validateParams(productTestimonialIdParamsSchema),
  adminProductTestimonialController.toggleStatus
);

/**
 * @route DELETE /api/v1/admin/product-testimonials/:id
 * @desc Delete product testimonial (soft delete)
 * @access Admin
 */
router.delete(
  "/:id",
  validateParams(productTestimonialIdParamsSchema),
  adminProductTestimonialController.deleteTestimonial
);

export default router;
