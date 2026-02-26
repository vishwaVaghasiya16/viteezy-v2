import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateJoi, validateParams, validateQuery } from "@/middleware/joiValidation";
import { adminDeliveryPostponementController } from "@/controllers/adminDeliveryPostponementController";
import {
  adminListPostponementsQuerySchema,
  adminApprovePostponementSchema,
  adminRejectPostponementSchema,
  adminPostponementIdParamsSchema,
  adminUpdateApprovedDateSchema,
} from "@/validation/deliveryPostponementValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route   GET /api/v1/admin/postponements
 * @desc    List all delivery postponement requests (user, plan, dates, status)
 * @access  Admin
 * @query   status, page, limit
 */
router.get(
  "/",
  validateQuery(adminListPostponementsQuerySchema),
  adminDeliveryPostponementController.listAll
);

/**
 * @route   POST /api/v1/admin/postponements/:id/approve
 * @desc    Approve request; optionally send approvedDeliveryDate to modify date
 * @access  Admin
 * @body    { approvedDeliveryDate?: string (ISO) }
 */
router.post(
  "/:id/approve",
  validateParams(adminPostponementIdParamsSchema),
  validateJoi(adminApprovePostponementSchema),
  adminDeliveryPostponementController.approve
);

/**
 * @route   PATCH /api/v1/admin/postponements/:id/approved-date
 * @desc    Update approved delivery date (only when postponement is already approved); syncs to subscription
 * @access  Admin
 * @body    { approvedDeliveryDate: string (ISO) }
 */
router.patch(
  "/:id/approved-date",
  validateParams(adminPostponementIdParamsSchema),
  validateJoi(adminUpdateApprovedDateSchema),
  adminDeliveryPostponementController.updateApprovedDate
);

/**
 * @route   POST /api/v1/admin/postponements/:id/reject
 * @desc    Reject request (mandatory reason)
 * @access  Admin
 * @body    { reason: string }
 */
router.post(
  "/:id/reject",
  validateParams(adminPostponementIdParamsSchema),
  validateJoi(adminRejectPostponementSchema),
  adminDeliveryPostponementController.reject
);

export default router;
