import { Router } from "express";
import { authMiddleware, authorize } from "@/middleware/auth";
import { validateQuery } from "@/middleware/joiValidation";
import { adminDashboardController } from "@/controllers/adminDashboardController";
import {
  revenueOverviewQuerySchema,
  topSellingPlansQuerySchema,
  topSellingProductsQuerySchema,
} from "@/validation/adminDashboardValidation";

const router = Router();

router.use(authMiddleware);
router.use(authorize("Admin"));

/**
 * @route GET /api/v1/admin/dashboard/stats
 * @desc Get dashboard stats summary (Total Users, Orders, Revenue, Active Subscriptions, Membership Purchases)
 * @access Admin
 * @returns {Object} stats - Object containing all dashboard metrics with percentage changes
 */
router.get("/stats", adminDashboardController.getDashboardStats);

/**
 * @route GET /api/v1/admin/dashboard/revenue-overview
 * @desc Get revenue overview chart data
 * @access Admin
 * @query {String} [period] - "daily", "weekly", or "monthly" (default: "monthly")
 * @query {String} [startDate] - Start date (ISO 8601 format)
 * @query {String} [endDate] - End date (ISO 8601 format)
 */
router.get(
  "/revenue-overview",
  validateQuery(revenueOverviewQuerySchema),
  adminDashboardController.getRevenueOverview
);

/**
 * @route GET /api/v1/admin/dashboard/top-selling-plans
 * @desc Get top selling plans data with counts, revenue, and percentages
 * @access Admin
 * @query {String} [date] - Single date filter (ISO 8601 format)
 * @query {String} [month] - Month filter (YYYY-MM format, e.g., "2025-01")
 * @query {String} [startDate] - Start date for date range (ISO 8601 format)
 * @query {String} [endDate] - End date for date range (ISO 8601 format, required if startDate provided)
 * @note Filter priority: startDate/endDate > month > date > default (current month)
 * @returns {Object} Response with period, summary (totalCount, totalRevenue), and plans array
 * @example
 * GET /api/v1/admin/dashboard/top-selling-plans?month=2025-01
 * GET /api/v1/admin/dashboard/top-selling-plans?startDate=2025-01-01&endDate=2025-01-31
 */
router.get(
  "/top-selling-plans",
  validateQuery(topSellingPlansQuerySchema),
  adminDashboardController.getTopSellingPlans
);

/**
 * @route GET /api/v1/admin/dashboard/top-selling-products
 * @desc Get top selling products with sales, revenue, and order metrics
 * @access Admin
 * @query {Number} [limit] - Number of products to return (default: 10, max: 100)
 * @query {String} [date] - Single date filter (ISO 8601 format)
 * @query {String} [month] - Month filter (YYYY-MM format, e.g., "2025-01")
 * @query {String} [startDate] - Start date for date range (ISO 8601 format)
 * @query {String} [endDate] - End date for date range (ISO 8601 format, required if startDate provided)
 * @note Filter priority: startDate/endDate > month > date > default (all time)
 * @note Revenue is calculated from actual payment amounts, distributed proportionally per order
 * @returns {Object} Response with period, summary (totalProducts, totalRevenue, totalOrders), and products array
 * @example
 * GET /api/v1/admin/dashboard/top-selling-products?limit=20&month=2025-01
 * GET /api/v1/admin/dashboard/top-selling-products?startDate=2025-01-01&endDate=2025-01-31&limit=15
 */
router.get(
  "/top-selling-products",
  validateQuery(topSellingProductsQuerySchema),
  adminDashboardController.getTopSellingProducts
);

export default router;
