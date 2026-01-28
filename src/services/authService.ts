import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { User, OTP, AuthSessions } from "../models/index.model";
import { OTPType, OTPStatus, SessionStatus, UserRole } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { emailService } from "./emailService";
import { generateMemberId } from "../utils/memberIdGenerator";
import { firebaseService } from "./firebaseService";
import { config } from "../config";
import { referralService } from "./referralService";

/**
 * Helper function to split full name into firstName and lastName
 */
function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "User", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  countryCode?: string;
}

interface LoginData {
  email: string;
  password: string;
  deviceInfo: string;
}

interface AppleLoginData {
  idToken: string;
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
  password: string;
  confirmPassword: string;
  token?: string; // Required for Web flow, not needed for App flow
}

interface ChangePasswordData {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

interface GoogleLoginData {
  idToken: string;
  deviceInfo?: string;
}

interface RegisterFamilyMemberData {
  parentMemberId: string;
  firstName: string;
  lastName: string;
  email?: string;
  password: string;
  phone?: string;
  countryCode?: string;
  gender?: string;
  age?: number;
  relationshipToParent: string;
}

class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;
  private readonly OTP_EXPIRES_IN: number; // in minutes
  private readonly MAX_OTP_ATTEMPTS: number = 3;
  private readonly googleOAuthClient: OAuth2Client;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
    this.JWT_REFRESH_SECRET =
      process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRE || "15m"; // 15 minutes for access token
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRE || "7d"; // 7 days for refresh token
    this.OTP_EXPIRES_IN = parseInt(process.env.OTP_EXPIRES_IN || "5"); // 5 minutes

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

    // Initialize Google OAuth Client
    this.googleOAuthClient = new OAuth2Client(config.google.clientId);
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
   * Send welcome email asynchronously so that registration response is not delayed
   */
  private sendWelcomeEmailAsync(
    email: string,
    firstName: string,
    lastName: string
  ): void {
    const fullName = `${firstName} ${lastName}`.trim();
    Promise.resolve()
      .then(() => emailService.sendWelcomeEmail(email, fullName))
      .catch((error) => {
        logger.error("Failed to send welcome email:", error);
      });
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ user: any; message: string }> {
    const { firstName, lastName, email, password, phone, countryCode } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        throw new AppError("User already exists with this email", 400);
      }

      let userUpdated = false;

      if (existingUser.firstName !== firstName) {
        existingUser.firstName = firstName;
        userUpdated = true;
      }

      if (existingUser.lastName !== lastName) {
        existingUser.lastName = lastName;
        userUpdated = true;
      }

      if (typeof phone !== "undefined" && existingUser.phone !== phone) {
        existingUser.phone = phone;
        userUpdated = true;
      }

      if (
        typeof countryCode !== "undefined" &&
        existingUser.countryCode !== countryCode
      ) {
        existingUser.countryCode = countryCode;
        userUpdated = true;
      }

      if (password) {
        existingUser.password = password;
        userUpdated = true;
      }

      if (userUpdated) {
        await existingUser.save();
      }

      // Expire any pending verification OTPs before issuing a new one
      await OTP.updateMany(
        {
          userId: existingUser._id,
          type: OTPType.EMAIL_VERIFICATION,
          status: OTPStatus.PENDING,
        },
        { status: OTPStatus.EXPIRED }
      );

      await this.sendOTPForVerification(
        existingUser._id.toString(),
        email,
        OTPType.EMAIL_VERIFICATION
      );

      // this.sendWelcomeEmailAsync(email, existingUser.name);

      // Generate member ID if user doesn't have one
      if (!existingUser.memberId) {
        existingUser.memberId = await generateMemberId();
        await existingUser.save();
        logger.info(
          `Member ID generated for existing user: ${existingUser.memberId}`
        );
      }

      // Use registeredAt if set, otherwise fallback to createdAt
      const registrationDate =
        existingUser.registeredAt || existingUser.createdAt;

