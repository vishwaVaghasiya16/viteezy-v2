/**
 * @fileoverview Referral Routes
 * @description Routes for referral code-related operations
 * @module routes/referralRoutes
 */

import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { validateReferralCodeSchema } from "@/validation/referralValidation";
import { referralController } from "@/controllers/referralController";

const router = Router();

/**
 * All referral routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/v1/referrals/validate
 * @desc    Validate and apply/remove referral code from cart
 * @access  Private
 * @body    cartId (required), referralCode (optional, null to remove)
 */
router.post(
  "/validate",
  validateJoi(validateReferralCodeSchema),
  referralController.validateReferralCode
);

export default router;

