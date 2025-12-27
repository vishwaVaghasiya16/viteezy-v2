import { Router } from "express";
import { CheckoutController } from "../controllers/checkoutController";
import { authMiddleware } from "../middleware/auth";
import { validateJoi, validateQuery } from "../middleware/joiValidation";
import {
  checkoutPlanSelectionSchema,
  enhancedPricingSchema,
  checkoutPageSummarySchema,
  checkoutPageSummaryBodySchema,
} from "../validation/checkoutPlanSelectionValidation";

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

/**
 * @route   POST /api/v1/checkout/page-summary
 * @desc    Get comprehensive checkout page summary with products, plans, pricing, tax, discounts, and coupon verification
 * @access  Private
 * @body    planDurationDays (optional) - 30 | 60 | 90 | 180 (defaults to 180)
 * @body    variantType (optional) - SACHETS | STAND_UP_POUCH (defaults to SACHETS)
 * @body    capsuleCount (optional) - 30 | 60 (for STAND_UP_POUCH variant)
 * @body    couponCode (optional) - Coupon code to apply
 */
router.post(
  "/page-summary",
  validateJoi(checkoutPageSummaryBodySchema),
  CheckoutController.getCheckoutPageSummary
);

/**
 * @route   POST /api/v1/checkout/plan-selection
 * @desc    Calculate pricing for a selected plan on checkout page
 * @access  Private
 */
router.post(
  "/plan-selection",
  validateJoi(checkoutPlanSelectionSchema),
  CheckoutController.selectPlan
);

/**
 * @route   POST /api/v1/checkout/enhanced-pricing
 * @desc    Enhanced plan selection & pricing calculation API with all discounts
 * @access  Private
 */
router.post(
  "/enhanced-pricing",
  validateJoi(enhancedPricingSchema),
  CheckoutController.getEnhancedPricing
);

export default router;
