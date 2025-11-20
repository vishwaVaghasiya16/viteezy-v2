/**
 * @fileoverview Authentication Validation Schemas
 * @description Joi validation schemas for authentication-related endpoints
 * @module validation/authValidation
 */

import Joi from "joi";
import {
  OTPType,
  OTP_TYPE_VALUES,
  Gender,
  GENDER_VALUES,
} from "@/models/enums";
import { VALIDATION } from "@/constants";

/**
 * Email validation schema
 * @constant {Joi.StringSchema} emailSchema
 */
const emailSchema = Joi.string().email().required().messages({
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

/**
 * Password validation schema
 * @constant {Joi.StringSchema} passwordSchema
 */
const passwordSchema = Joi.string()
  .min(VALIDATION.PASSWORD.MIN_LENGTH)
  .max(VALIDATION.PASSWORD.MAX_LENGTH)
  .required()
  .messages({
    "string.min": `Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
    "string.max": `Password cannot exceed ${VALIDATION.PASSWORD.MAX_LENGTH} characters`,
    "any.required": "Password is required",
  });

/**
 * Current password validation schema
 * @constant {Joi.StringSchema} currentPasswordSchema
 */
const currentPasswordSchema = Joi.string()
  .min(VALIDATION.PASSWORD.MIN_LENGTH)
  .max(VALIDATION.PASSWORD.MAX_LENGTH)
  .required()
  .messages({
    "string.min": `Current Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
    "string.max": `Current Password cannot exceed ${VALIDATION.PASSWORD.MAX_LENGTH} characters`,
    "any.required": "Current Password is required",
  });

/**
 * New password validation schema
 * @constant {Joi.StringSchema} newPasswordSchema
 */
const newPasswordSchema = Joi.string()
  .min(VALIDATION.PASSWORD.MIN_LENGTH)
  .max(VALIDATION.PASSWORD.MAX_LENGTH)
  .required()
  .messages({
    "string.min": `New Password must be at least ${VALIDATION.PASSWORD.MIN_LENGTH} characters long`,
    "string.max": `New Password cannot exceed ${VALIDATION.PASSWORD.MAX_LENGTH} characters`,
    "any.required": "New Password is required",
  });

/**
 * Name validation schema
 * @constant {Joi.StringSchema} nameSchema
 */
const nameSchema = Joi.string()
  .min(VALIDATION.NAME.MIN_LENGTH)
  .max(VALIDATION.NAME.MAX_LENGTH)
  .required()
  .messages({
    "string.min": `Name must be at least ${VALIDATION.NAME.MIN_LENGTH} characters long`,
    "string.max": `Name cannot exceed ${VALIDATION.NAME.MAX_LENGTH} characters`,
    "any.required": "Name is required",
  });

/**
 * Device info validation schema
 * @constant {Joi.StringSchema} deviceInfoSchema
 */
const deviceInfoSchema = Joi.string().required().messages({
  "any.required": "Device Info is required",
});

/**
 * Phone number validation schema
 * @constant {Joi.StringSchema} phoneSchema
 * @description Validates international phone number format (E.164)
 */
const phoneSchema = Joi.string()
  .pattern(/^[+]?[1-9]\d{1,14}$/)
  .optional()
  .messages({
    "string.pattern.base": "Please provide a valid phone number (E.164 format)",
  });

/**
 * OTP validation schema
 * @constant {Joi.StringSchema} otpSchema
 * @description Validates 6-digit OTP code
 */
const otpSchema = Joi.string()
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.pattern.base": "OTP must be a 6-digit number",
    "any.required": "OTP is required",
  });

/**
 * OTP type validation schema
 * @constant {Joi.StringSchema} otpTypeSchema
 * @description Validates OTP type against enum values
 */
const otpTypeSchema = Joi.string()
  .valid(...OTP_TYPE_VALUES)
  .required()
  .messages({
    "any.only": `OTP type must be one of: ${OTP_TYPE_VALUES.join(", ")}`,
    "any.required": "OTP type is required",
  });

/**
 * User Registration Validation Schema
 * @constant {Joi.ObjectSchema} registerSchema
 * @description Validates user registration request data
 */
export const registerSchema = Joi.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

/**
 * User Login Validation Schema
 * @constant {Joi.ObjectSchema} loginSchema
 * @description Validates user login request data
 */
export const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  deviceInfo: deviceInfoSchema,
});

/**
 * Send OTP Validation Schema
 * @constant {Joi.ObjectSchema} sendOTPSchema
 * @description Validates send OTP request data
 */
export const sendOTPSchema = Joi.object({
  email: emailSchema,
  type: otpTypeSchema,
});

/**
 * Verify OTP Validation Schema
 * @constant {Joi.ObjectSchema} verifyOTPSchema
 * @description Validates verify OTP request data
 */
export const verifyOTPSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
  type: otpTypeSchema,
});

/**
 * Resend OTP Validation Schema
 * @constant {Joi.ObjectSchema} resendOTPSchema
 * @description Validates resend OTP request data
 */
export const resendOTPSchema = Joi.object({
  email: emailSchema,
  type: otpTypeSchema,
});

/**
 * Forgot Password Validation Schema
 * @constant {Joi.ObjectSchema} forgotPasswordSchema
 * @description Validates forgot password request data
 */
export const forgotPasswordSchema = Joi.object({
  email: emailSchema,
});

/**
 * Reset Password Validation Schema
 * @constant {Joi.ObjectSchema} resetPasswordSchema
 * @description Validates reset password request data
 */
export const resetPasswordSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

/**
 * Change Password Validation Schema
 * @constant {Joi.ObjectSchema} changePasswordSchema
 * @description Validates change password request data
 */
export const changePasswordSchema = Joi.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});

/**
 * Update Profile Validation Schema
 * @constant {Joi.ObjectSchema} updateProfileSchema
 * @description Validates update profile request data
 */
export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  profileImage: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "Profile image must be a valid URL",
  }),
  gender: Joi.string()
    .valid(...GENDER_VALUES)
    .optional()
    .allow(null)
    .messages({
      "any.only": `Gender must be one of: ${GENDER_VALUES.join(", ")}`,
    }),
  age: Joi.number().integer().min(1).max(150).optional().allow(null).messages({
    "number.min": "Age must be at least 1",
    "number.max": "Age cannot exceed 150",
    "number.integer": "Age must be an integer",
  }),
});

/**
 * Refresh Token Validation Schema
 * @constant {Joi.ObjectSchema} refreshTokenSchema
 * @description Validates refresh token request data
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});
