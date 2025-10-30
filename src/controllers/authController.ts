import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user?: any;
  userId?: string;
  sessionId?: string;
}
import { authService } from "../services/authService";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";

export class AuthController {
  /**
   * Register new user
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, password, phone } = req.body;

      const result = await authService.register({
        name,
        email,
        password,
        phone,
      });

      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP
   */
  static async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, type } = req.body;

      const result = await authService.verifyOTP({
        email,
        otp,
        type,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const result = await authService.login({
        email,
        password,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, type } = req.body;

      const result = await authService.resendOTP(email, type);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password
   */
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const result = await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp, newPassword } = req.body;

      const result = await authService.resetPassword({
        email,
        otp,
        newPassword,
      });

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const result = await authService.changePassword({
        userId,
        currentPassword,
        newPassword,
      });

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  static async logout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const sessionId = req.user?.sessionId;
      console.log(req.user);
      console.log({ sessionId });

      if (!sessionId) {
        throw new AppError("Session not found", 401);
      }

      const result = await authService.logout(sessionId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAllDevices(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const result = await authService.logoutAllDevices(userId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user;

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user?.id,
            name: user?.name,
            email: user?.email,
            phone: user?.phone,
            isEmailVerified: user?.isEmailVerified,
            role: user?.role,
            isActive: user?.isActive,
            lastLogin: user?.lastLogin,
            createdAt: user?.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId = req.user?.id;
      const { name, phone } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      // TODO: Implement profile update logic
      // const updatedUser = await User.findByIdAndUpdate(
      //   userId,
      //   { name, phone },
      //   { new: true, runValidators: true }
      // );

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
      }

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Clean up expired OTPs (Admin only)
   */
  static async cleanupOTPs(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const result = await authService.cleanupExpiredOTPs();

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          deletedCount: result.deletedCount,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get OTP statistics (Admin only)
   */
  static async getOTPStats(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const stats = await authService.getOTPStats();

      res.status(200).json({
        success: true,
        data: {
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
