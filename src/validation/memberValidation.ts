import Joi from "joi";
import mongoose from "mongoose";

/**
 * Member Registration Schema
 */
export const registerWithMemberIdSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name cannot exceed 50 characters",
    })
    .label("Name"),
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please enter a valid email address",
    })
    .label("Email"),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 6 characters long",
    })
    .label("Password"),
  phone: Joi.string()
    .pattern(/^[+]?[1-9]\d{1,14}$/)
    .optional()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
    })
    .label("Phone"),
  parentMemberId: Joi.string()
    .pattern(/^MEM-[A-Z0-9]{8}$/)
    .uppercase()
    .optional()
    .messages({
      "string.pattern.base": "Invalid member ID format. Format: MEM-XXXXXXXX",
    })
    .label("Parent Member ID"),
  registrationSource: Joi.string()
    .valid("registration", "quiz")
    .default("registration")
    .optional()
    .label("Registration Source"),
  metadata: Joi.object().optional().label("Metadata"),
});

/**
 * Member ID Verification Schema (for params)
 */
export const verifyMemberIdParamsSchema = Joi.object({
  memberId: Joi.string()
    .pattern(/^MEM-[A-Z0-9]{8}$/)
    .uppercase()
    .required()
    .messages({
      "string.pattern.base": "Invalid member ID format. Format: MEM-XXXXXXXX",
    })
    .label("Member ID"),
});

const objectIdParamSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  })
  .messages({
    "any.invalid": "Invalid member ID format",
  });

export const childMemberParamsSchema = Joi.object({
  childUserId: objectIdParamSchema.required().label("Child User ID"),
});
