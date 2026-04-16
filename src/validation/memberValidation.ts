import Joi from "joi";
import mongoose from "mongoose";

/**
 * Member Registration Schema
 */
export const registerWithMemberIdSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(50)
    .required()
    .messages({
      "string.empty": "First name is required",
      "string.min": "First name must be at least 1 character long",
      "string.max": "First name cannot exceed 50 characters",
    })
    .label("First Name"),
  lastName: Joi.string()
    .trim()
    .max(50)
    .allow("")
    .optional()
    .label("Last Name"),
  parentMemberId: Joi.string()
    .pattern(/^MEM-[A-Z0-9]{8}$/)
    .uppercase()
    .optional()
    .messages({
      "string.pattern.base": "Invalid member ID format. Format: MEM-XXXXXXXX",
    })
    .label("Parent Member ID"),
  email: Joi.alternatives()
    .conditional("parentMemberId", {
      is: Joi.exist(),
      then: Joi.string().email().lowercase().trim().optional(),
      otherwise: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
          "string.empty": "Email is required",
          "string.email": "Please enter a valid email address",
        }),
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
