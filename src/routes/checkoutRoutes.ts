import { Router } from "express";
import { CheckoutController } from "../controllers/checkoutController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/**
 * All checkout routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   GET /api/checkout/summary
 * @desc    Get checkout summary with membership discount calculation
 * @access  Private
 */
router.get("/summary", CheckoutController.getCheckoutSummary);

export default router;

