import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Coupons } from "@/models/commerce";
import { CouponType } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

const sanitizeObjectIdArray = (
  arr?: string[]
): mongoose.Types.ObjectId[] | undefined => {
  if (!Array.isArray(arr)) return undefined;
  return arr.map((id) => ensureObjectId(id, "ObjectId"));
};

class AdminCouponController {
  /**
   * Create a new coupon
   */
  createCoupon = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const {
        code,
        name,
        description,
        type,
        value,
        minOrderAmount,
        maxDiscountAmount,
        usageLimit,
        userUsageLimit,
        validFrom,
        validUntil,
        isActive = true,
        isRecurring = false,
        oneTimeUse = false,
        applicableProducts,
        applicableCategories,
        excludedProducts,
      } = req.body;

      // Check if coupon code already exists
      const existingCoupon = await Coupons.findOne({
        code: code.toUpperCase().trim(),
        isDeleted: false,
      });

      if (existingCoupon) {
        throw new AppError("Coupon code already exists", 400);
      }

      // Validate percentage value
      if (type === CouponType.PERCENTAGE && (value < 0 || value > 100)) {
        throw new AppError(
          "Percentage discount value must be between 0 and 100",
          400
        );
      }

      // Validate date range
      if (validFrom && validUntil && validUntil <= validFrom) {
        throw new AppError("Expiry date must be after valid from date", 400);
      }

      const coupon = await Coupons.create({
        code: code.toUpperCase().trim(),
        name,
        description,
        type,
        value,
        minOrderAmount,
        maxDiscountAmount,
        usageLimit,
        userUsageLimit,
        usageCount: 0,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        isActive,
        isRecurring,
        oneTimeUse,
        applicableProducts: sanitizeObjectIdArray(applicableProducts) || [],
        applicableCategories: sanitizeObjectIdArray(applicableCategories) || [],
        excludedProducts: sanitizeObjectIdArray(excludedProducts) || [],
        createdBy: requesterId,
      });

      res.apiCreated({ coupon }, "Coupon created successfully");
    }
  );

  /**
   * Get paginated list of all coupons (Admin view)
   */
  getCoupons = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, search, type } = req.query as {
        status?: "active" | "inactive" | "all";
        search?: string;
        type?: CouponType;
      };

      const filter: Record<string, any> = {
        isDeleted: false,
      };

      if (status === "active") {
        filter.isActive = true;
      } else if (status === "inactive") {
        filter.isActive = false;
      }

      if (type) {
        filter.type = type;
      }

      if (search) {
        filter.$or = [
          { code: { $regex: search, $options: "i" } },
          { "name.en": { $regex: search, $options: "i" } },
          { "name.nl": { $regex: search, $options: "i" } },
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      const [coupons, total] = await Promise.all([
        Coupons.find(filter)
          .populate("applicableProducts", "name slug")
          .populate("applicableCategories", "name slug")
          .populate("excludedProducts", "name slug")
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Coupons.countDocuments(filter),
      ]);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(coupons, pagination, "Coupons retrieved");
    }
  );

  /**
   * Get coupon by ID
   */
  getCouponById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const coupon = await Coupons.findOne({
        _id: id,
        isDeleted: false,
      })
        .populate("applicableProducts", "name slug")
        .populate("applicableCategories", "name slug")
        .populate("excludedProducts", "name slug")
        .lean();

      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      res.apiSuccess({ coupon }, "Coupon retrieved successfully");
    }
  );

  /**
   * Update coupon
   */
  updateCoupon = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        code,
        name,
        description,
        type,
        value,
        minOrderAmount,
        maxDiscountAmount,
        usageLimit,
        userUsageLimit,
        validFrom,
        validUntil,
        isActive,
        isRecurring,
        oneTimeUse,
        applicableProducts,
        applicableCategories,
        excludedProducts,
      } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const coupon = await Coupons.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      // Check if code is being changed and if new code already exists
      if (code && code.toUpperCase().trim() !== coupon.code) {
        const existingCoupon = await Coupons.findOne({
          code: code.toUpperCase().trim(),
          _id: { $ne: coupon._id },
          isDeleted: false,
        });

        if (existingCoupon) {
          throw new AppError("Coupon code already exists", 400);
        }
        coupon.code = code.toUpperCase().trim();
      }

      // Update fields
      if (name !== undefined) coupon.name = name;
      if (description !== undefined) coupon.description = description;
      if (type !== undefined) coupon.type = type;
      if (value !== undefined) {
        // Validate percentage value
        if (
          (type || coupon.type) === CouponType.PERCENTAGE &&
          (value < 0 || value > 100)
        ) {
          throw new AppError(
            "Percentage discount value must be between 0 and 100",
            400
          );
        }
        coupon.value = value;
      }
      if (minOrderAmount !== undefined) coupon.minOrderAmount = minOrderAmount;
      if (maxDiscountAmount !== undefined)
        coupon.maxDiscountAmount = maxDiscountAmount;
      if (usageLimit !== undefined) coupon.usageLimit = usageLimit;
      if (userUsageLimit !== undefined) coupon.userUsageLimit = userUsageLimit;
      if (validFrom !== undefined) {
        coupon.validFrom = validFrom ? new Date(validFrom) : undefined;
      }
      if (validUntil !== undefined) {
        coupon.validUntil = validUntil ? new Date(validUntil) : undefined;
      }
      if (isActive !== undefined) coupon.isActive = isActive;
      if (isRecurring !== undefined) coupon.isRecurring = isRecurring;
      if (oneTimeUse !== undefined) coupon.oneTimeUse = oneTimeUse;
      if (applicableProducts !== undefined)
        coupon.applicableProducts =
          sanitizeObjectIdArray(applicableProducts) || [];
      if (applicableCategories !== undefined)
        coupon.applicableCategories =
          sanitizeObjectIdArray(applicableCategories) || [];
      if (excludedProducts !== undefined)
        coupon.excludedProducts = sanitizeObjectIdArray(excludedProducts) || [];

      // Validate date range
      const finalValidFrom = coupon.validFrom || validFrom;
      const finalValidUntil = coupon.validUntil || validUntil;
      if (
        finalValidFrom &&
        finalValidUntil &&
        finalValidUntil <= finalValidFrom
      ) {
        throw new AppError("Expiry date must be after valid from date", 400);
      }

      if (requesterId) coupon.updatedBy = requesterId;

      await coupon.save();

      res.apiSuccess({ coupon }, "Coupon updated successfully");
    }
  );

  /**
   * Update coupon status (toggle active/inactive)
   */
  updateCouponStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { isActive } = req.body;

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      const coupon = await Coupons.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      coupon.isActive = isActive;
      if (requesterId) coupon.updatedBy = requesterId;

      await coupon.save();

      res.apiSuccess(
        { coupon },
        `Coupon ${isActive ? "activated" : "deactivated"} successfully`
      );
    }
  );

  /**
   * Delete coupon (soft delete)
   */
  deleteCoupon = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const coupon = await Coupons.findOne({
        _id: id,
        isDeleted: false,
      });

      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      coupon.isDeleted = true;
      coupon.deletedAt = new Date();
      await coupon.save();

      res.apiSuccess(null, "Coupon deleted successfully");
    }
  );
}

export const adminCouponController = new AdminCouponController();
