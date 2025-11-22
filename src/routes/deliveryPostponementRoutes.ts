import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateJoi,
  validateQuery,
  validateParams,
} from "@/middleware/joiValidation";
import {
  createPostponementSchema,
  getPostponementDetailsParamsSchema,
  getPostponementHistoryQuerySchema,
} from "@/validation/deliveryPostponementValidation";
import { deliveryPostponementController } from "@/controllers/deliveryPostponementController";

const router = Router();

/**
 * All postponement routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/postponements
 * @desc    Create a delivery postponement request
 * @access  Private
 */
router.post(
  "/",
  validateJoi(createPostponementSchema),
  deliveryPostponementController.createPostponement
);

/**
 * @route   GET /api/postponements
 * @desc    Get user's postponement history (Paginated)
 * @access  Private
 * @query   status, orderId, page, limit
 */
router.get(
  "/",
  validateQuery(getPostponementHistoryQuerySchema),
  deliveryPostponementController.getPostponementHistory
);

/**
 * @route   GET /api/postponements/:postponementId
 * @desc    Get postponement details by ID
 * @access  Private
 * @params  postponementId
 */
router.get(
  "/:postponementId",
  validateParams(getPostponementDetailsParamsSchema),
  deliveryPostponementController.getPostponementDetails
);

export default router;
