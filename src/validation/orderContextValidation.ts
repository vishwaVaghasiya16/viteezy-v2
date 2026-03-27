/**
 * @fileoverview Order Context Validation
 * @description Joi validation schemas for order permission and context operations
 * @module validation/orderContextValidation
 */

import Joi from "joi";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Schema for validating order permission
 */
export const validateOrderPermissionSchema = Joi.object({
  orderedFor: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "orderedFor must be a valid string",
      "string.pattern.base": "orderedFor must be a valid MongoDB ObjectId",
      "any.required": "orderedFor is required",
    }),
});

/**
 * Schema for building order context
 */
export const buildOrderContextSchema = Joi.object({
  orderedFor: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "orderedFor must be a valid string",
      "string.pattern.base": "orderedFor must be a valid MongoDB ObjectId",
      "any.required": "orderedFor is required",
    }),
});

/**
 * Schema for getting permitted targets (no parameters required)
 */
export const getPermittedTargetsSchema = Joi.object({
  // No parameters required - uses authenticated user
});

/**
 * Schema for checking if user can order for target (validated in route params)
 */
export const canOrderForUserSchema = Joi.object({
  // No body parameters - targetUserId comes from route params
});

/**
 * Schema for order creation with context (extended from existing order validation)
 */
export const createOrderWithContextSchema = Joi.object({
  // Existing order fields
  cartId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Cart ID must be a valid string",
      "string.pattern.base": "Cart ID must be a valid MongoDB ObjectId",
      "any.required": "Cart ID is required",
    }),
  
  // New order context fields
  orderedFor: Joi.string()
    .optional()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "orderedFor must be a valid string",
      "string.pattern.base": "orderedFor must be a valid MongoDB ObjectId",
    }),
  
  // Other existing order fields (optional for backward compatibility)
  sachets: Joi.object().optional(),
  standUpPouch: Joi.object().optional(),
  variantType: Joi.string().optional(),
  planDurationDays: Joi.number().optional(),
  isOneTime: Joi.boolean().optional(),
  capsuleCount: Joi.number().optional(),
  shippingAddressId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Shipping address ID must be a valid string",
      "string.pattern.base": "Shipping address ID must be a valid MongoDB ObjectId",
      "any.required": "Shipping address ID is required",
    }),
  billingAddressId: Joi.string()
    .optional()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Billing address ID must be a valid string",
      "string.pattern.base": "Billing address ID must be a valid MongoDB ObjectId",
    }),
  pricing: Joi.object().optional(),
  couponCode: Joi.string().optional(),
  membership: Joi.object().optional(),
  metadata: Joi.object().optional(),
  paymentMethod: Joi.string().required().messages({
    "any.required": "Payment method is required",
  }),
  notes: Joi.string().optional().max(500).messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
});

/**
 * Schema for family order creation (orderedFor is required)
 */
export const createFamilyOrderSchema = Joi.object({
  // Family order specific validation
  orderedFor: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "orderedFor must be a valid string",
      "string.pattern.base": "orderedFor must be a valid MongoDB ObjectId",
      "any.required": "orderedFor is required for family orders",
    }),
  
  // Other required fields
  cartId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Cart ID must be a valid string",
      "string.pattern.base": "Cart ID must be a valid MongoDB ObjectId",
      "any.required": "Cart ID is required",
    }),
  
  shippingAddressId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Shipping address ID must be a valid string",
      "string.pattern.base": "Shipping address ID must be a valid MongoDB ObjectId",
      "any.required": "Shipping address ID is required",
    }),
  
  paymentMethod: Joi.string().required().messages({
    "any.required": "Payment method is required",
  }),
  
  // Optional fields
  billingAddressId: Joi.string()
    .optional()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      "string.base": "Billing address ID must be a valid string",
      "string.pattern.base": "Billing address ID must be a valid MongoDB ObjectId",
    }),
  
  pricing: Joi.object().optional(),
  couponCode: Joi.string().optional(),
  membership: Joi.object().optional(),
  metadata: Joi.object().optional(),
  notes: Joi.string().optional().max(500).messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
});
