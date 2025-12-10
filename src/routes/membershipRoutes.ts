import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import { validateJoi, validateQuery } from "@/middleware/joiValidation";
import {
  buyMembershipSchema,
  getMembershipPlansSchema,
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
 * @route   POST /api/memberships/buy
 * @desc    Buy membership plan
 * @access  Private
 */
router.post(
  "/buy",
  validateJoi(buyMembershipSchema),
  membershipController.buyMembership
);

export default router;
