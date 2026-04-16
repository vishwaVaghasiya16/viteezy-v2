/**
 * @fileoverview Family Linking Schemas
 * @description Joi validation schemas for family linking endpoints
 * @module validation/familyLinkingValidation
 */

import Joi from "joi";

/**
 * Schema for linking family member by member ID
 */
export const linkByMemberIdSchema = Joi.object({
  memberId: Joi.string()
    .pattern(/^MEM-[A-Z0-9]{8}$/)
    .required()
    .messages({
      "string.empty": "Member ID is required",
      "string.pattern.base": "Invalid member ID format. Format: MEM-XXXXXXXX",
      "any.required": "Member ID is required",
    })
    .label("Member ID"),
  relationshipToParent: Joi.string()
    .trim()
    .max(50)
    .optional()
    .valid("Child", "Spouse", "Parent", "Sibling", "Other", "")
    .messages({
      "string.max": "Relationship cannot exceed 50 characters",
      "any.only": "Relationship must be one of: Child, Spouse, Parent, Sibling, Other",
    })
    .label("Relationship to Parent"),
});

/**
 * Schema for linking family members by IDs
 */
export const linkFamilyMembersSchema = Joi.object({
  mainMemberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Main member ID is required",
      "string.pattern.base": "Invalid main member ID format",
      "any.required": "Main member ID is required",
    })
    .label("Main Member ID"),
  subMemberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Sub-member ID is required",
      "string.pattern.base": "Invalid sub-member ID format",
      "any.required": "Sub-member ID is required",
    })
    .label("Sub-Member ID"),
  relationshipToParent: Joi.string()
    .trim()
    .max(50)
    .optional()
    .valid("Child", "Spouse", "Parent", "Sibling", "Other", "")
    .messages({
      "string.max": "Relationship cannot exceed 50 characters",
      "any.only": "Relationship must be one of: Child, Spouse, Parent, Sibling, Other",
    })
    .label("Relationship to Parent"),
});

/**
 * Schema for unlinking family members
 */
export const unlinkFamilyMembersSchema = Joi.object({
  mainMemberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Main member ID is required",
      "string.pattern.base": "Invalid main member ID format",
      "any.required": "Main member ID is required",
    })
    .label("Main Member ID"),
  subMemberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Sub-member ID is required",
      "string.pattern.base": "Invalid sub-member ID format",
      "any.required": "Sub-member ID is required",
    })
    .label("Sub-Member ID"),
});

/**
 * Schema for getting family members
 */
export const getFamilyMembersSchema = Joi.object({
  mainMemberId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.empty": "Main member ID is required",
      "string.pattern.base": "Invalid main member ID format",
      "any.required": "Main member ID is required",
    })
    .label("Main Member ID"),
});

/**
 * Schema for getting my sub-members
 */
export const getMySubMembersSchema = Joi.object({
  // No parameters required - uses authenticated user
});

/**
 * Schema for leaving family
 */
export const leaveFamilySchema = Joi.object({
  // No parameters required - uses authenticated user
});

/**
 * Schema for removing sub-member
 */
export const removeSubMemberSchema = Joi.object({
  subMemberId: Joi.string()
    .required()
    .pattern(/^[0-9a-fA-F]{24}$/) // MongoDB ObjectId pattern
    .messages({
      "string.base": "Sub-member ID must be a valid string",
      "string.pattern.base": "Sub-member ID must be a valid MongoDB ObjectId",
      "any.required": "Sub-member ID is required",
    }),
});
