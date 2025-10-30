import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { User, OTP, AuthSessions } from "../models/index.model";
import { OTPType, OTPStatus } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { emailService } from "./emailService";

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface LoginData {
  email: string;
  password: string;
  deviceInfo: string;
}

interface OTPVerificationData {
  email: string;
  otp: string;
  type: OTPType;
  deviceInfo?: string;
}

interface LoginResult {
  user: any;
  accessToken: string;
  refreshToken: string;
  message: string;
}

interface PasswordResetData {
  email: string;
  otp: string;
  newPassword: string;
}

interface ChangePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private readonly OTP_EXPIRES_IN: number; // in minutes
  private readonly MAX_OTP_ATTEMPTS: number = 3;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
    this.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRE || "15m"; // 15 minutes for access token
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRE || "7d"; // 7 days for refresh token
    this.OTP_EXPIRES_IN = parseInt(process.env.OTP_EXPIRES_IN || "10"); // 10 minutes

    // Validate JWT_EXPIRES_IN format
    if (!this.isValidExpiresIn(this.JWT_EXPIRES_IN)) {
      this.JWT_EXPIRES_IN = "15m"; // Default to 15 minutes
    }

    if (!this.isValidExpiresIn(this.JWT_REFRESH_EXPIRES_IN)) {
      this.JWT_REFRESH_EXPIRES_IN = "7d"; // Default to 7 days
    }

    if (!this.JWT_SECRET || this.JWT_SECRET === "your-secret-key") {
      console.warn(
        "Warning: JWT_SECRET is not set. Using default secret key. This is not secure for production!"
      );
    }

    if (
      !this.JWT_REFRESH_SECRET ||
      this.JWT_REFRESH_SECRET === "your-refresh-secret-key"
    ) {
      console.warn(
        "Warning: JWT_REFRESH_SECRET is not set. Using default secret key. This is not secure for production!"
      );
    }
  }

  private isValidExpiresIn(value: string): boolean {
    // Check if it's a valid JWT expiresIn format
    return /^\d+[smhd]$/.test(value) || /^\d+$/.test(value);
  }

  /**
   * Generate OTP
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  }

  /**
   * Generate Access Token
   */
  private generateAccessToken(userId: string, sessionId: string): string {
    try {
      const payload = {
        userId,
        sessionId,
        type: "access",
      };

      const options: SignOptions = {
        expiresIn: this.JWT_EXPIRES_IN as any,
      };

      return jwt.sign(payload, this.JWT_SECRET, options);
    } catch (error) {
      throw new Error("Failed to generate access token");
    }
  }

  /**
   * Generate Refresh Token
   */
  private generateRefreshToken(userId: string, sessionId: string): string {
    try {
      const payload = {
        userId,
        sessionId,
        type: "refresh",
      };

      const options: SignOptions = {
        expiresIn: this.JWT_REFRESH_EXPIRES_IN as any,
      };

      return jwt.sign(payload, this.JWT_REFRESH_SECRET, options);
    } catch (error) {
      throw new Error("Failed to generate refresh token");
    }
  }

  /**
   * Generate both tokens
   */
  private generateTokens(
    userId: string,
    sessionId: string
  ): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.generateAccessToken(userId, sessionId),
      refreshToken: this.generateRefreshToken(userId, sessionId),
    };
  }

  /**
   * Send OTP via Email
   */
  private async sendOTP(
    email: string,
    otp: string,
    type: OTPType
  ): Promise<void> {
    try {
      // Send OTP via email
      const emailSent = await emailService.sendOTPEmail(email, otp, type);

      if (emailSent) {
        logger.info(`OTP email sent successfully to ${email} (Type: ${type})`);
      } else {
        logger.error(`Failed to send OTP email to ${email} (Type: ${type})`);
        throw new AppError(
          "Failed to send verification email. Please try again later.",
          502
        );
      }
    } catch (error) {
      logger.error("Error sending OTP email:", error);
      throw new AppError(
        "Failed to send verification email. Please try again later.",
        502
      );
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ user: any; message: string }> {
    const { name, email, password, phone } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("User already exists with this email", 400);
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      name,
      email,
      password, // Let the pre-save hook handle hashing
      phone,
      isEmailVerified: false,
    });

    logger.info(
      `User created successfully: ${user.email}, isEmailVerified: ${user.isEmailVerified}`
    );

    // Generate and send OTP for email verification
    await this.sendOTPForVerification(
      user._id.toString(),
      email,
      OTPType.EMAIL_VERIFICATION
    );

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(email, name);
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
      // Don't fail registration if welcome email fails
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
      },
      message:
        "Registration successful. Please verify your email with the OTP sent.",
    };
  }

  /**
   * Send OTP for verification
   */
  async sendOTPForVerification(
    userId: string,
    email: string,
    type: OTPType
  ): Promise<{ message: string }> {
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Check for existing pending OTP
    const existingOTP = await OTP.findOne({
      userId,
      type,
      status: OTPStatus.PENDING,
    });

    if (existingOTP) {
      // Check if OTP is still valid (not expired)
      if (existingOTP.expiresAt > new Date()) {
        throw new AppError(
          "OTP already sent. Please wait before requesting a new one.",
          400
        );
      }
      // Mark expired OTP as expired
      await OTP.findByIdAndUpdate(existingOTP._id, {
        status: OTPStatus.EXPIRED,
      });
    }

    // Generate new OTP
    const otpCode = this.generateOTP();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRES_IN * 60 * 1000);

    // Save OTP to database (will be hashed by pre-save hook)
    await OTP.create({
      userId,
      email,
      phone: user.phone, // Use user's phone from database
      otpHash: otpCode, // Will be hashed by pre-save hook
      type,
      expiresAt,
      status: OTPStatus.PENDING,
    });

    // Send OTP via email only (will throw on failure)
    await this.sendOTP(email, otpCode, type);

    return {
      message: `OTP sent to ${email}`,
    };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(data: OTPVerificationData): Promise<LoginResult> {
    const { email, otp, type, deviceInfo } = data;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      userId: user._id,
      email,
      type,
      status: OTPStatus.PENDING,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      // Increment attempts for failed verification
      await OTP.updateOne(
        { userId: user._id, email, type, status: OTPStatus.PENDING },
        { $inc: { attempts: 1 } }
      );

      throw new AppError("Invalid or expired OTP", 400);
    }

    // Check if OTP can attempt
    if (!otpRecord.canAttempt()) {
      await OTP.findByIdAndUpdate(otpRecord._id, { status: OTPStatus.EXPIRED });
      throw new AppError(
        "Maximum OTP attempts exceeded. Please request a new OTP.",
        400
      );
    }

    // Check if OTP is expired
    if (otpRecord.isExpired()) {
      await OTP.findByIdAndUpdate(otpRecord._id, { status: OTPStatus.EXPIRED });
      throw new AppError("OTP has expired. Please request a new OTP.", 400);
    }

    // Verify OTP using secure comparison
    const isOTPValid = await otpRecord.compareOTP(otp);
    if (!isOTPValid) {
      // Increment attempts for failed verification
      await OTP.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
      throw new AppError("Invalid OTP", 400);
    }

    // Mark OTP as verified
    await OTP.findByIdAndUpdate(otpRecord._id, {
      status: OTPStatus.VERIFIED,
      verifiedAt: new Date(),
    });

    // Update user based on OTP type
    if (type === OTPType.EMAIL_VERIFICATION) {
      await User.findByIdAndUpdate(user._id, { isEmailVerified: true });
      logger.info(`Email verified successfully for user: ${user.email}`);
    }

    // Generate session and tokens
    const sessionId = crypto.randomUUID();
    await AuthSessions.create({
      userId: user._id,
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: deviceInfo || "Web",
      lastUsedAt: new Date(),
    });

    const tokens = this.generateTokens(user._id.toString(), sessionId);

    // Track session on user document
    await User.findByIdAndUpdate(user._id, {
      $push: {
        sessionIds: {
          sessionId: sessionId,
          status: "active",
          revoked: false,
          deviceInfo: deviceInfo || "Web",
        },
      },
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isEmailVerified:
          type === OTPType.EMAIL_VERIFICATION ? true : user.isEmailVerified,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: "OTP verified successfully",
    };
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<LoginResult> {
    const { email, password, deviceInfo } = data;

    // Find user with password
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      logger.error(`Login failed: User not found for email: ${email}`);
      throw new AppError("Invalid email or password", 401);
    }

    logger.info(
      `Login attempt for user: ${user.email}, isEmailVerified: ${user.isEmailVerified}`
    );

    // Check if user is active
    if (!user.isActive) {
      throw new AppError(
        "Account is deactivated. Please contact support.",
        401
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    logger.info(`Password validation result: ${isPasswordValid}`);
    if (!isPasswordValid) {
      logger.error(`Login failed: Invalid password for email: ${email}`);
      throw new AppError("Invalid email or password", 401);
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      logger.error(`Login failed: Email not verified for email: ${email}`);
      throw new AppError(
        "Please verify your email before logging in. Check your email for verification OTP.",
        401
      );
    }

    // Generate session and tokens
    const sessionId = crypto.randomUUID();
    await AuthSessions.create({
      userId: user._id,
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: deviceInfo,
      lastUsedAt: new Date(),
    });

    const tokens = this.generateTokens(user._id.toString(), sessionId);

    // Update last login
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      $push: {
        sessionIds: {
          sessionId: sessionId,
          status: "active",
          revoked: false,
          deviceInfo: deviceInfo,
        },
      },
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: "Login successful",
    };
  }

  /**
   * Resend OTP
   */
  async resendOTP(email: string, type: OTPType): Promise<{ message: string }> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Check for recent OTP requests (rate limiting)
    const recentOTP = await OTP.findOne({
      userId: user._id,
      type,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }, // 1 minute ago
    });

    if (recentOTP) {
      throw new AppError("Please wait before requesting a new OTP", 400);
    }

    return await this.sendOTPForVerification(user._id.toString(), email, type);
  }

  /**
   * Forgot password
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    return await this.sendOTPForVerification(
      user._id.toString(),
      email,
      OTPType.PASSWORD_RESET
    );
  }

  /**
   * Reset password
   */
  async resetPassword(data: PasswordResetData): Promise<{ message: string }> {
    const { email, otp, newPassword } = data;

    // Verify OTP first
    await this.verifyOTP({ email, otp, type: OTPType.PASSWORD_RESET });

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save(); // This will trigger the pre-save hook

    // Invalidate all existing sessions
    await AuthSessions.updateMany(
      { userId: user._id },
      { revoked: true, revokedAt: new Date() }
    );

    // Mark all user's stored sessionIds as revoked
    await User.findByIdAndUpdate(user._id, {
      $set: {
        "sessionIds.$[].status": "revoked",
        "sessionIds.$[].revoked": true,
      },
    });

    return {
      message:
        "Password reset successfully. Please login with your new password.",
    };
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const { userId, currentPassword, newPassword } = data;

    // Find user with password
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 400);
    }

    // Update password (will be hashed by pre-save hook)
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      throw new AppError("User not found", 404);
    }

    userToUpdate.password = newPassword;
    await userToUpdate.save(); // This will trigger the pre-save hook

    return {
      message: "Password changed successfully",
    };
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<{ message: string }> {
    await AuthSessions.findOneAndUpdate(
      { sessionId: sessionId },
      { revoked: true, revokedAt: new Date() }
    );

    // Mark session as revoked in user's sessionIds
    await User.updateOne(
      { "sessionIds.sessionId": sessionId },
      {
        $set: {
          "sessionIds.$[elem].status": "revoked",
          "sessionIds.$[elem].revoked": true,
        },
      },
      { arrayFilters: [{ "elem.sessionId": sessionId }] } as any
    );

    return {
      message: "Logged out successfully",
    };
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(userId: string): Promise<{ message: string }> {
    await AuthSessions.updateMany(
      { userId },
      { revoked: true, revokedAt: new Date() }
    );

    // Mark all sessionIds as revoked on user
    await User.findByIdAndUpdate(userId, {
      $set: {
        "sessionIds.$[].status": "revoked",
        "sessionIds.$[].revoked": true,
      },
    });

    return {
      message: "Logged out from all devices successfully",
    };
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<{
    message: string;
    deletedCount: number;
  }> {
    try {
      const result = await OTP.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { status: OTPStatus.EXPIRED },
          { attempts: { $gte: this.MAX_OTP_ATTEMPTS } },
        ],
      });

      logger.info(`Cleaned up ${result.deletedCount} expired OTPs`);

      return {
        message: `Cleaned up ${result.deletedCount} expired OTPs`,
        deletedCount: result.deletedCount,
      };
    } catch (error) {
      logger.error("Error cleaning up expired OTPs:", error);
      throw new AppError("Failed to cleanup expired OTPs", 500);
    }
  }

  /**
   * Get OTP statistics
   */
  async getOTPStats(): Promise<{
    total: number;
    pending: number;
    verified: number;
    expired: number;
  }> {
    try {
      const [total, pending, verified, expired] = await Promise.all([
        OTP.countDocuments(),
        OTP.countDocuments({ status: OTPStatus.PENDING }),
        OTP.countDocuments({ status: OTPStatus.VERIFIED }),
        OTP.countDocuments({ status: OTPStatus.EXPIRED }),
      ]);

      return { total, pending, verified, expired };
    } catch (error) {
      logger.error("Error getting OTP stats:", error);
      throw new AppError("Failed to get OTP statistics", 500);
    }
  }

  /**
   * Refresh Access Token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string; message: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;

      if (decoded.type !== "refresh") {
        throw new AppError("Invalid token type", 401);
      }

      // Check if session exists and is valid
      const session = await AuthSessions.findOne({
        sessionId: decoded.sessionId,
        userId: decoded.userId,
        revoked: false,
        expiresAt: { $gt: new Date() },
      });

      if (!session) {
        throw new AppError("Invalid or expired refresh token", 401);
      }

      // Check if user exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError("User not found or inactive", 401);
      }

      // Generate new tokens
      const tokens = this.generateTokens(decoded.userId, decoded.sessionId);

      // Update last used time
      await AuthSessions.findByIdAndUpdate(session._id, {
        lastUsedAt: new Date(),
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: "Tokens refreshed successfully",
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError("Invalid refresh token", 401);
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new AppError("Refresh token expired", 401);
      } else {
        throw error;
      }
    }
  }
}

export const authService = new AuthService();
