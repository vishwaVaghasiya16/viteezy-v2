import { Router } from "express";
import { CheckoutController } from "../controllers/checkoutController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

/**
 * All checkout routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   GET /api/v1/checkout/products
 * @desc    Get checkout products with all pricing details
 * @access  Private
 */
router.get("/products", CheckoutController.getCheckoutProducts);

/**
 * @route   GET /api/v1/checkout/featured-products
 * @desc    Get featured products excluding cart items (3-5 products)
 * @access  Private
 */
router.get("/featured-products", CheckoutController.getFeaturedProducts);

/**
 * @route   GET /api/checkout/summary
 * @desc    Get checkout summary with membership discount calculation
 * @access  Private
 */
router.get("/summary", CheckoutController.getCheckoutSummary);

/**
 * @route   GET /api/checkout/purchase-plans
 * @desc    Get purchase plans for products in cart with calculated totals
 * @access  Private
 * @query   selectedPlans (optional) - JSON string of selected plans per product
 */
router.get("/purchase-plans", CheckoutController.getPurchasePlans);

export default router;
