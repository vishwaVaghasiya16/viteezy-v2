import Joi from "joi";
import { OTPType } from "../models/enums";
import { AppError } from "@/utils/AppError";

// Common validation patterns
const emailSchema = Joi.string().email().required().messages({
  "string.email": "Please provide a valid email address",
  "any.required": "Email is required",
});

const passwordSchema = Joi.string().min(6).max(128).required().messages({
  "string.min": "Password must be at least 6 characters long",
  "string.max": "Password cannot exceed 128 characters",
  "any.required": "Password is required",
});

const currentPasswordSchema = Joi.string().min(6).max(128).required().messages({
  "string.min": "Current Password must be at least 6 characters long",
  "string.max": "Current Password cannot exceed 128 characters",
  "any.required": "Current Password is required",
});

const newPasswordSchema = Joi.string().min(6).max(128).required().messages({
  "string.min": "New Password must be at least 6 characters long",
  "string.max": "New Password cannot exceed 128 characters",
  "any.required": "New Password is required",
});

const nameSchema = Joi.string().min(2).max(50).required().messages({
  "string.min": "Name must be at least 2 characters long",
  "string.max": "Name cannot exceed 50 characters",
  "any.required": "Name is required",
});

const deviceInfoSchema = Joi.string().required().messages({
  "any.required": "Device Info is required",
});

const phoneSchema = Joi.string()
  .pattern(/^[+]?[1-9]\d{1,14}$/)
  .optional()
  .messages({
    "string.pattern.base": "Please provide a valid phone number",
  });

const otpSchema = Joi.string()
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.pattern.base": "OTP must be a 6-digit number",
    "any.required": "OTP is required",
  });

const otpTypeSchema = Joi.string()
  .valid(...Object.values(OTPType))
  .required()
  .messages({
    "any.only": `OTP type must be one of: ${Object.values(OTPType).join(", ")}`,
    "any.required": "OTP type is required",
  });

// Validation schemas
export const registerSchema = Joi.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
});

export const loginSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  deviceInfo: deviceInfoSchema,
});

export const sendOTPSchema = Joi.object({
  email: emailSchema,
  type: otpTypeSchema,
});

export const verifyOTPSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
  type: otpTypeSchema,
});

export const resendOTPSchema = Joi.object({
  email: emailSchema,
  type: otpTypeSchema,
});

export const forgotPasswordSchema = Joi.object({
  email: emailSchema,
});

export const resetPasswordSchema = Joi.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const changePasswordSchema = Joi.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});

export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required",
  }),
});

// Validation middleware
export const validateAuth = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const first = error.details[0];
      const firstMessage = first?.message || "Validation error";
      const appErr: any = new AppError("Validation error", 400);
      appErr.errorType = "Validation error";
      appErr.error = firstMessage;
      throw appErr;
    }

    req.body = value;
    next();
  };
};
