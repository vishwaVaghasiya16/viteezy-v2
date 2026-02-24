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
 * @body    sachets (required if cart has SACHETS items) - { planDurationDays: 30|60|90|180 } (isOneTime is NOT allowed for SACHETS, only subscription plans)
 * @body    standUpPouch (required if cart has STAND_UP_POUCH items) - { capsuleCount?: 30|60 (optional, fallback), itemQuantities: [{ productId: string, quantity: number, capsuleCount?: 30|60, planDays?: 30|60 }] }
 * @body    couponCode (optional) - Coupon code to apply
 * @body    shippingAddressId (optional) - Shipping address ID
 * @body    billingAddressId (optional) - Billing address ID
 * @note    STAND_UP_POUCH: Each product in itemQuantities can have its own capsuleCount/planDays. If not provided per product, falls back to top-level capsuleCount/planDays or defaults to 30.
 * @note    STAND_UP_POUCH quantity and planDays can be updated via itemQuantities array. If provided, quantities and prices are updated in cart and totals are recalculated.
 * @note    SACHETS do not support quantity (always 1). Returns separate pricing for SACHETS and STAND_UP_POUCH, plus overall combined pricing.
 * @note    If user has an active subscription with the same cycle days, a warning (sachetsWarning) will be returned indicating they must cancel existing subscription first.
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
