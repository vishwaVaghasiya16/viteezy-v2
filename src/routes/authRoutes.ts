/**
 * @fileoverview Authentication Routes
 * @description Routes for user authentication and authorization
 * @module routes/authRoutes
 */

import { Router } from "express";
import { AuthController } from "@/controllers/authController";
import { validateJoi } from "@/middleware/joiValidation";
import {
  registerSchema,
  loginSchema,
  sendOTPSchema,
  verifyOTPSchema,
  resendOTPSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  refreshTokenSchema,
} from "@/validation/authValidation";
import { authMiddleware } from "@/middleware/auth";

const router = Router();

/**
 * Public Routes (No Authentication Required)
 * These routes are accessible without authentication token
 */

// User registration endpoint
router.post("/register", validateJoi(registerSchema), AuthController.register);

// User login endpoint
router.post("/login", validateJoi(loginSchema), AuthController.login);

// Refresh token endpoint
router.post(
  "/refresh-token",
  validateJoi(refreshTokenSchema),
  AuthController.refreshToken
);

// Verify OTP endpoint
router.post(
  "/verify-otp",
  validateJoi(verifyOTPSchema),
  AuthController.verifyOTP
);

// Resend OTP endpoint
router.post(
  "/resend-otp",
  validateJoi(resendOTPSchema),
  AuthController.resendOTP
);

// Forgot password endpoint
router.post(
  "/forgot-password",
  validateJoi(forgotPasswordSchema),
  AuthController.forgotPassword
);

// Reset password endpoint
router.post(
  "/reset-password",
  validateJoi(resetPasswordSchema),
  AuthController.resetPassword
);

/**
 * Protected Routes (Authentication Required)
 * All routes below require valid authentication token
 */
router.use(authMiddleware);

// Change password endpoint
router.post(
  "/change-password",
  validateJoi(changePasswordSchema),
  AuthController.changePassword
);

// Logout endpoint (current device)
router.post("/logout", AuthController.logout);

// Logout all devices endpoint
router.post("/logout-all-devices", AuthController.logoutAllDevices);

// Get user profile endpoint
router.get("/profile", AuthController.getProfile);

// Update user profile endpoint
router.put(
  "/profile",
  validateJoi(updateProfileSchema),
  AuthController.updateProfile
);

/**
 * Admin Routes
 * Routes for administrative functions (OTP management)
 */

// Cleanup expired OTPs endpoint
router.post("/cleanup-otps", AuthController.cleanupOTPs);

// Get OTP statistics endpoint
router.get("/otp-stats", AuthController.getOTPStats);

export default router;