      return {
        user: {
          _id: existingUser._id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          phone: existingUser.phone,
          countryCode: existingUser.countryCode,
          memberId: existingUser.memberId,
          isEmailVerified: existingUser.isEmailVerified,
          registeredAt: registrationDate,
        },
        message:
          "Registration successful. Please verify your email with the OTP sent.",
      };
    }

    // Generate unique member ID for new user
    const memberId = await generateMemberId();

    // Generate unique referral code for new user
    const referralCode = await referralService.generateReferralCode(firstName);

    // Create user (password will be hashed by pre-save hook)
    // registeredAt will be automatically set by pre-save hook
    const user = await User.create({
      firstName,
      lastName,
      email,
      password, // Let the pre-save hook handle hashing
      phone,
      countryCode,
      memberId, // Assign generated member ID
      referralCode, // Assign generated referral code
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

    // Send welcome email asynchronously to avoid delaying the API response
    // this.sendWelcomeEmailAsync(email, firstName, lastName);

    // Use registeredAt if set, otherwise fallback to createdAt
    const registrationDate = user.registeredAt || user.createdAt;

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        memberId: user.memberId, // Include member ID in response
        isEmailVerified: user.isEmailVerified,
        registeredAt: registrationDate,
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
      // Try to find any pending OTP for this user/email/type to increment attempts
      const anyPendingOTP = await OTP.findOne({
        userId: user._id,
        email,
        type,
        status: OTPStatus.PENDING,
      });

      if (anyPendingOTP) {
        // Increment attempts for failed verification
        await OTP.findByIdAndUpdate(anyPendingOTP._id, {
          $inc: { attempts: 1 },
        });
      }

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

    // For password reset OTP, just verify it without logging the user in
    // User will then call reset-password API with password and confirmPassword
    if (type === OTPType.PASSWORD_RESET) {
      logger.info(
        `Password reset OTP verified successfully for user: ${user.email}. User can now reset password.`
      );
      return {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          isEmailVerified: user.isEmailVerified,
        },
        accessToken: undefined as any, // No tokens for password reset flow
        refreshToken: undefined as any, // No tokens for password reset flow
        message:
          "OTP verified successfully. Please proceed to reset your password.",
      };
    }

    // For other OTP types (email verification, etc.), generate session and tokens
    const sessionId = crypto.randomUUID();
    await AuthSessions.create({
      userId: user._id,
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: deviceInfo || "Web",
      lastUsedAt: new Date(),
      isRevoked: false,
    });

    const tokens = this.generateTokens(user._id.toString(), sessionId);

    // Track session on user document
    await User.findByIdAndUpdate(user._id, {
      $push: {
        sessionIds: {
          sessionId: sessionId,
          status: SessionStatus.ACTIVE,
          revoked: false,
          deviceInfo: deviceInfo || "Web",
        },
      },
    });

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
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
    // If credentials are correct but user is not verified, return Unverified errorType
    if (!user.isEmailVerified) {
      logger.warn(
        `Login attempt with correct credentials but unverified email: ${email}`
      );
      throw new AppError(
        "Please verify your email before logging in. Check your email for verification OTP.",
        401,
        true,
        "Unverified"
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
      isRevoked: false,
    });

    const tokens = this.generateTokens(user._id.toString(), sessionId);

    // Update last login
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      $push: {
        sessionIds: {
          sessionId: sessionId,
          status: SessionStatus.ACTIVE,
          revoked: false,
          deviceInfo: deviceInfo,
        },
      },
    });

    return {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
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
   * Apple Login - Verify Apple ID token and login/register user
   */
  async appleLogin(data: AppleLoginData): Promise<LoginResult> {
    const { idToken, deviceInfo } = data;

    // Verify Apple ID token using Firebase
    const decodedToken = await firebaseService.verifyAppleIdToken(idToken);
    const firebaseUser = firebaseService.getUserInfoFromToken(decodedToken);

    // Extract user information from token (email and name are guaranteed from getUserInfoFromToken)
    const email = firebaseUser.email.toLowerCase().trim();
    const fullName = firebaseUser.name;
    const { firstName, lastName } = splitFullName(fullName);

    if (!email) {
      throw new AppError(
        "Email not available from Apple account. Please ensure your Apple account has an email.",
        400
      );
    }

    // Check if user exists by email
    let user = await User.findOne({ email });

    if (!user) {
      // Create new user for Apple login (Register)
      const memberId = await generateMemberId();
      const referralCode = await referralService.generateReferralCode(firstName);
      user = await User.create({
        firstName,
        lastName,
        email,
        password: crypto.randomBytes(32).toString("hex"), // Random password since Apple handles auth
        isEmailVerified: firebaseUser.emailVerified, // Apple emails are typically verified
        memberId,
        referralCode,
      });

      logger.info(`New user registered via Apple login: ${user.email}`);
    } else {
      // User exists, login
      // Check if user is active
      if (!user.isActive) {
        throw new AppError(
          "Account is deactivated. Please contact support.",
          401
        );
      }

      // Update email verification status if Apple says it's verified
      if (firebaseUser.emailVerified && !user.isEmailVerified) {
        user.isEmailVerified = true;
        await user.save();
      }

      // Update name if it was changed or empty
      const currentFullName = `${user.firstName} ${user.lastName}`.trim();
      if (
        !currentFullName ||
        currentFullName === "Apple User" ||
        currentFullName === "User"
      ) {
        user.firstName = firstName;
        user.lastName = lastName;
        await user.save();
      }

      logger.info(`Existing user logged in via Apple: ${user.email}`);
    }

    // Generate session and tokens
    const sessionId = crypto.randomUUID();
    await AuthSessions.create({
      userId: user._id,
      sessionId: sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: deviceInfo,
      lastUsedAt: new Date(),
      isRevoked: false,
    });

    const tokens = this.generateTokens(user._id.toString(), sessionId);

    // Update last login
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        lastLogin: new Date(),
        $push: {
          sessionIds: {
            sessionId: sessionId,
            status: SessionStatus.ACTIVE,
            revoked: false,
            deviceInfo: deviceInfo,
          },
        },
      },
      { new: true }
    ).select("-password");

    // Return same response format for both login and register
    return {
      user: {
        _id: updatedUser!._id,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        email: updatedUser!.email,
        phone: updatedUser!.phone || null,
        isEmailVerified: updatedUser!.isEmailVerified,
        lastLogin: updatedUser!.lastLogin,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      message: "Login successful", // Always "Login successful" for both login and register
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
   * Forgot password - Send OTP (for App) or reset link (for Web) based on deviceInfo
   */
  async forgotPassword(
    email: string,
    deviceInfo: string,
    client?: "user" | "admin"
  ): Promise<{ message: string }> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message:
          "If an account exists with this email, a password reset instruction has been sent.",
      };
    }

    // Determine if request is from Web or App based on deviceInfo
    const isWeb = deviceInfo?.toLowerCase().includes("web");
    const isApp = deviceInfo?.toLowerCase().includes("app");

    // If neither Web nor App is detected, default to Web for backward compatibility
    const requestType = isApp ? "App" : "Web";

    logger.info(
      `Password reset request for ${email} from ${requestType} (deviceInfo: ${deviceInfo})`
    );

    if (isApp) {
      // App flow: Send OTP for mobile app password reset
      try {
        // Expire any pending password reset OTPs before issuing a new one
        await OTP.updateMany(
          {
            userId: user._id,
            type: OTPType.PASSWORD_RESET,
            status: OTPStatus.PENDING,
          },
          { status: OTPStatus.EXPIRED }
        );

        // Generate and send OTP for password reset
        await this.sendOTPForVerification(
          user._id.toString(),
          email,
          OTPType.PASSWORD_RESET
        );

        logger.info(
          `Password reset OTP sent successfully to ${email} (App request)`
        );

        return {
          message:
            "If an account exists with this email, a password reset OTP has been sent. Please verify the OTP to reset your password.",
        };
      } catch (error) {
        logger.error("Error sending password reset OTP:", error);
        throw new AppError(
          "Failed to send password reset OTP. Please try again later.",
          502
        );
      }
    } else {
      // Web flow: Send reset link via email
      try {
        // Generate secure reset token for link-based reset
        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save reset token to user
        await User.findByIdAndUpdate(user._id, {
          passwordResetToken: resetToken,
          passwordResetTokenExpires: resetTokenExpires,
        });

        // Generate reset URL for web/link-based reset
        // - User-side: FRONTEND_URL (default http://localhost:8080)
        // - Admin panel: ADMIN_PANEL_URL (default http://localhost:8081)
        const userFrontendUrl =
          process.env.FRONTEND_URL || "http://localhost:8080";
        const adminPanelUrl =
          process.env.ADMIN_PANEL_URL || "http://localhost:8081";

        // If the caller explicitly says "admin", always use admin panel URL.
        // Otherwise, fall back to user role (Admin => admin panel) for safety.
        const shouldUseAdminUrl =
          client === "admin" || (client !== "user" && user.role === UserRole.ADMIN);

        const baseUrl = shouldUseAdminUrl ? adminPanelUrl : userFrontendUrl;

        const resetUrl = `${baseUrl}/resetPassword?token=${resetToken}&email=${encodeURIComponent(
          email
        )}`;

        // Send reset link via email
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        const emailSent = await emailService.sendPasswordResetLinkEmail(
          email,
          fullName,
          resetUrl
        );

        if (emailSent) {
          logger.info(
            `Password reset link sent successfully to ${email} (Web request)`
          );
        } else {
          logger.error(`Failed to send password reset link to ${email}`);
          throw new AppError(
            "Failed to send password reset email. Please try again later.",
            502
          );
        }

        return {
          message:
            "If an account exists with this email, a password reset link has been sent. Please check your email to reset your password.",
        };
      } catch (error) {
        logger.error("Error sending password reset link email:", error);
        throw new AppError(
          "Failed to send password reset email. Please try again later.",
          502
        );
      }
    }
  }

  /**
   * Reset password - Unified method for Web (token) and App (verified OTP) flows
   * - Web flow: token must be provided (from reset link)
   * - App flow: token not provided, checks for verified OTP (OTP verified via verify-otp API)
   */
  async resetPassword(data: PasswordResetData): Promise<{ message: string }> {
    const { email, password, confirmPassword, token } = data;

    // Validate passwords match
    if (password !== confirmPassword) {
      throw new AppError("Password and Confirm Password must match", 400);
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (token) {
      // Web flow: Verify token and reset password
      // Find user with reset token
      const userWithToken = await User.findOne({
        email: email.toLowerCase(),
        passwordResetToken: token,
        passwordResetTokenExpires: { $gt: new Date() },
      }).select("+passwordResetToken +passwordResetTokenExpires");

      if (!userWithToken) {
        throw new AppError("Invalid or expired reset token", 400);
      }

      // Hash the new password (same way as pre-save hook)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update only password and reset token fields using updateOne to avoid validating other fields like sessionIds
      await User.updateOne(
        { _id: userWithToken._id },
        {
          password: hashedPassword,
          passwordResetToken: undefined,
          passwordResetTokenExpires: undefined,
        }
      );

      // Expire any pending password reset OTPs
      await OTP.updateMany(
        {
          userId: userWithToken._id,
          type: OTPType.PASSWORD_RESET,
          status: OTPStatus.PENDING,
        },
        { status: OTPStatus.EXPIRED }
      );

      // Invalidate all existing sessions
      await AuthSessions.updateMany(
        { userId: userWithToken._id },
        { isRevoked: true, revokedAt: new Date() }
      );

      // Mark all user's stored sessionIds as revoked
      await User.findByIdAndUpdate(userWithToken._id, {
        $set: {
          "sessionIds.$[].status": "Revoked",
          "sessionIds.$[].revoked": true,
        },
      });

      logger.info(
        `Password reset via token successfully for user: ${userWithToken.email} (Web)`
      );

      return {
        message:
          "Password reset successfully. Please login with your new password.",
      };
    } else {
      // App flow: Check for verified OTP (OTP should be verified via verify-otp API first)
      // Find verified password reset OTP (recently verified)
      const verifiedOTP = await OTP.findOne({
        userId: user._id,
        email: email.toLowerCase(),
        type: OTPType.PASSWORD_RESET,
        status: OTPStatus.VERIFIED,
        verifiedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Verified within last hour
      });

      if (!verifiedOTP) {
        throw new AppError(
          "No verified OTP found. Please verify OTP first.",
          400
        );
      }

      // Hash the new password (same way as pre-save hook)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update only password and reset token fields using updateOne to avoid validating other fields like sessionIds
      await User.updateOne(
        { _id: user._id },
        {
          password: hashedPassword,
          passwordResetToken: undefined,
          passwordResetTokenExpires: undefined,
        }
      );

      // Mark the verified OTP as used
      await OTP.findByIdAndUpdate(verifiedOTP._id, {
        status: OTPStatus.USED,
      });

      // Expire any other pending password reset OTPs
      await OTP.updateMany(
        {
          userId: user._id,
          type: OTPType.PASSWORD_RESET,
          status: { $in: [OTPStatus.PENDING, OTPStatus.VERIFIED] },
          _id: { $ne: verifiedOTP._id },
        },
        { status: OTPStatus.EXPIRED }
      );

      // Invalidate all existing sessions
      await AuthSessions.updateMany(
        { userId: user._id },
        { isRevoked: true, revokedAt: new Date() }
      );

      // Mark all user's stored sessionIds as revoked
      await User.findByIdAndUpdate(user._id, {
        $set: {
          "sessionIds.$[].status": "Revoked",
          "sessionIds.$[].revoked": true,
        },
      });

      logger.info(
        `Password reset via verified OTP successfully for user: ${user.email} (App)`
      );

      return {
        message:
          "Password reset successfully. Please login with your new password.",
      };
    }
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

    // Hash the new password (same way as pre-save hook)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update only the password field using updateOne to avoid validating other fields like sessionIds
    await User.updateOne({ _id: userId }, { password: hashedPassword });

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
      { isRevoked: true, revokedAt: new Date() }
    );

    // Mark session as revoked in user's sessionIds
    await User.updateOne(
      { "sessionIds.sessionId": sessionId },
      {
        $set: {
          "sessionIds.$[elem].status": "Revoked",
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
      { isRevoked: true, revokedAt: new Date() }
    );

    // Mark all sessionIds as revoked on user
    await User.findByIdAndUpdate(userId, {
      $set: {
        "sessionIds.$[].status": "Revoked",
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
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        expiresAt: { $gt: new Date() },
        isRevoked: { $ne: true },
      });

      if (!session) {
        throw new AppError("Invalid or expired refresh token", 401);
      }

      // Check if user exists and is active
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError("User not found or inactive", 401);
      }

      // Revoke the current session atomically to prevent token reuse
      const revokedSession = await AuthSessions.findOneAndUpdate(
        {
          _id: session._id,
          isRevoked: { $ne: true },
        },
        {
          isRevoked: true,
          revokedAt: new Date(),
          lastUsedAt: new Date(),
        },
        { new: true }
      );

      if (!revokedSession) {
        throw new AppError("Invalid or expired refresh token", 401);
      }

      // Mark the corresponding embedded session info as revoked
      await User.updateOne(
        { _id: user._id, "sessionIds.sessionId": session.sessionId },
        {
          $set: {
            "sessionIds.$.status": "Revoked",
            "sessionIds.$.revoked": true,
          },
        }
      );

      // Create a brand new session (token rotation)
      const newSessionId = crypto.randomUUID();
      const deviceInfo = session.deviceInfo || "Web";

      await AuthSessions.create({
        userId: user._id,
        sessionId: newSessionId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        deviceInfo,
        lastUsedAt: new Date(),
        isRevoked: false,
      });

      await User.findByIdAndUpdate(user._id, {
        $push: {
          sessionIds: {
            sessionId: newSessionId,
            status: SessionStatus.ACTIVE,
            revoked: false,
            deviceInfo,
          },
        },
      });

      // Generate tokens tied to the new session
      const tokens = this.generateTokens(user._id.toString(), newSessionId);

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

  /**
   * Google OAuth Login
   * Verifies Google ID token (Firebase or Google OAuth) and creates/updates user
   */
  async googleLogin(data: GoogleLoginData): Promise<LoginResult> {
    const { idToken, deviceInfo } = data;

    try {
      // Validate token format before verification
      if (
        !idToken ||
        typeof idToken !== "string" ||
        idToken.trim().length === 0
      ) {
        throw new AppError("Invalid Google ID token format", 400);
      }

      // Basic JWT format validation (should have 3 parts separated by dots)
      const tokenParts = idToken.split(".");
      if (tokenParts.length !== 3) {
        throw new AppError("Invalid Google ID token format", 400);
      }

      // Decode JWT header to check issuer (without verification)
      let decodedHeader: any;
      try {
        decodedHeader = JSON.parse(
          Buffer.from(tokenParts[0], "base64").toString("utf-8")
        );
      } catch (e) {
        throw new AppError("Invalid Google ID token format", 400);
      }

      // Decode JWT payload to check issuer (without verification)
      let decodedPayload: any;
      try {
        decodedPayload = JSON.parse(
          Buffer.from(tokenParts[1], "base64").toString("utf-8")
        );
      } catch (e) {
        throw new AppError("Invalid Google ID token format", 400);
      }

      // Check if token is from Firebase (Firebase ID token)
      const isFirebaseToken =
        decodedPayload.iss?.includes("securetoken.google.com") ||
        decodedPayload.aud === "viteezy-mobile";

      let email: string | undefined;
      let name: string | undefined;
      let picture: string | undefined;
      let googleId: string | undefined;

      if (isFirebaseToken) {
        // Verify Firebase ID token
        const decodedToken = await firebaseService.verifyFirebaseIdToken(
          idToken
        );

        // Check if the token is from Google provider
        if (decodedToken.firebase.sign_in_provider !== "google.com") {
          throw new AppError("Invalid token provider. Expected Google.", 400);
        }

        // Extract user info from Firebase token
        const userInfo = firebaseService.getUserInfoFromToken(decodedToken);
        email = userInfo.email;
        name = userInfo.name;
        googleId = userInfo.uid;

        // Try to get picture from Firebase token or decoded payload
        picture =
          decodedToken.picture ||
          decodedPayload.picture ||
          (decodedToken.firebase as any)?.picture ||
          null;
      } else {
        // Verify the Google OAuth ID token
        const ticket = await this.googleOAuthClient.verifyIdToken({
          idToken,
          audience: config.google.clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          throw new AppError("Invalid Google ID token format", 400);
        }

        ({ sub: googleId, email, name, picture } = payload);
      }

      if (!email) {
        throw new AppError("Email not provided by Google", 400);
      }

      // Split full name into firstName and lastName
      const fullName = name || email.split("@")[0];
      const { firstName, lastName } = splitFullName(fullName);

      // Check if user exists with this email
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        // Create new user for Google login (Register) - same pattern as Apple login
        const memberId = await generateMemberId();
        const referralCode = await referralService.generateReferralCode(firstName);
        user = await User.create({
          firstName,
          lastName,
          email: email.toLowerCase(),
          password: crypto.randomBytes(32).toString("hex"), // Random password since Google handles auth
          isEmailVerified: true, // Google emails are verified
          avatar: picture || null,
          memberId,
          referralCode,
        });

        logger.info(`New user registered via Google login: ${user.email}`);

        // Send welcome email asynchronously
        // this.sendWelcomeEmailAsync(email, firstName, lastName);
      } else {
        // User exists, login - same pattern as Apple login
        // Check if user is active
        if (!user.isActive) {
          throw new AppError(
            "Account is deactivated. Please contact support.",
            403
          );
        }

        // Mark email as verified if not already
        if (!user.isEmailVerified) {
          user.isEmailVerified = true;
        }

        // Update avatar if provided and user doesn't have one
        if (picture && !user.avatar) {
          user.avatar = picture;
        }

        // Update name if it was changed or empty
        const currentFullName = `${user.firstName} ${user.lastName}`.trim();
        if (
          !currentFullName ||
          currentFullName === "Google User" ||
          currentFullName === "User" ||
          (name && currentFullName !== fullName.trim())
        ) {
          user.firstName = firstName;
          user.lastName = lastName;
        }
        await user.save();

        logger.info(`Existing user logged in via Google: ${user.email}`);
      }

      // Generate session and tokens (following existing login flow)
      const sessionId = crypto.randomUUID();
      const deviceInfoString = deviceInfo || "Web";

      await AuthSessions.create({
        userId: user._id,
        sessionId: sessionId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        deviceInfo: deviceInfoString,
        lastUsedAt: new Date(),
        isRevoked: false,
      });

      const tokens = this.generateTokens(user._id.toString(), sessionId);

      // Update last login and track session - same pattern as Apple login
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          lastLogin: new Date(),
          $push: {
            sessionIds: {
              sessionId: sessionId,
              status: SessionStatus.ACTIVE,
              revoked: false,
              deviceInfo: deviceInfoString,
            },
          },
        },
        { new: true }
      ).select("-password");

      // Return same response format for both login and register - same as Apple login
      return {
        user: {
          _id: updatedUser!._id,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          email: updatedUser!.email,
          phone: updatedUser!.phone || null,
          isEmailVerified: updatedUser!.isEmailVerified,
          lastLogin: updatedUser!.lastLogin,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        message: "Login successful", // Same message as Apple login
      };
    } catch (error: any) {
      logger.error("Google OAuth error:", error);

      // Handle specific Google OAuth errors
      if (error instanceof AppError) {
        throw error;
      }

      // Handle "No pem found" error - this happens when token is invalid/expired/wrong
      if (
        error.message?.includes("No pem found") ||
        error.message?.includes("No pem found for envelope")
      ) {
        throw new AppError("Please enter valid token", 400);
      }

      // Handle Google Auth Library errors - check for invalid token format
      if (
        error.code === "auth/argument-error" ||
        error.message?.includes("Invalid token") ||
        error.message?.includes("malformed") ||
        error.message?.includes("Invalid idToken") ||
        error.message?.includes("Token used too early") ||
        error.message?.includes("Token used too late")
      ) {
        throw new AppError("Please enter valid token", 400);
      }

      // Handle expired token
      if (
        error.code === "auth/id-token-expired" ||
        error.message?.includes("expired") ||
        error.message?.includes("Token expired")
      ) {
        throw new AppError("Please enter valid token", 400);
      }

      // Handle any other Google OAuth verification errors
      if (
        error.message?.includes("verifyIdToken") ||
        error.message?.includes("JWT") ||
        error.message?.includes("signature") ||
        error.message?.includes("audience") ||
        error.message?.includes("issuer")
      ) {
        throw new AppError("Please enter valid token", 400);
      }

      // Generic fallback for any other Google authentication errors
      throw new AppError("Please enter valid token", 400);
    }
  }
  /**
   * Register Family Member
   * Registers a sub-member/family member under a parent/main member
   * Email is optional for family members
   */
  async registerFamilyMember(
    data: RegisterFamilyMemberData
  ): Promise<{ user: any; message: string }> {
    const {
      parentMemberId,
      firstName,
      lastName,
      email,
      password,
      phone,
      countryCode,
      gender,
      age,
      relationshipToParent,
    } = data;

    // Verify parent member exists
    const parentMember = await User.findById(parentMemberId);
    if (!parentMember) {
      throw new AppError("Parent member not found", 404);
    }

    // Check if parent member is active
    if (!parentMember.isActive) {
      throw new AppError("Parent member account is not active", 400);
    }

    // If email is provided, check if it's already in use
    if (email && email.trim()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError("Email already in use by another user", 400);
      }
    }

    // Generate unique member ID for family member
    const memberId = await generateMemberId();

    // Generate unique referral code for family member
    const referralCode = await referralService.generateReferralCode(firstName);

    // Create family member user
    // For sub-members, email is optional, so we handle it accordingly
    const familyMemberData: any = {
      firstName,
      lastName,
      password, // Will be hashed by pre-save hook
      phone,
      countryCode,
      gender,
      age,
      memberId,
      referralCode,
      isSubMember: true,
      parentMemberId: parentMember._id,
      relationshipToParent,
      isEmailVerified: false, // Family members start as unverified
      isActive: true,
    };

    // Only add email if provided
    if (email && email.trim()) {
      familyMemberData.email = email.toLowerCase();
    }

    const familyMember = await User.create(familyMemberData);

    logger.info(
      `Family member created successfully: ${familyMember._id} under parent: ${parentMemberId}`
    );

    // If email is provided, send OTP for verification
    if (email && email.trim()) {
      try {
        await this.sendOTPForVerification(
          familyMember._id.toString(),
          email,
          OTPType.EMAIL_VERIFICATION
        );
      } catch (error) {
        logger.error("Failed to send OTP to family member:", error);
        // Don't fail registration if OTP sending fails
      }
    }

    // Use registeredAt if set, otherwise fallback to createdAt
    const registrationDate =
      familyMember.registeredAt || familyMember.createdAt;

    return {
      user: {
        _id: familyMember._id,
        firstName: familyMember.firstName,
        lastName: familyMember.lastName,
        email: familyMember.email || null,
        phone: familyMember.phone,
        countryCode: familyMember.countryCode,
        gender: familyMember.gender,
        age: familyMember.age,
        memberId: familyMember.memberId,
        isSubMember: familyMember.isSubMember,
        parentMemberId: familyMember.parentMemberId,
        relationshipToParent: familyMember.relationshipToParent,
        isEmailVerified: familyMember.isEmailVerified,
        registeredAt: registrationDate,
      },
      message: email
        ? "Family member registered successfully. Please verify email with the OTP sent."
        : "Family member registered successfully.",
    };
  }

  /**
   * Get Family Members
   * Retrieves all family members (sub-members) for a parent member
   */
  async getFamilyMembers(parentMemberId: string): Promise<{
    familyMembers: any[];
    message: string;
  }> {
    // Verify parent member exists
    const parentMember = await User.findById(parentMemberId);
    if (!parentMember) {
      throw new AppError("Parent member not found", 404);
    }

    // Get all family members for this parent
    const familyMembers = await User.find({
      parentMemberId: parentMemberId,
      isSubMember: true,
    })
      .select(
        "-password -passwordResetToken -passwordResetTokenExpires -sessionIds"
      )
      .lean();

    return {
      familyMembers: familyMembers.map((member) => ({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email || null,
        phone: member.phone,
        countryCode: member.countryCode,
        gender: member.gender,
        age: member.age,
        memberId: member.memberId,
        isSubMember: member.isSubMember,
        relationshipToParent: member.relationshipToParent,
        isEmailVerified: member.isEmailVerified,
        isActive: member.isActive,
        registeredAt: member.registeredAt || member.createdAt,
        createdAt: member.createdAt,
      })),
      message: "Family members retrieved successfully",
    };
  }
}

export const authService = new AuthService();
