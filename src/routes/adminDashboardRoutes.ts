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
 * @desc Get top selling plans chart data (90 days, 60 days, one-time purchases)
 * @access Admin
 * @query {String} [date] - Single date filter (ISO 8601 format, default: today)
 */
router.get(
  "/top-selling-plans",
  validateQuery(topSellingPlansQuerySchema),
  adminDashboardController.getTopSellingPlans
);

/**
 * @route GET /api/v1/admin/dashboard/top-selling-products
 * @desc Get top selling products list with sales and revenue data
 * @access Admin
 * @query {Number} [limit] - Number of products to return (default: 10)
 */
router.get(
  "/top-selling-products",
  validateQuery(topSellingProductsQuerySchema),
  adminDashboardController.getTopSellingProducts
);

export default router;
