import { Router } from "express";
import { dashboardController } from "@/controllers/dashboardController";
import { authMiddleware } from "@/middleware/auth";

const router = Router();

router.use(authMiddleware);

/**
 * @route   GET /api/v1/dashboard/stats
 * @desc    Get dashboard summary stats
 * @access  Private
 */
router.get("/stats", dashboardController.getStats);

/**
 * @route   GET /api/v1/dashboard/order-overview
 * @desc    Get latest order overview widget data
 * @access  Private
 */
router.get("/order-overview", dashboardController.getOrderOverview);

export default router;

