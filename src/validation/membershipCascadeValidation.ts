/**
 * @fileoverview Membership Cascade Validation
 * @description Joi validation schemas for membership cascade operations
 * @module validation/membershipCascadeValidation
 */

import Joi from "joi";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for applying membership with cascade
 */
export const applyMembershipSchema = Joi.object({
  membershipId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "Membership ID must be a valid string",
      "string.pattern.base": "Membership ID must be a valid MongoDB ObjectId",
      "any.required": "Membership ID is required",
    }),
  planId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "Plan ID must be a valid string",
      "string.pattern.base": "Plan ID must be a valid MongoDB ObjectId",
      "any.required": "Plan ID is required",
    }),
});

/**
 * Schema for getting effective membership (no parameters required)
 */
export const getEffectiveMembershipSchema = Joi.object({
  // No parameters required - uses authenticated user
});

/**
 * Schema for recalculating membership benefits
 */
export const recalculateMembershipSchema = Joi.object({
  reason: Joi.string()
    .required()
    .min(3)
    .max(500)
    .messages({
      "string.base": "Reason must be a valid string",
      "string.empty": "Reason cannot be empty",
      "string.min": "Reason must be at least 3 characters long",
      "string.max": "Reason cannot exceed 500 characters",
      "any.required": "Reason is required",
    }),
});

/**
 * Schema for handling membership expiry
 */
export const handleMembershipExpirySchema = Joi.object({
  membershipId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "Membership ID must be a valid string",
      "string.pattern.base": "Membership ID must be a valid MongoDB ObjectId",
      "any.required": "Membership ID is required",
    }),
});

/**
 * Schema for removing inherited benefits (no parameters required)
 */
export const removeInheritedBenefitsSchema = Joi.object({
  // No parameters required - uses authenticated user
});
