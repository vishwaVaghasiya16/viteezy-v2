import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationMeta, getPaginationOptions } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Coupons, CouponUsageHistory } from "@/models/commerce";
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
   * Get coupon statistics (for current month only)
   */
  getCouponStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      // Get current month date range
      const now = new Date();
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Calculate 7 days from now for expiring soon
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Active coupons count (not deleted, isActive = true, and valid if validUntil is set)
      const activeCouponsFilter: Record<string, any> = {
        isDeleted: false,
        isActive: true,
      };
      
      // Coupons are active if they don't have validUntil or validUntil is in the future
      activeCouponsFilter.$or = [
        { validUntil: { $exists: false } },
        { validUntil: null },
        { validUntil: { $gt: now } },
      ];

      // Coupons expiring soon (within 7 days, active, not deleted)
      const expiringSoonFilter: Record<string, any> = {
        isDeleted: false,
        isActive: true,
        validUntil: {
          $gte: now,
          $lte: sevenDaysFromNow,
        },
      };

      // Get stats in parallel
      const [
        activeCouponsCount,
        expiringSoonCount,
        totalRedemptionsResult,
        totalDiscountAmountResult,
      ] = await Promise.all([
        // Active coupons
        Coupons.countDocuments(activeCouponsFilter),
        
        // Coupons expiring soon
        Coupons.countDocuments(expiringSoonFilter),
        
        // Total redemptions for current month (from coupon usage history)
        CouponUsageHistory.aggregate([
          {
            $match: {
              createdAt: {
                $gte: startOfCurrentMonth,
                $lte: endOfCurrentMonth,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
            },
          },
        ]),
        
        // Total discounted amount for current month
        CouponUsageHistory.aggregate([
          {
            $match: {
              createdAt: {
                $gte: startOfCurrentMonth,
                $lte: endOfCurrentMonth,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$discountAmount.amount" },
              currency: { $first: "$discountAmount.currency" },
            },
          },
        ]),
      ]);

      const totalRedemptions = totalRedemptionsResult[0]?.total || 0;
      const totalDiscountAmount = totalDiscountAmountResult[0]?.total || 0;
      const currency = totalDiscountAmountResult[0]?.currency || "EUR";

      res.apiSuccess(
        {
          stats: {
            activeCoupons: activeCouponsCount,
            totalRedemptions,
            totalDiscountedAmount: {
              amount: totalDiscountAmount,
              currency,
            },
            expiringSoon: expiringSoonCount,
          },
        },
        "Coupon statistics retrieved successfully"
      );
    }
  );

  /**
   * Get paginated list of all coupons (Admin view)
   */
  getCoupons = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, search, type, expiryDateFrom, expiryDateTo } = req.query as {
        status?: "active" | "inactive" | "all";
        search?: string;
        type?: CouponType;
        expiryDateFrom?: string;
        expiryDateTo?: string;
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

      // Filter by expiry date range
      if (expiryDateFrom || expiryDateTo) {
        filter.validUntil = {};
        if (expiryDateFrom) {
          const fromDate = new Date(expiryDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          filter.validUntil.$gte = fromDate;
        }
        if (expiryDateTo) {
          const toDate = new Date(expiryDateTo);
          toDate.setHours(23, 59, 59, 999);
          filter.validUntil.$lte = toDate;
        }
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

  /**
   * Get coupon usage logs (Admin view) with filters
   */
  getCouponUsageLogs = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip } = getPaginationOptions(req);
      const { status, search, expiryDateFrom, expiryDateTo, couponId } = req.query as {
        status?: "active" | "inactive" | "all";
        search?: string;
        expiryDateFrom?: string;
        expiryDateTo?: string;
        couponId?: string;
      };

      // Build match filter for usage history
      const matchFilter: Record<string, any> = {};

      // Filter by coupon ID if provided
      if (couponId) {
        matchFilter.couponId = new mongoose.Types.ObjectId(couponId);
      }

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match usage history records
        { $match: matchFilter },
        // Lookup coupon details
        {
          $lookup: {
            from: "coupons",
            localField: "couponId",
            foreignField: "_id",
            as: "coupon",
          },
        },
        { $unwind: { path: "$coupon", preserveNullAndEmptyArrays: true } },
      ];

      // Build coupon filter - only apply if filters are provided
      const couponFilters: any[] = [];

      // Filter by status if provided
      if (status === "active") {
        couponFilters.push({
          $or: [
            { "coupon.isActive": true },
            { coupon: { $exists: false } },
            { coupon: null },
          ],
        });
      } else if (status === "inactive") {
        couponFilters.push({
          $or: [
            { "coupon.isActive": false },
            { coupon: { $exists: false } },
            { coupon: null },
          ],
        });
      }

      // Filter by expiry date if provided
      if (expiryDateFrom || expiryDateTo) {
        const expiryFilter: Record<string, any> = {};
        if (expiryDateFrom) {
          const fromDate = new Date(expiryDateFrom);
          fromDate.setHours(0, 0, 0, 0);
          expiryFilter.$gte = fromDate;
        }
        if (expiryDateTo) {
          const toDate = new Date(expiryDateTo);
          toDate.setHours(23, 59, 59, 999);
          expiryFilter.$lte = toDate;
        }
        couponFilters.push({
          $or: [
            { "coupon.validUntil": expiryFilter },
            { coupon: { $exists: false } },
            { coupon: null },
          ],
        });
      }

      // Apply coupon filters if any
      if (couponFilters.length > 0) {
        pipeline.push({ $match: { $and: couponFilters } });
      }

      // Add search filter if provided
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { couponCode: { $regex: search, $options: "i" } },
              { "coupon.code": { $regex: search, $options: "i" } },
              { "coupon.name.en": { $regex: search, $options: "i" } },
              { "coupon.name.nl": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Count total before pagination
      const countPipeline = [...pipeline, { $count: "total" }];
      const countResult = await CouponUsageHistory.aggregate(countPipeline);
      const total = countResult[0]?.total || 0;

      // Add pagination and sorting
      pipeline.push(
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
      );

      // Lookup user and order details
      pipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $lookup: {
            from: "orders",
            localField: "orderId",
            foreignField: "_id",
            as: "order",
          },
        },
        {
          $unwind: { path: "$user", preserveNullAndEmptyArrays: true },
        },
        {
          $unwind: { path: "$order", preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: { $toString: "$_id" },
            couponId: {
              $cond: {
                if: { $ne: ["$couponId", null] },
                then: { $toString: "$couponId" },
                else: null,
              },
            },
            userId: {
              $cond: {
                if: { $ne: ["$userId", null] },
                then: { $toString: "$userId" },
                else: null,
              },
            },
            orderId: {
              $cond: {
                if: { $ne: ["$orderId", null] },
                then: { $toString: "$orderId" },
                else: null,
              },
            },
            couponCode: 1,
            orderNumber: 1,
            discountAmount: 1,
            usageCount: 1,
            createdAt: 1,
            updatedAt: 1,
            coupon: {
              _id: {
                $cond: {
                  if: { $ne: ["$coupon._id", null] },
                  then: { $toString: "$coupon._id" },
                  else: null,
                },
              },
              code: "$coupon.code",
              name: "$coupon.name",
              type: "$coupon.type",
              value: "$coupon.value",
              isActive: "$coupon.isActive",
              validUntil: "$coupon.validUntil",
            },
            user: {
              _id: {
                $cond: {
                  if: { $ne: ["$user._id", null] },
                  then: { $toString: "$user._id" },
                  else: null,
                },
              },
              firstName: "$user.firstName",
              lastName: "$user.lastName",
              email: "$user.email",
            },
            order: {
              _id: {
                $cond: {
                  if: { $ne: ["$order._id", null] },
                  then: { $toString: "$order._id" },
                  else: null,
                },
              },
              orderNumber: "$order.orderNumber",
              total: "$order.total",
              status: "$order.status",
            },
          },
        }
      );

      const usageLogs = await CouponUsageHistory.aggregate(pipeline);

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(usageLogs, pagination, "Coupon usage logs retrieved");
    }
  );
}

export const adminCouponController = new AdminCouponController();
