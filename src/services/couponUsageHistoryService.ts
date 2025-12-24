import mongoose from "mongoose";
import { CouponUsageHistory } from "../models/commerce/couponUsageHistory.model";
import { Coupons } from "../models/commerce/coupons.model";
import { Orders } from "../models/commerce/orders.model";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { PriceType } from "../models/common.model";

/**
 * Coupon Usage History Service
 * Handles tracking of coupon usage after successful payments
 */
class CouponUsageHistoryService {
  /**
   * Track coupon usage after successful payment and order placement
   * This should be called only after payment is confirmed
   */
  async trackCouponUsage(data: {
    couponId: string | mongoose.Types.ObjectId;
    userId: string | mongoose.Types.ObjectId;
    orderId: string | mongoose.Types.ObjectId;
    discountAmount: PriceType;
    couponCode: string;
    orderNumber?: string;
    createdBy?: mongoose.Types.ObjectId;
  }): Promise<any> {
    try {
      // Validate that the coupon exists
      const coupon = await Coupons.findById(data.couponId);
      if (!coupon) {
        throw new AppError("Coupon not found", 404);
      }

      // Validate that the order exists
      const order = await Orders.findById(data.orderId);
      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Check if this coupon usage has already been tracked for this order
      // to prevent duplicate entries
      const existingUsage = await CouponUsageHistory.findOne({
        orderId: data.orderId,
        couponId: data.couponId,
      });

      if (existingUsage) {
        logger.warn(
          `Coupon usage already tracked for order ${data.orderId} and coupon ${data.couponId}`
        );
        return existingUsage;
      }

      // Get the current usage count for this user and coupon
      const userCouponUsageCount = await CouponUsageHistory.countDocuments({
        userId: data.userId,
        couponId: data.couponId,
      });

      // Create new usage history record
      const usageHistory = await CouponUsageHistory.create({
        couponId: data.couponId,
        userId: data.userId,
        orderId: data.orderId,
        usageCount: userCouponUsageCount + 1, // Increment count for this user
        discountAmount: data.discountAmount,
        couponCode: data.couponCode.toUpperCase(),
        orderNumber: data.orderNumber,
        createdBy: data.createdBy,
      });

      // Update the coupon's global usage count
      await Coupons.findByIdAndUpdate(data.couponId, {
        $inc: { usageCount: 1 },
      });

      logger.info(
        `Coupon usage tracked: ${data.couponCode} for order ${
          data.orderNumber || data.orderId
        }`
      );

      return usageHistory;
    } catch (error: any) {
      logger.error("Failed to track coupon usage:", error);
      throw error instanceof AppError
        ? error
        : new AppError(error.message || "Failed to track coupon usage", 500);
    }
  }

