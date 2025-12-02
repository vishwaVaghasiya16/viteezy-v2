import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import {
  validateJoi,
  validateParams,
  validateQuery,
} from "@/middleware/joiValidation";
import { adminCouponController } from "@/controllers/adminCouponController";
import {
  createCouponSchema,
  updateCouponSchema,
  couponIdParamsSchema,
  updateCouponStatusSchema,
} from "@/validation/adminCouponValidation";
import { paginationQuerySchema } from "../validation/commonValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route POST /api/v1/admin/coupons
 * @desc Create a new coupon
 * @access Admin
 * @body {String} code - Coupon code (required, unique, uppercase)
 * @body {String} type - Discount type: "Percentage" or "Fixed" (required)
 * @body {Number} value - Discount value (required)
 * @body {Number} [minOrderAmount] - Minimum cart amount
 * @body {Number} [maxDiscountAmount] - Maximum discount amount
 * @body {Number} [usageLimit] - Max global usage
 * @body {Number} [userUsageLimit] - Max usage per user
 * @body {Date} [validFrom] - Valid from date
 * @body {Date} [validUntil] - Expiry date
 * @body {Boolean} [isActive] - Active status (default: true)
 * @body {Boolean} [isRecurring] - Can be used again on renewals (default: false)
 * @body {Boolean} [oneTimeUse] - Customer can use this coupon once in their lifetime (default: false)
 */
router.post(
  "/",
  validateJoi(createCouponSchema),
  adminCouponController.createCoupon
);

/**
 * @route GET /api/v1/admin/coupons
 * @desc Get paginated list of coupons
 * @access Admin
 * @query {Number} [page] - Page number (default: 1)
 * @query {Number} [limit] - Items per page (default: 10)
 * @query {String} [status] - Filter by status: "active", "inactive", or "all"
 * @query {String} [type] - Filter by discount type
 * @query {String} [search] - Search by code or name
 */
router.get(
  "/",
  validateQuery(paginationQuerySchema),
  adminCouponController.getCoupons
);

/**
 * @route GET /api/v1/admin/coupons/:id
 * @desc Get coupon by ID
 * @access Admin
 * @param {String} id - Coupon ID (MongoDB ObjectId)
 */
router.get(
  "/:id",
  validateParams(couponIdParamsSchema),
  adminCouponController.getCouponById
);

/**
 * @route PUT /api/v1/admin/coupons/:id
 * @desc Update coupon
 * @access Admin
 * @param {String} id - Coupon ID (MongoDB ObjectId)
 * @body {Object} - Update coupon fields (all fields optional)
 */
router.put(
  "/:id",
  validateParams(couponIdParamsSchema),
  validateJoi(updateCouponSchema),
  adminCouponController.updateCoupon
);

/**
 * @route PATCH /api/v1/admin/coupons/:id/status
 * @desc Update coupon status (toggle active/inactive)
 * @access Admin
 * @param {String} id - Coupon ID (MongoDB ObjectId)
 * @body {Boolean} isActive - Active status
 */
router.patch(
  "/:id/status",
  validateParams(couponIdParamsSchema),
  validateJoi(updateCouponStatusSchema),
  adminCouponController.updateCouponStatus
);

/**
 * @route DELETE /api/v1/admin/coupons/:id
 * @desc Delete coupon (soft delete)
 * @access Admin
 * @param {String} id - Coupon ID (MongoDB ObjectId)
 */
router.delete(
  "/:id",
  validateParams(couponIdParamsSchema),
  adminCouponController.deleteCoupon
);

export default router;
