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
import { withFieldLabels } from "./helpers";

/**
 * Email validation schema
 * @constant {Joi.StringSchema} emailSchema
 */
const emailSchema = Joi.string().email().required().label("Email").messages({
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
  .label("Password")
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
  .label("Current Password")
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
  .label("New Password")
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
  .label("Name")
  .messages({
    "string.min": `Name must be at least ${VALIDATION.NAME.MIN_LENGTH} characters long`,
    "string.max": `Name cannot exceed ${VALIDATION.NAME.MAX_LENGTH} characters`,
    "any.required": "Name is required",
  });

/**
 * Device info validation schema
 * @constant {Joi.StringSchema} deviceInfoSchema
 * @description Validates deviceInfo must be "Web" or "App" (case-insensitive)
 */
const deviceInfoSchema = Joi.string()
  .valid("Web", "App", "web", "app", "WEB", "APP")
  .required()
  .label("Device Info")
  .messages({
    "any.required": "Device Info is required",
    "any.only": "Device Info must be either 'Web' or 'App'",
  });

/**
 * Phone number validation schema
 * @constant {Joi.StringSchema} phoneSchema
 * @description Validates international phone number format (E.164)
 */
const phoneSchema = Joi.string()
  .pattern(/^[+]?[1-9]\d{1,14}$/)
  .optional()
  .label("Phone")
  .messages({
    "string.pattern.base": "Please provide a valid phone number (E.164 format)",
  });

/**
 * Country code validation schema
 * @constant {Joi.StringSchema} countryCodeSchema
 * @description Validates country code (e.g., "US", "NL", "IN")
 */
const countryCodeSchema = Joi.string()
  .length(2)
  .uppercase()
  .optional()
  .label("Country Code")
  .messages({
    "string.length": "Country code must be 2 characters",
    "string.uppercase": "Country code must be uppercase",
  });

/**
 * OTP validation schema
 * @constant {Joi.StringSchema} otpSchema
 * @description Validates 6-digit OTP code
 */
const otpSchema = Joi.string()
  .pattern(/^\d{6}$/)
  .required()
  .label("OTP")
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
  .label("OTP Type")
  .messages({
    "any.only": `OTP type must be one of: ${OTP_TYPE_VALUES.join(", ")}`,
    "any.required": "OTP type is required",
  });

/**
 * User Registration Validation Schema
 * @constant {Joi.ObjectSchema} registerSchema
 * @description Validates user registration request data
 */
export const registerSchema = Joi.object(
  withFieldLabels({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    phone: phoneSchema,
    countryCode: countryCodeSchema,
  })
).label("RegisterPayload");

/**
 * User Login Validation Schema
 * @constant {Joi.ObjectSchema} loginSchema
 * @description Validates user login request data
 */
export const loginSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    password: passwordSchema,
    deviceInfo: deviceInfoSchema,
  })
).label("LoginPayload");

/**
 * Send OTP Validation Schema
 * @constant {Joi.ObjectSchema} sendOTPSchema
 * @description Validates send OTP request data
 */
export const sendOTPSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    type: otpTypeSchema,
  })
).label("SendOTPPayload");

/**
 * Verify OTP Validation Schema
 * @constant {Joi.ObjectSchema} verifyOTPSchema
 * @description Validates verify OTP request data
 */
export const verifyOTPSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    otp: otpSchema,
    type: otpTypeSchema,
  })
).label("VerifyOTPPayload");

/**
 * Resend OTP Validation Schema
 * @constant {Joi.ObjectSchema} resendOTPSchema
 * @description Validates resend OTP request data
 */
export const resendOTPSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    type: otpTypeSchema,
  })
).label("ResendOTPPayload");

/**
 * Forgot Password Validation Schema
 * @constant {Joi.ObjectSchema} forgotPasswordSchema
 * @description Validates forgot password request data (supports Web and App flows)
 */
