/**
 * @fileoverview Coupon Routes
 * @description Routes for coupon-related operations
 * @module routes/couponRoutes
 */

import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi } from "@/middleware/joiValidation";
import { validateCouponSchema } from "@/validation/couponValidation";
import { couponController } from "@/controllers/couponController";

const router = Router();

/**
 * All coupon routes require authentication
 */
router.use(authenticate);

/**
 * @route   POST /api/coupons/validate
 * @desc    Validate and apply/remove coupon from cart
 * @access  Private
 * @body    cartId (required), couponCode (optional, null to remove), language (optional, default: "en")
 */
router.post(
  "/validate",
  validateJoi(validateCouponSchema),
  couponController.validateCoupon
);

export default router;
