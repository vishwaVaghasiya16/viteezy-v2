import { Request, Response, NextFunction } from "express";
import { couponUsageHistoryService } from "../services/couponUsageHistoryService";
import { AppError } from "../utils/AppError";

/**
 * Coupon Usage History Controller
 * Handles API endpoints for coupon usage history
 */
class CouponUsageHistoryController {
  /**
   * Get coupon usage history for the authenticated user
   * GET /api/v1/coupon-usage-history/my-history
   */
  async getMyUsageHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id || (req as any).user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const couponId = req.query.couponId as string;

      const result = await couponUsageHistoryService.getUserCouponUsageHistory(
        userId,
        {
          page,
          limit,
          couponId,
        }
      );

      res.status(200).json({
        success: true,
        message: "Coupon usage history retrieved successfully",
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get overall user coupon usage data by userId and orderId (Admin only)
   * GET /api/v1/coupon-usage-history/user-order-data
   * If userId and orderId not provided, returns overall usage limit
   */
  async getUserOrderCouponData(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, orderId } = req.query;

      // If no userId and orderId provided, return overall usage limit
      if (!userId && !orderId) {
        const overallData =
          await couponUsageHistoryService.getOverallUsageLimit();
        res.status(200).json({
          success: true,
          message: "Overall usage limit retrieved successfully",
          data: overallData,
        });
        return;
      }

      // If only one parameter is provided, throw error
      if (!userId || !orderId) {
        throw new AppError(
          "Both userId and orderId are required, or provide neither for overall data",
          400
        );
      }

      const result = await couponUsageHistoryService.getUserOrderCouponData(
        userId as string,
        orderId as string
      );

      res.status(200).json({
        success: true,
        message: "User order coupon data retrieved successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const couponUsageHistoryController = new CouponUsageHistoryController();