export const forgotPasswordSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    deviceInfo: deviceInfoSchema,
  })
).label("ForgotPasswordPayload");

/**
 * Reset Password Token Validation Schema
 * @constant {Joi.StringSchema} resetTokenSchema
 * @description Validates password reset token format
 */
const resetTokenSchema = Joi.string().min(32).label("Reset Token").messages({
  "string.min": "Invalid reset token format",
});

/**
 * Reset Password Validation Schema
 * @constant {Joi.ObjectSchema} resetPasswordSchema
 * @description Validates reset password request data (unified for Web and App)
 * - Web: requires token, OTP not allowed
 * - App: requires otp, token not allowed
 */
export const resetPasswordSchema = Joi.object(
  withFieldLabels({
    email: emailSchema,
    deviceInfo: deviceInfoSchema,
    token: resetTokenSchema.optional(),
    otp: otpSchema.optional(),
    newPassword: passwordSchema,
  })
)
  .custom((value, helpers) => {
    const { deviceInfo, token, otp } = value;
    const isWeb =
      deviceInfo?.toLowerCase() === "web" ||
      deviceInfo?.toLowerCase().includes("web");
    const isApp =
      deviceInfo?.toLowerCase() === "app" ||
      deviceInfo?.toLowerCase().includes("app");

    // Validate deviceInfo
    if (!isWeb && !isApp) {
      return helpers.error("any.custom", {
        message: "deviceInfo must be 'Web' or 'App'",
      });
    }

    // Web flow validation
    if (isWeb) {
      // Check for disallowed fields first
      if (otp) {
        return helpers.error("any.custom", {
          message: "OTP is not allowed for Web flow. Use token instead.",
        });
      }
      // Then check for required fields
      if (!token) {
        return helpers.error("any.custom", {
          message: "Reset token is required for Web",
        });
      }
    }

    // App flow validation
    if (isApp) {
      // Check for disallowed fields first
      if (token) {
        return helpers.error("any.custom", {
          message: "Token is not allowed for App flow. Use OTP instead.",
        });
      }
      // Then check for required fields
      if (!otp) {
        return helpers.error("any.custom", {
          message: "OTP is required for App",
        });
      }
    }

    return value;
  })
  .messages({
    "any.custom": "{{#error.message}}",
  })
  .label("ResetPasswordPayload");

/**
 * Change Password Validation Schema
 * @constant {Joi.ObjectSchema} changePasswordSchema
 * @description Validates change password request data
 */
export const changePasswordSchema = Joi.object(
  withFieldLabels({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
  })
).label("ChangePasswordPayload");

/**
 * Update Profile Validation Schema
 * @constant {Joi.ObjectSchema} updateProfileSchema
 * @description Validates update profile request data
 */
export const updateProfileSchema = Joi.object(
  withFieldLabels({
    name: nameSchema.optional(),
    phone: phoneSchema,
    countryCode: countryCodeSchema,
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
    age: Joi.number()
      .integer()
      .min(1)
      .max(150)
      .optional()
      .allow(null)
      .messages({
        "number.min": "Age must be at least 1",
        "number.max": "Age cannot exceed 150",
        "number.integer": "Age must be an integer",
      }),
    language: Joi.string()
      .valid(
        "English",
        "Dutch",
        "German",
        "French",
        "Spanish",
        "Italian",
        "Portuguese"
      )
      .optional()
      .label("Language")
      .messages({
        "any.only":
          "Language must be one of: English, Dutch, German, French, Spanish, Italian, Portuguese",
      }),
  })
).label("UpdateProfilePayload");

/**
 * Refresh Token Validation Schema
 * @constant {Joi.ObjectSchema} refreshTokenSchema
 * @description Validates refresh token request data
 */
export const refreshTokenSchema = Joi.object(
  withFieldLabels({
    refreshToken: Joi.string().required().messages({
      "any.required": "Refresh token is required",
    }),
  })
).label("RefreshTokenPayload");
