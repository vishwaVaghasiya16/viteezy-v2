import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi, validateQuery, validateParams } from "@/middleware/joiValidation";
import {
  buyMembershipSchema,
  getMembershipPlansSchema,
  getMembershipDetailsParamsSchema,
  getMembershipsQuerySchema,
  cancelMembershipSchema,
  getMembershipTransactionsQuerySchema,
} from "@/validation/membershipValidation";
import { membershipController } from "@/controllers/membershipController";

const router = Router();

/**
 * Public Routes (No Authentication Required)
 */

/**
 * @route   GET /api/memberships/plans
 * @desc    Get all active membership plans
 * @access  Public
 * @query   {String} [interval] - Filter by billing interval (Monthly, Quarterly, Yearly)
 * @query   {String} [lang] - Language for content (en, nl, de, fr, es)
 */
router.get(
  "/plans",
  validateQuery(getMembershipPlansSchema),
  membershipController.getMembershipPlans
);

/**
 * Protected Routes (Authentication Required)
 */
router.use(authenticate);

/**
 * @route   GET /api/memberships
 * @desc    Get user's memberships (Paginated)
 * @access  Private
 * @query   status, page, limit
 */
router.get(
  "/",
  validateQuery(getMembershipsQuerySchema),
  membershipController.getUserMemberships
);

/**
 * @route   GET /api/memberships/widget/overview
 * @desc    Widget data for user dashboard membership section
 * @access  Private
 */
router.get("/widget/overview", membershipController.getMembershipWidget);

/**
 * @route   GET /api/memberships/:membershipId
 * @desc    Get membership details by ID
 * @access  Private
 * @params  membershipId
 */
router.get(
  "/:membershipId",
  validateParams(getMembershipDetailsParamsSchema),
  membershipController.getMembershipDetails
);

/**
 * @route   POST /api/memberships/buy
 * @desc    Buy membership plan
 * @access  Private
 */
router.post(
  "/buy",
  validateJoi(buyMembershipSchema),
  membershipController.buyMembership
);

/**
 * @route   POST /api/memberships/:membershipId/cancel
 * @desc    Cancel membership
 * @access  Private
 * @params  membershipId
 */
router.post(
  "/:membershipId/cancel",
  validateParams(getMembershipDetailsParamsSchema),
  validateJoi(cancelMembershipSchema),
  membershipController.cancelMembership
);

/**
 * @route   GET /api/memberships/:membershipId/transactions
 * @desc    Get membership transaction history
 * @access  Private
 * @params  membershipId
 * @query   page, limit, status, paymentMethod, sortBy, sortOrder, search
 */
router.get(
  "/:membershipId/transactions",
  validateParams(getMembershipDetailsParamsSchema),
  validateQuery(getMembershipTransactionsQuerySchema),
  membershipController.getMembershipTransactions
);

router.get("/benefits", membershipController.getMembershipBenefits);
router.get("/effective", membershipController.getEffectiveMembership);

export default router;
