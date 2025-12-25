import { Router } from "express";
import { couponUsageHistoryController } from "../controllers/couponUsageHistoryController";
import { authenticate, authorize } from "../middleware/auth";
import { UserRole } from "../models/enums";
import { validate } from "../middleware/joiValidation";
import {
  getMyUsageHistorySchema,
  getUserOrderCouponDataSchema,
} from "../validation/couponUsageHistoryValidation";

const router = Router();

/**
 * @route   GET /api/v1/coupon-usage-history/my-history
 * @desc    Get coupon usage history for authenticated user
 * @access  Private (User)
 */
router.get(
  "/my-history",
  authenticate,
  validate(getMyUsageHistorySchema),
  couponUsageHistoryController.getMyUsageHistory
);

/**
 * @route   GET /api/v1/coupon-usage-history/user-order-data
 * @desc    Get overall user coupon usage data by userId and orderId
 * @access  Private (Admin)
 * @query   userId, orderId (required)
 */
router.get(
  "/user-order-data",
  authenticate,
  authorize(UserRole.ADMIN),
  validate(getUserOrderCouponDataSchema),
  couponUsageHistoryController.getUserOrderCouponData
);

export default router;
