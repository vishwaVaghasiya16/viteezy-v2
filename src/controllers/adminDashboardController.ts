import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { User } from "@/models/core";
import {
  Orders,
  Payments,
  Subscriptions,
  Memberships,
  Products,
  ProductVariants,
} from "@/models/commerce";

import {
  PaymentStatus,
  SubscriptionStatus,
  MembershipStatus,
  SubscriptionCycle,
  OrderPlanType,
} from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

class AdminDashboardController {
  /**
   * -------------------------------------------
   *  GET DASHBOARD STATS
   * -------------------------------------------
   */
  getDashboardStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const now = new Date();

      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999
      );

      // Parallel execution (best performance)
      const [
        totalUsers,
        currentMonthUsers,
        lastMonthUsers,

        totalOrders,
        currentMonthOrders,
        lastMonthOrders,

        revenueTotalAgg,
        revenueCurrentAgg,
        revenueLastAgg,

        activeSubscriptions,
        currentMonthActiveSubscriptions,
        lastMonthActiveSubscriptions,

        membershipPurchases,
        currentMonthMembershipPurchases,
        lastMonthMembershipPurchases,
      ] = await Promise.all([
        // Users
        User.countDocuments({}),
        User.countDocuments({ createdAt: { $gte: startOfCurrentMonth } }),
        User.countDocuments({
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),

        // Orders
        Orders.countDocuments({ isDeleted: { $ne: true } }),
        Orders.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfCurrentMonth },
        }),
        Orders.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),

        // Revenue (Completed Payments)
        Payments.aggregate([
          {
            $match: {
              status: PaymentStatus.COMPLETED,
              isDeleted: { $ne: true },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount.amount" } } },
        ]),
        Payments.aggregate([
          {
            $match: {
              status: PaymentStatus.COMPLETED,
              isDeleted: { $ne: true },
              createdAt: { $gte: startOfCurrentMonth },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount.amount" } } },
        ]),
        Payments.aggregate([
          {
            $match: {
              status: PaymentStatus.COMPLETED,
              isDeleted: { $ne: true },
              createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount.amount" } } },
        ]),

        // Active Subscriptions
        Subscriptions.countDocuments({
          status: SubscriptionStatus.ACTIVE,
          isDeleted: { $ne: true },
        }),
        Subscriptions.countDocuments({
          status: SubscriptionStatus.ACTIVE,
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfCurrentMonth },
        }),
        Subscriptions.countDocuments({
          status: SubscriptionStatus.ACTIVE,
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),

        // Membership Purchases
        Memberships.countDocuments({ isDeleted: { $ne: true } }),
        Memberships.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfCurrentMonth },
        }),
        Memberships.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
      ]);

      // Safe revenue values
      const totalRevenue = revenueTotalAgg[0]?.total || 0;
      const currentMonthRevenue = revenueCurrentAgg[0]?.total || 0;
      const lastMonthRevenue = revenueLastAgg[0]?.total || 0;

      // Standard SaaS percentage logic
      const percentChange = (current: number, previous: number) => {
        if (previous === 0 && current > 0)
          return { percentage: 100, isPositive: true };
        if (previous === 0 && current === 0)
          return { percentage: 0, isPositive: false };

        const diff = ((current - previous) / previous) * 100;
        return {
          percentage: Math.abs(Number(diff.toFixed(2))),
          isPositive: diff >= 0,
        };
      };

      const stats = {
        totalUsers: {
          value: totalUsers,
          change: percentChange(currentMonthUsers, lastMonthUsers),
        },
        totalOrders: {
          value: totalOrders,
          change: percentChange(currentMonthOrders, lastMonthOrders),
        },
        totalRevenue: {
          value: totalRevenue,
          change: percentChange(currentMonthRevenue, lastMonthRevenue),
        },
        activeSubscriptions: {
          value: activeSubscriptions,
          change: percentChange(
            currentMonthActiveSubscriptions,
            lastMonthActiveSubscriptions
          ),
        },
        membershipPurchases: {
          value: membershipPurchases,
          change: percentChange(
            currentMonthMembershipPurchases,
            lastMonthMembershipPurchases
          ),
        },
      };

      res.apiSuccess({ stats }, "Dashboard stats retrieved successfully");
    }
  );

  /**
   * -------------------------------------------
   *  REVENUE OVERVIEW (DAILY / WEEKLY / MONTHLY)
   * -------------------------------------------
   */
  getRevenueOverview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        period = "monthly",
        startDate,
        endDate,
      } = req.query as {
        period?: "daily" | "weekly" | "monthly";
        startDate?: string;
        endDate?: string;
      };

      const now = new Date();

      let start: Date;
      let end: Date = new Date(now);

      // Default ranges
      if (period === "daily") {
        start = new Date();
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (period === "weekly") {
        // Show last 7 days
        start = new Date();
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // Last 12 months
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
      }

      if (startDate) start = new Date(startDate);
      if (endDate) end = new Date(endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // Group keys
      let groupId: any = {};
      let dateFormat: string;

      if (period === "daily" || period === "weekly") {
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
        dateFormat = "daily";
      } else {
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        dateFormat = "monthly";
      }

      const revenueData = await Payments.aggregate([
        {
          $match: {
            status: PaymentStatus.COMPLETED,
            isDeleted: { $ne: true },
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: groupId,
            revenue: { $sum: "$amount.amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]);

      // Prepare data map
      const map = new Map();
      revenueData.forEach((item) => {
        if (dateFormat === "daily") {
          const y = item._id.year;
          const m = String(item._id.month).padStart(2, "0");
          const d = String(item._id.day).padStart(2, "0");
          map.set(`${y}-${m}-${d}`, {
            revenue: Number(item.revenue.toFixed(2)),
            count: item.count,
          });
        } else {
          const y = item._id.year;
          const m = String(item._id.month).padStart(2, "0");
          map.set(`${y}-${m}`, {
            revenue: Number(item.revenue.toFixed(2)),
            count: item.count,
          });
        }
      });

      const chartData = [];
      const cursor = new Date(start);

      while (cursor <= end) {
        let key: string;

        if (dateFormat === "daily") {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, "0");
          const d = String(cursor.getDate()).padStart(2, "0");

          key = `${y}-${m}-${d}`;
          cursor.setDate(cursor.getDate() + 1);
        } else {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, "0");

          key = `${y}-${m}`;
          cursor.setMonth(cursor.getMonth() + 1);
        }

        chartData.push({
          date: key,
          revenue: map.get(key)?.revenue || 0,
          count: map.get(key)?.count || 0,
        });
      }

      res.apiSuccess(
        {
          period,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          data: chartData,
        },
        "Revenue overview retrieved successfully"
      );
    }
  );

  /**
   * -------------------------------------------
   *  TOP SELLING PLANS
   * -------------------------------------------
   */
  getTopSellingPlans = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { date } = req.query as { date?: string };

      let start = new Date();
      let end = new Date();

      if (date) {
        start = new Date(date);
        end = new Date(date);
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const [subscriptionsData, oneTimeOrders] = await Promise.all([
        Subscriptions.aggregate([
          {
            $match: {
              isDeleted: { $ne: true },
              createdAt: { $gte: start, $lte: end },
            },
          },
          { $group: { _id: "$cycleDays", count: { $sum: 1 } } },
        ]),
        Orders.countDocuments({
          isDeleted: { $ne: true },
          planType: OrderPlanType.ONE_TIME,
          paymentStatus: PaymentStatus.COMPLETED,
          createdAt: { $gte: start, $lte: end },
        }),
      ]);

      let total90 = 0;
      let total60 = 0;
      let totalOneTime = oneTimeOrders;

      subscriptionsData.forEach((item) => {
        if (item._id === SubscriptionCycle.DAYS_90) total90 = item.count;
        if (item._id === SubscriptionCycle.DAYS_60) total60 = item.count;
      });

      const total = total90 + total60 + totalOneTime;

      const pct = (value: number) =>
        total === 0 ? 0 : Number(((value / total) * 100).toFixed(2));

      const plans = [
        { name: "90 days plan", count: total90, percentage: pct(total90) },
        { name: "60 days plan", count: total60, percentage: pct(total60) },
        {
          name: "One-time purchases",
          count: totalOneTime,
          percentage: pct(totalOneTime),
        },
      ];

      res.apiSuccess(
        {
          date: start.toISOString().split("T")[0],
          total,
          plans,
        },
        "Top selling plans retrieved successfully"
      );
    }
  );

  /**
   * -------------------------------------------
   *  TOP SELLING PRODUCTS
   * -------------------------------------------
   */
  getTopSellingProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string) : 10;

      const productSales = await Orders.aggregate([
        {
          $match: {
            isDeleted: { $ne: true },
            paymentStatus: PaymentStatus.COMPLETED,
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.name" },
            totalSales: { $sum: "$items.quantity" },
            totalRevenue: {
              $sum: {
                $multiply: ["$items.quantity", "$items.price.amount"],
              },
            },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limitNum },
      ]);

      const productIds = productSales.map((i) => i._id);
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: { $ne: true },
      })
        .select("title slug categories price productImage")
        .lean();

      const variants = await ProductVariants.find({
        productId: { $in: productIds },
        isDeleted: { $ne: true },
        isActive: true,
      })
        .select("productId inventory")
        .lean();

      const variantMap = new Map();
      variants.forEach((v) => {
        const id = v.productId.toString();
        if (!variantMap.has(id)) variantMap.set(id, []);
        variantMap.get(id).push(v);
      });

      const stockStatus = (productId: string) => {
        const v = variantMap.get(productId) || [];
        let total = 0;

        v.forEach((item: any) => {
          const available =
            (item.inventory?.quantity || 0) - (item.inventory?.reserved || 0);
          total += available;
        });

        if (total === 0) return "outOfStock";
        if (total <= 10) return "lowStock";
        return "inStock";
      };

      const finalData = productSales.map((item) => {
        const product = products.find(
          (p) => p._id.toString() === item._id.toString()
        );

        return {
          productId: item._id,
          productName: product?.title || item.productName,
          productImage: product?.productImage || null,
          category: product?.categories?.[0] || "Uncategorized",
          price: product?.price?.amount || 0,
          currency: product?.price?.currency || "EUR",
          totalSales: item.totalSales,
          revenue: Number(item.totalRevenue.toFixed(2)),
          status: stockStatus(item._id.toString()),
        };
      });

      res.apiSuccess(
        { products: finalData },
        "Top selling products retrieved successfully"
      );
    }
  );
}

export const adminDashboardController = new AdminDashboardController();