  /**
   * Get coupon usage history for a specific user
   */
  async getUserCouponUsageHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      couponId?: string;
    }
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const skip = (page - 1) * limit;

      const query: any = { userId };
      if (options?.couponId) {
        query.couponId = options.couponId;
      }

      const [data, total] = await Promise.all([
        CouponUsageHistory.find(query)
          .populate("couponId", "code name type value")
          .populate("orderId", "orderNumber total status")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CouponUsageHistory.countDocuments(query),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error("Failed to get user coupon usage history:", error);
      throw new AppError(
        error.message || "Failed to get coupon usage history",
        500
      );
    }
  }

  /**
   * Get coupon usage history for a specific coupon
   */
  async getCouponUsageHistory(
    couponId: string,
    options?: {
      page?: number;
      limit?: number;
      userId?: string;
    }
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalDiscountGiven: number;
  }> {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const skip = (page - 1) * limit;

      const query: any = { couponId };
      if (options?.userId) {
        query.userId = options.userId;
      }

      const [data, total] = await Promise.all([
        CouponUsageHistory.find(query)
          .populate("userId", "firstName lastName email")
          .populate("orderId", "orderNumber total status")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CouponUsageHistory.countDocuments(query),
      ]);

      // Calculate total discount given
      const discountAggregation = await CouponUsageHistory.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalDiscount: { $sum: "$discountAmount.amount" },
          },
        },
      ]);

      const totalDiscountGiven =
        discountAggregation.length > 0
          ? discountAggregation[0].totalDiscount
          : 0;

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalDiscountGiven,
      };
    } catch (error: any) {
      logger.error("Failed to get coupon usage history:", error);
      throw new AppError(
        error.message || "Failed to get coupon usage history",
        500
      );
    }
  }

  /**
   * Get usage count for a specific user and coupon
   */
  async getUserCouponUsageCount(
    userId: string,
    couponId: string
  ): Promise<number> {
    try {
      const count = await CouponUsageHistory.countDocuments({
        userId,
        couponId,
      });
      return count;
    } catch (error: any) {
      logger.error("Failed to get user coupon usage count:", error);
      throw new AppError(error.message || "Failed to get usage count", 500);
    }
  }

  /**
   * Get coupon usage statistics
   */
  async getCouponUsageStats(couponId: string): Promise<{
    totalUsages: number;
    uniqueUsers: number;
    totalDiscountGiven: number;
    averageDiscountPerUse: number;
    recentUsages: any[];
  }> {
    try {
      const [stats, recentUsages] = await Promise.all([
        CouponUsageHistory.aggregate([
          { $match: { couponId: new mongoose.Types.ObjectId(couponId) } },
          {
            $group: {
              _id: null,
              totalUsages: { $sum: 1 },
              uniqueUsers: { $addToSet: "$userId" },
              totalDiscount: { $sum: "$discountAmount.amount" },
            },
          },
          {
            $project: {
              totalUsages: 1,
              uniqueUsers: { $size: "$uniqueUsers" },
              totalDiscount: 1,
              averageDiscount: {
                $cond: [
                  { $gt: ["$totalUsages", 0] },
                  { $divide: ["$totalDiscount", "$totalUsages"] },
                  0,
                ],
              },
            },
          },
        ]),
        CouponUsageHistory.find({ couponId })
          .populate("userId", "firstName lastName email")
          .populate("orderId", "orderNumber total")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

      const result = stats[0] || {
        totalUsages: 0,
        uniqueUsers: 0,
        totalDiscount: 0,
        averageDiscount: 0,
      };

      return {
        totalUsages: result.totalUsages,
        uniqueUsers: result.uniqueUsers,
        totalDiscountGiven: result.totalDiscount,
        averageDiscountPerUse: result.averageDiscount,
        recentUsages,
      };
    } catch (error: any) {
      logger.error("Failed to get coupon usage stats:", error);
      throw new AppError(
        error.message || "Failed to get coupon usage statistics",
        500
      );
    }
  }

  /**
   * Delete coupon usage history for a specific order
   * (Used when order is cancelled or refunded)
   */
  async deleteCouponUsageByOrder(orderId: string): Promise<void> {
    try {
      const usageRecords = await CouponUsageHistory.find({ orderId });

      if (usageRecords.length > 0) {
        // Decrement the coupon usage counts
        for (const record of usageRecords) {
          await Coupons.findByIdAndUpdate(record.couponId, {
            $inc: { usageCount: -1 },
          });
        }

        // Delete the usage records
        await CouponUsageHistory.deleteMany({ orderId });

        logger.info(
          `Deleted ${usageRecords.length} coupon usage records for order ${orderId}`
        );
      }
    } catch (error: any) {
      logger.error("Failed to delete coupon usage by order:", error);
      throw new AppError(error.message || "Failed to delete coupon usage", 500);
    }
  }

  /**
   * Get overall user coupon usage data by userId and orderId
   */
  async getUserOrderCouponData(
    userId: string,
    orderId: string
  ): Promise<{
    userId: string;
    orderId: string;
    couponUsageData: any;
    totalCouponUsageByUser: number;
    orderDetails: any;
  }> {
    try {
      // Get coupon usage for this specific order
      const couponUsageData = await CouponUsageHistory.findOne({
        userId,
        orderId,
      })
        .populate("couponId", "code name type value userUsageLimit usageLimit")
        .populate("orderId", "orderNumber total status createdAt")
        .lean();

      // Get total coupon usage count by this user (across all orders)
      const totalCouponUsageByUser = await CouponUsageHistory.countDocuments({
        userId,
      });

      // Get order details
      const order = await Orders.findById(orderId)
        .populate("userId", "firstName lastName email")
        .lean();

      return {
        userId,
        orderId,
        couponUsageData: couponUsageData || null,
        totalCouponUsageByUser,
        orderDetails: order,
      };
    } catch (error: any) {
      logger.error("Failed to get user order coupon data:", error);
      throw new AppError(
        error.message || "Failed to get user order coupon data",
        500
      );
    }
  }

  /**
   * Get overall usage limit statistics
   */
  async getOverallUsageLimit(): Promise<{
    totalCouponUsages: number;
    totalUniqueUsers: number;
    totalUniqueCoupons: number;
    totalDiscountGiven: number;
    recentUsages: any[];
  }> {
    try {
      // Get overall statistics
      const [stats, recentUsages] = await Promise.all([
        CouponUsageHistory.aggregate([
          {
            $group: {
              _id: null,
              totalUsages: { $sum: 1 },
              uniqueUsers: { $addToSet: "$userId" },
              uniqueCoupons: { $addToSet: "$couponId" },
              totalDiscount: { $sum: "$discountAmount.amount" },
            },
          },
          {
            $project: {
              totalUsages: 1,
              uniqueUsers: { $size: "$uniqueUsers" },
              uniqueCoupons: { $size: "$uniqueCoupons" },
              totalDiscount: 1,
            },
          },
        ]),
        CouponUsageHistory.find()
          .populate("userId", "firstName lastName email")
          .populate("couponId", "code name type value")
          .populate("orderId", "orderNumber total")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);

      const result = stats[0] || {
        totalUsages: 0,
        uniqueUsers: 0,
        uniqueCoupons: 0,
        totalDiscount: 0,
      };

      return {
        totalCouponUsages: result.totalUsages,
        totalUniqueUsers: result.uniqueUsers,
        totalUniqueCoupons: result.uniqueCoupons,
        totalDiscountGiven: result.totalDiscount,
        recentUsages,
      };
    } catch (error: any) {
      logger.error("Failed to get overall usage limit:", error);
      throw new AppError(
        error.message || "Failed to get overall usage limit",
        500
      );
    }
  }
}

export const couponUsageHistoryService = new CouponUsageHistoryService();
