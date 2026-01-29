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
  ProductCategory,
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

      // Helper function to get start of week (Monday)
      const getStartOfWeek = (date: Date): Date => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      };

      // Helper function to format week key
      const getWeekKey = (date: Date): string => {
        const weekStart = getStartOfWeek(date);
        const y = weekStart.getFullYear();
        const m = String(weekStart.getMonth() + 1).padStart(2, "0");
        const d = String(weekStart.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      };

      // Group keys
      let groupId: any = {};
      let dateFormat: string;
      let pipeline: any[] = [
        {
          $match: {
            status: PaymentStatus.COMPLETED,
            isDeleted: { $ne: true },
            createdAt: { $gte: start, $lte: end },
          },
        },
      ];

      if (period === "daily") {
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
        dateFormat = "daily";
      } else if (period === "weekly") {
        // Calculate week start (Monday) for each payment
        // $dayOfWeek returns 1=Sunday, 2=Monday, ..., 7=Saturday
        // We want Monday (2) to be the start of the week
        // Calculate milliseconds to subtract to get to Monday
        pipeline.push({
          $addFields: {
            dayOfWeek: { $dayOfWeek: "$createdAt" },
            daysToSubtract: {
              $cond: {
                if: { $eq: [{ $dayOfWeek: "$createdAt" }, 1] }, // If Sunday, go back 6 days
                then: 6,
                else: {
                  $subtract: [{ $dayOfWeek: "$createdAt" }, 2], // Otherwise subtract to get to Monday
                },
              },
            },
          },
        });
        pipeline.push({
          $addFields: {
            weekStartDate: {
              $subtract: [
                "$createdAt",
                {
                  $multiply: [
                    "$daysToSubtract",
                    24 * 60 * 60 * 1000, // Convert days to milliseconds
                  ],
                },
              ],
            },
          },
        });
        groupId = {
          year: { $year: "$weekStartDate" },
          month: { $month: "$weekStartDate" },
          day: { $dayOfMonth: "$weekStartDate" },
        };
        dateFormat = "weekly";
      } else {
        groupId = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        };
        dateFormat = "monthly";
      }

      pipeline.push({
        $group: {
          _id: groupId,
          revenue: { $sum: "$amount.amount" },
          count: { $sum: 1 },
        },
      });

      pipeline.push({
        $sort:
          period === "weekly"
            ? { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            : period === "daily"
            ? { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            : { "_id.year": 1, "_id.month": 1 },
      });

      const revenueData = await Payments.aggregate(pipeline);

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
        } else if (dateFormat === "weekly") {
          const y = item._id.year;
          const m = String(item._id.month).padStart(2, "0");
          const d = String(item._id.day).padStart(2, "0");
          const key = `${y}-${m}-${d}`;
          map.set(key, {
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

      // Month names for display
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const chartData = [];
      
      if (dateFormat === "weekly") {
        // Generate all weeks in the date range
        const weekStart = getStartOfWeek(start);
        const weekEnd = getStartOfWeek(end);
        const cursor = new Date(weekStart);

        while (cursor <= weekEnd) {
          const weekKey = getWeekKey(cursor);
          const weekEndDate = new Date(cursor);
          weekEndDate.setDate(cursor.getDate() + 6); // Sunday of the week

          // Format label: "Feb 12 - Feb 18" or "Feb 12 - Mar 1" if cross-month
          const startMonth = monthNames[cursor.getMonth()];
          const startDay = cursor.getDate();
          const endMonth = monthNames[weekEndDate.getMonth()];
          const endDay = weekEndDate.getDate();

          let label: string;
          if (cursor.getMonth() === weekEndDate.getMonth()) {
            label = `${startMonth} ${startDay} - ${endDay}`;
          } else {
            label = `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
          }

          chartData.push({
            date: weekKey,
            label: label,
            revenue: map.get(weekKey)?.revenue || 0,
            count: map.get(weekKey)?.count || 0,
          });

          // Move to next week (Monday)
          cursor.setDate(cursor.getDate() + 7);
        }
      } else {
        const cursor = new Date(start);

        while (cursor <= end) {
          let key: string;
          let label: string;

          if (dateFormat === "daily") {
            const y = cursor.getFullYear();
            const m = String(cursor.getMonth() + 1).padStart(2, "0");
            const d = String(cursor.getDate()).padStart(2, "0");

            key = `${y}-${m}-${d}`;
            label = `${monthNames[cursor.getMonth()]} ${d}`;
            cursor.setDate(cursor.getDate() + 1);
          } else {
            const y = cursor.getFullYear();
            const m = String(cursor.getMonth() + 1).padStart(2, "0");

            key = `${y}-${m}`;
            label = monthNames[cursor.getMonth()];
            cursor.setMonth(cursor.getMonth() + 1);
          }

          chartData.push({
            date: key,
            label: label,
            revenue: map.get(key)?.revenue || 0,
            count: map.get(key)?.count || 0,
          });
        }
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
      const { date, month, startDate, endDate } = req.query as {
        date?: string;
        month?: string;
        startDate?: string;
        endDate?: string;
      };

      let start: Date;
      let end: Date;

      // Priority: startDate/endDate > month > date > default (current month)
      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (month) {
        // Parse month string (e.g., "2025-01")
        const [year, monthNum] = month.split("-").map(Number);
        start = new Date(year, monthNum - 1, 1);
        end = new Date(year, monthNum, 0, 23, 59, 59, 999);
      } else if (date) {
        // Single date filter
        start = new Date(date);
        end = new Date(date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // Default: current month
        const now = new Date();
        start = new Date(now.getFullYear(), now.getMonth(), 1);
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

      // Get subscriptions with their orderIds and cycleDays
      const subscriptions = await Subscriptions.find({
        isDeleted: { $ne: true },
        createdAt: { $gte: start, $lte: end },
      })
        .select("_id orderId cycleDays createdAt")
        .lean();

      // Get orderIds from subscriptions to fetch payments
      const subscriptionOrderIds = subscriptions.map((sub) => sub.orderId);

      // Get one-time orders with completed payments
      const oneTimeOrders = await Orders.find({
        isDeleted: { $ne: true },
        planType: OrderPlanType.ONE_TIME,
        paymentStatus: PaymentStatus.COMPLETED,
        createdAt: { $gte: start, $lte: end },
      })
        .select("_id createdAt")
        .lean();

      const oneTimeOrderIds = oneTimeOrders.map((order) => order._id);

      // Get memberships created in date range
      const memberships = await Memberships.find({
        isDeleted: { $ne: true },
        createdAt: { $gte: start, $lte: end },
      })
        .select("_id createdAt")
        .lean();

      const membershipIds = memberships.map((mem) => mem._id);

      // Get all payments for subscriptions, one-time orders, and memberships
      const [subscriptionPayments, oneTimePayments, membershipPayments] =
        await Promise.all([
          Payments.find({
            isDeleted: { $ne: true },
            status: PaymentStatus.COMPLETED,
            orderId: { $in: subscriptionOrderIds },
            createdAt: { $gte: start, $lte: end },
          })
            .select("orderId amount")
            .lean(),
          Payments.find({
            isDeleted: { $ne: true },
            status: PaymentStatus.COMPLETED,
            orderId: { $in: oneTimeOrderIds },
            createdAt: { $gte: start, $lte: end },
          })
            .select("orderId amount")
            .lean(),
          Payments.find({
            isDeleted: { $ne: true },
            status: PaymentStatus.COMPLETED,
            membershipId: { $in: membershipIds },
            createdAt: { $gte: start, $lte: end },
          })
            .select("membershipId amount")
            .lean(),
        ]);

      // Create maps for quick lookup
      const subscriptionPaymentMap = new Map();
      subscriptionPayments.forEach((payment) => {
        const orderId = payment.orderId?.toString();
        if (orderId) {
          if (!subscriptionPaymentMap.has(orderId)) {
            subscriptionPaymentMap.set(orderId, []);
          }
          subscriptionPaymentMap.get(orderId).push(payment);
        }
      });

      const oneTimePaymentMap = new Map();
      oneTimePayments.forEach((payment) => {
        const orderId = payment.orderId?.toString();
        if (orderId) {
          if (!oneTimePaymentMap.has(orderId)) {
            oneTimePaymentMap.set(orderId, []);
          }
          oneTimePaymentMap.get(orderId).push(payment);
        }
      });

      const membershipPaymentMap = new Map();
      membershipPayments.forEach((payment) => {
        const membershipId = payment.membershipId?.toString();
        if (membershipId) {
          if (!membershipPaymentMap.has(membershipId)) {
            membershipPaymentMap.set(membershipId, []);
          }
          membershipPaymentMap.get(membershipId).push(payment);
        }
      });

      // Group subscriptions by cycleDays and calculate revenue
      const subscriptionData = new Map<
        number,
        { count: number; revenue: number }
      >();
      subscriptions.forEach((sub) => {
        const cycleDays = sub.cycleDays;
        const orderId = sub.orderId?.toString();
        const payments = orderId
          ? subscriptionPaymentMap.get(orderId) || []
          : [];

        if (!subscriptionData.has(cycleDays)) {
          subscriptionData.set(cycleDays, { count: 0, revenue: 0 });
        }

        const data = subscriptionData.get(cycleDays)!;
        data.count += 1;

        // Sum revenue from all payments for this subscription's order
        payments.forEach((payment: any) => {
          if (payment.amount?.amount) {
            data.revenue += payment.amount.amount;
          }
        });
      });

      // Calculate one-time purchases revenue
      let oneTimeCount = oneTimeOrders.length;
      let oneTimeRevenue = 0;
      oneTimeOrders.forEach((order) => {
        const orderId = order._id.toString();
        const payments = oneTimePaymentMap.get(orderId) || [];
        payments.forEach((payment: any) => {
          if (payment.amount?.amount) {
            oneTimeRevenue += payment.amount.amount;
          }
        });
      });

      // Calculate membership revenue
      let membershipCount = memberships.length;
      let membershipRevenue = 0;
      memberships.forEach((membership) => {
        const membershipId = membership._id.toString();
        const payments = membershipPaymentMap.get(membershipId) || [];
        payments.forEach((payment: any) => {
          if (payment.amount?.amount) {
            membershipRevenue += payment.amount.amount;
          }
        });
      });

      // Build plans array with all subscription cycles
      const plans: Array<{
        name: string;
        cycleDays?: number;
        count: number;
        revenue: number;
        percentage: number;
      }> = [];

      // Add subscription plans (30, 60, 90, 180 days)
      const cycleOrder = [
        SubscriptionCycle.DAYS_30,
        SubscriptionCycle.DAYS_60,
        SubscriptionCycle.DAYS_90,
        SubscriptionCycle.DAYS_180,
      ];
      cycleOrder.forEach((cycleDays) => {
        const data = subscriptionData.get(cycleDays) || {
          count: 0,
          revenue: 0,
        };
        if (data.count > 0) {
          plans.push({
            name: `${cycleDays} days plan`,
            cycleDays,
            count: data.count,
            revenue: Number(data.revenue.toFixed(2)),
            percentage: 0, // Will calculate after total
          });
        }
      });

      // Add one-time purchases
      if (oneTimeCount > 0) {
        plans.push({
          name: "One-time purchases",
          count: oneTimeCount,
          revenue: Number(oneTimeRevenue.toFixed(2)),
          percentage: 0, // Will calculate after total
        });
      }

      // Add memberships
      if (membershipCount > 0) {
        plans.push({
          name: "Membership plans",
          count: membershipCount,
          revenue: Number(membershipRevenue.toFixed(2)),
          percentage: 0, // Will calculate after total
        });
      }

      // Calculate total count and revenue
      const totalCount = plans.reduce((sum, plan) => sum + plan.count, 0);
      const totalRevenue = plans.reduce((sum, plan) => sum + plan.revenue, 0);

      // Calculate percentages
      plans.forEach((plan) => {
        plan.percentage =
          totalCount === 0
            ? 0
            : Number(((plan.count / totalCount) * 100).toFixed(1));
      });

      // Sort by count (descending)
      plans.sort((a, b) => b.count - a.count);

      // Determine date label
      let dateLabel: string;
      if (month) {
        dateLabel = month;
      } else if (startDate && endDate) {
        dateLabel = `${start.toISOString().split("T")[0]} to ${
          end.toISOString().split("T")[0]
        }`;
      } else {
        dateLabel = start.toISOString().split("T")[0];
      }

      res.apiSuccess(
        {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            label: dateLabel,
          },
          summary: {
            totalCount,
            totalRevenue: Number(totalRevenue.toFixed(2)),
          },
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
      const { limit, date, month, startDate, endDate } = req.query as {
        limit?: string;
        date?: string;
        month?: string;
        startDate?: string;
        endDate?: string;
      };

      const limitNum = limit ? parseInt(limit as string) : 10;

      // Date filtering (same logic as top-selling-plans)
      let start: Date;
      let end: Date;

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (month) {
        const [year, monthNum] = month.split("-").map(Number);
        start = new Date(year, monthNum - 1, 1);
        end = new Date(year, monthNum, 0, 23, 59, 59, 999);
      } else if (date) {
        start = new Date(date);
        end = new Date(date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else {
        // Default: all time (no date filter)
        start = new Date(0); // Beginning of time
        end = new Date(); // Now
      }

      // Get orders with completed payments in date range
      const orders = await Orders.find({
        isDeleted: { $ne: true },
        paymentStatus: PaymentStatus.COMPLETED,
        createdAt: { $gte: start, $lte: end },
      })
        .select("_id items grandTotal currency createdAt")
        .lean();

      const orderIds = orders.map((order) => order._id);

      // Get payments for these orders to get actual revenue
      const payments = await Payments.find({
        isDeleted: { $ne: true },
        status: PaymentStatus.COMPLETED,
        orderId: { $in: orderIds },
        createdAt: { $gte: start, $lte: end },
      })
        .select("orderId amount")
        .lean();

      // Create payment map for quick lookup (sum all payments per order)
      const paymentMap = new Map<string, number>();
      payments.forEach((payment) => {
        const orderId = payment.orderId?.toString();
        if (orderId) {
          const currentAmount = paymentMap.get(orderId) || 0;
          const paymentAmount = payment.amount?.amount || 0;
          paymentMap.set(orderId, currentAmount + paymentAmount);
        }
      });

      // Aggregate product sales from order items
      const productSalesMap = new Map<
        string,
        {
          productName: string;
          totalSales: number; // Number of times product appeared in orders
          orderCount: number; // Number of unique orders containing this product
          revenue: number; // Revenue attributed to this product
          orderIds: Set<string>;
        }
      >();

      orders.forEach((order) => {
        const orderId = order._id.toString();
        // Use actual payment amount if available, otherwise fallback to order grandTotal
        const orderRevenue = paymentMap.get(orderId) || order.grandTotal || 0;

        if (!order.items || order.items.length === 0) return;

        // Calculate total item amount in this order for proportional distribution
        const totalItemAmount = order.items.reduce(
          (sum, item) => sum + (item.totalAmount || item.amount || 0),
          0
        );

        // Distribute revenue proportionally to each product based on item totalAmount
        order.items.forEach((item) => {
          const productId = item.productId?.toString();
          if (!productId) return;

          const itemAmount = item.totalAmount || item.amount || 0;
          // Calculate product's share of order revenue proportionally
          const productRevenue =
            totalItemAmount > 0
              ? (itemAmount / totalItemAmount) * orderRevenue
              : orderRevenue / order.items.length;

          if (!productSalesMap.has(productId)) {
            productSalesMap.set(productId, {
              productName: item.name || "",
              totalSales: 0,
              orderCount: 0,
              revenue: 0,
              orderIds: new Set(),
            });
          }

          const productData = productSalesMap.get(productId)!;
          productData.totalSales += 1; // Count number of times product appeared
          productData.revenue += productRevenue;
          productData.orderIds.add(orderId);
        });
      });

      // Update order count for each product
      productSalesMap.forEach((data) => {
        data.orderCount = data.orderIds.size;
      });

      // Update order count for each product
      productSalesMap.forEach((data) => {
        data.orderCount = data.orderIds.size;
      });

      // Convert to array and sort by revenue
      const productSales = Array.from(productSalesMap.entries())
        .map(([productId, data]) => ({
          productId,
          productName: data.productName,
          totalSales: data.totalSales,
          orderCount: data.orderCount,
          revenue: Number(data.revenue.toFixed(2)),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limitNum);

      const productIds = productSales.map(
        (item) => new mongoose.Types.ObjectId(item.productId)
      );

      // Get product details
      const [products, variants, categories] = await Promise.all([
        Products.find({
          _id: { $in: productIds },
          isDeleted: { $ne: true },
        })
          .select("title slug categories price productImage description status")
          .lean(),
        ProductVariants.find({
          productId: { $in: productIds },
          isDeleted: { $ne: true },
          isActive: true,
        })
          .select("productId inventory")
          .lean(),
        ProductCategory.find({
          isDeleted: { $ne: true },
          isActive: true,
        })
          .select("_id name")
          .lean(),
      ]);

      // Create category map for quick lookup
      const categoryMap = new Map();
      categories.forEach((cat) => {
        categoryMap.set(
          cat._id.toString(),
          cat.name?.en || cat.name?.nl || "Uncategorized"
        );
      });

      const variantMap = new Map();
      variants.forEach((v) => {
        const id = v.productId.toString();
        if (!variantMap.has(id)) variantMap.set(id, []);
        variantMap.get(id).push(v);
      });

      // Calculate total revenue for percentage calculation
      const totalRevenue = productSales.reduce(
        (sum, item) => sum + item.revenue,
        0
      );

      // Build final data with additional metrics
      const finalData = productSales.map((item) => {
        const product = products.find(
          (p) => p._id.toString() === item.productId
        );

        // Get category name from first category ID
        let categoryName = "Uncategorized";
        if (product?.categories && product.categories.length > 0) {
          const firstCategoryId = product.categories[0].toString();
          categoryName = categoryMap.get(firstCategoryId) || "Uncategorized";
        }

        // Calculate average order value
        const averageOrderValue =
          item.orderCount > 0
            ? Number((item.revenue / item.orderCount).toFixed(2))
            : 0;

        // Calculate percentage of total revenue
        const revenuePercentage =
          totalRevenue > 0
            ? Number(((item.revenue / totalRevenue) * 100).toFixed(2))
            : 0;

        return {
          productId: item.productId,
          productName: product?.title || item.productName,
          productImage: product?.productImage || null,
          slug: product?.slug || null,
          description: product?.description || null,
          status: product?.status !== undefined ? product.status : null,
          category: categoryName,
          price: product?.price?.amount || 0,
          currency: product?.price?.currency || "EUR",
          totalSales: item.totalSales, // Number of times product was ordered
          orderCount: item.orderCount, // Number of unique orders
          averageOrderValue,
          revenue: item.revenue,
          revenuePercentage,
        };
      });

      // Determine date label
      let dateLabel: string;
      if (month) {
        dateLabel = month;
      } else if (startDate && endDate) {
        dateLabel = `${start.toISOString().split("T")[0]} to ${
          end.toISOString().split("T")[0]
        }`;
      } else if (date) {
        dateLabel = start.toISOString().split("T")[0];
      } else {
        dateLabel = "All time";
      }

      res.apiSuccess(
        {
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            label: dateLabel,
          },
          summary: {
            totalProducts: finalData.length,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            totalOrders: finalData.reduce(
              (sum, item) => sum + item.orderCount,
              0
            ),
          },
          products: finalData,
        },
        "Top selling products retrieved successfully"
      );
    }
  );
}

export const adminDashboardController = new AdminDashboardController();
