/**
 * @fileoverview Authentication Routes
 * @description Routes for user authentication and authorization
 * @module routes/authRoutes
 */

import { Router } from "express";
import { authController } from "@/controllers/authController";
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
  googleLoginSchema,
} from "@/validation/authValidation";
import { authMiddleware } from "@/middleware/auth";

const router = Router();

/**
 * Public Routes (No Authentication Required)
 * These routes are accessible without authentication token
 */

// User registration endpoint
router.post("/register", validateJoi(registerSchema), authController.register);

// User login endpoint
router.post("/login", validateJoi(loginSchema), authController.login);

// Google OAuth login endpoint
router.post(
  "/google/login",
  validateJoi(googleLoginSchema),
  authController.googleLogin
);

// Refresh token endpoint
router.post(
  "/refresh-token",
  validateJoi(refreshTokenSchema),
  authController.refreshToken
);

// Verify OTP endpoint
router.post(
  "/verify-otp",
  validateJoi(verifyOTPSchema),
  authController.verifyOTP
);

// Resend OTP endpoint
router.post(
  "/resend-otp",
  validateJoi(resendOTPSchema),
  authController.resendOTP
);

// Forgot password endpoint
router.post(
  "/forgot-password",
  validateJoi(forgotPasswordSchema),
  authController.forgotPassword
);

// Reset password endpoint (unified for Web and App)
router.post(
  "/reset-password",
  validateJoi(resetPasswordSchema),
  authController.resetPassword
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
  authController.changePassword
);

// Logout endpoint (current device)
router.post("/logout", authController.logout);

// Logout all devices endpoint
router.post("/logout-all-devices", authController.logoutAllDevices);

// Get user profile endpoint
router.get("/profile", authController.getProfile);

// Update user profile endpoint
router.put(
  "/profile",
  validateJoi(updateProfileSchema),
  authController.updateProfile
);

/**
 * Admin Routes
 * Routes for administrative functions (OTP management)
 */

// Cleanup expired OTPs endpoint
router.post("/cleanup-otps", authController.cleanupOTPs);

// Get OTP statistics endpoint
router.get("/otp-stats", authController.getOTPStats);

export default router;
