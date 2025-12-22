import { Request, Response } from "express";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { authService } from "@/services/authService";
import { User } from "@/models/index.model";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
  sessionId?: string;
}

class AuthController {
  /**
   * Register new user
   */
  register = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { name, email, password, phone, countryCode } = req.body;

      const result = await authService.register({
        name,
        email,
        password,
        phone,
        countryCode,
      });

      res.apiCreated(
        {
          user: result.user,
        },
        result.message
      );
    }
  );

  /**
   * Verify OTP
   */
  verifyOTP = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, otp, type, deviceInfo } = req.body;

      const result = await authService.verifyOTP({
        email,
        otp,
        type,
        deviceInfo,
      });

      // For password reset OTP, tokens will be undefined
      const responseData: any = {
        user: result.user,
      };

      // Only include tokens if they exist (not password reset flow)
      if (result.accessToken && result.refreshToken) {
        responseData.accessToken = result.accessToken;
        responseData.refreshToken = result.refreshToken;
      }

      res.apiSuccess(responseData, result.message);
    }
  );

  /**
   * Login user
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email, password, deviceInfo } = req.body;

    if (!deviceInfo) {
      throw new AppError("deviceInfo is required for login", 400);
    }

    const result = await authService.login({
      email,
      password,
      deviceInfo,
    });

    res.apiSuccess(
      {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
      result.message
    );
  });

  /**
   * Resend OTP
   */
  resendOTP = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, type } = req.body;

      const result = await authService.resendOTP(email, type);

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Forgot password
   * Supports both Web (reset link) and App (OTP) flows based on deviceInfo
   */
  forgotPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, deviceInfo } = req.body;

      if (!deviceInfo) {
        throw new AppError("deviceInfo is required", 400);
      }

      const result = await authService.forgotPassword(email, deviceInfo);

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Reset password - Unified endpoint for Web (token) and App (verified OTP) flows
   * Always requires: email, password, confirmPassword
   * Web flow: also requires token
   * App flow: OTP must be verified separately via verify-otp API first
   */
  resetPassword = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { email, password, confirmPassword, token } = req.body;

      const result = await authService.resetPassword({
        email,
        password,
        confirmPassword,
        token,
      });

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Change password
   */
  changePassword = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId || req.user?._id || req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const result = await authService.changePassword({
        userId,
        currentPassword,
        newPassword,
      });

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Logout user
   */
  logout = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const sessionId = req.sessionId;

      if (!sessionId) {
        throw new AppError("Session not found", 401);
      }

      const result = await authService.logout(sessionId);

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Logout from all devices
   */
  logoutAllDevices = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?._id || req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const result = await authService.logoutAllDevices(userId);

      res.apiSuccess(null, result.message);
    }
  );

  /**
   * Get current user profile
   */
  getProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const user = req.user;

      // Get full user data from database to ensure we have all fields
      const fullUser = await User.findById(user?.id).select("-password").lean();

      if (!fullUser) {
        throw new AppError("User not found", 404);
      }

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate = fullUser.registeredAt || fullUser.createdAt;

      res.apiSuccess(
        {
          user: {
            _id: fullUser._id,
            name: fullUser.name,
            email: fullUser.email,
            phone: fullUser.phone,
            countryCode: fullUser.countryCode,
            isEmailVerified: fullUser.isEmailVerified,
            role: fullUser.role,
            isActive: fullUser.isActive,
            avatar: fullUser.avatar,
            profileImage: fullUser.profileImage,
            gender: fullUser.gender,
            age: fullUser.age,
            language: fullUser.language || "English",
            lastLogin: fullUser.lastLogin,
            registeredAt: registrationDate,
            createdAt: fullUser.createdAt,
          },
        },
        "Profile retrieved successfully"
      );
    }
  );

  /**
   * Update user profile
   */
  updateProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.userId || req.user?._id || req.user?.id;
      const { name, phone, countryCode, profileImage, gender, age, language } =
        req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // Build update object with only provided fields
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (countryCode !== undefined) updateData.countryCode = countryCode;
      if (profileImage !== undefined) updateData.profileImage = profileImage;
      if (gender !== undefined) updateData.gender = gender;
      if (age !== undefined) updateData.age = age;
      if (language !== undefined) updateData.language = language;

      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!updatedUser) {
        throw new AppError("User not found", 404);
      }

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate =
        updatedUser.registeredAt || updatedUser.createdAt;

      res.apiSuccess(
        {
          user: {
            _id: updatedUser._id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            phone: updatedUser.phone,
            countryCode: updatedUser.countryCode,
            isEmailVerified: updatedUser.isEmailVerified,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            avatar: updatedUser.avatar,
            profileImage: updatedUser.profileImage,
            gender: updatedUser.gender,
            age: updatedUser.age,
            language: updatedUser.language || "English",
            lastLogin: updatedUser.lastLogin,
            registeredAt: registrationDate,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
          },
        },
        "Profile updated successfully"
      );
    }
  );

  /**
   * Refresh access token
   */
  refreshToken = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
      }

      const result = await authService.refreshToken(refreshToken);

      res.apiSuccess(
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        result.message
      );
    }
  );

  /**
   * Clean up expired OTPs (Admin only)
   */
  cleanupOTPs = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const result = await authService.cleanupExpiredOTPs();

      res.apiSuccess(
        {
          deletedCount: result.deletedCount,
        },
        result.message
      );
    }
  );

  /**
   * Get OTP statistics (Admin only)
   */
  getOTPStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const stats = await authService.getOTPStats();

      res.apiSuccess(
        {
          stats,
        },
        "OTP statistics retrieved successfully"
      );
    }
  );

  /**
   * Google OAuth Login
   */
  googleLogin = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { idToken, deviceInfo } = req.body;

      const result = await authService.googleLogin({
        idToken,
        deviceInfo,
      });

      res.apiSuccess(
        {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        result.message
      );
    }
  );
}

export const authController = new AuthController();
