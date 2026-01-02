import sgMail from "@sendgrid/mail";
import { logger } from "../utils/logger";
import { AddressSnapshotType } from "@/models/common.model";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface OrderConfirmationItem {
  name: string;
  quantity: number;
  unitAmount: number;
  currency: string;
}

interface OrderConfirmationEmailOptions {
  to: string;
  userName?: string;
  orderNumber: string;
  orderDate?: Date;
  paymentMethod?: string;
  subtotal: { amount: number; currency: string };
  tax?: { amount: number; currency: string };
  shipping?: { amount: number; currency: string };
  discount?: { amount: number; currency: string };
  total: { amount: number; currency: string };
  items: OrderConfirmationItem[];
  shippingAddress?: AddressSnapshotType;
}

class EmailService {
  private isConfigured: boolean;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    // Check if SendGrid API key is available
    const apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@viteezy.com";
    this.fromName = process.env.SENDGRID_FROM_NAME || "Viteezy";

    // Warn about Gmail addresses causing DMARC issues
    if (
      this.fromEmail.includes("@gmail.com") ||
      this.fromEmail.includes("@yahoo.com")
    ) {
      logger.warn(
        "⚠️  WARNING: Using free email provider (@gmail.com/@yahoo.com) may cause DMARC failures and spam classification.",
        {
          fromEmail: this.fromEmail,
          recommendation:
            "Use a verified custom domain email (e.g., noreply@yourdomain.com) for better deliverability",
          sendGridGuide:
            "Verify sender at: https://app.sendgrid.com/settings/sender_auth/senders/new",
        }
      );
    }

    if (
      apiKey &&
      apiKey !== "your_sendgrid_api_key_here" &&
      apiKey.trim().length > 0
    ) {
      // Validate API key format (SendGrid API keys start with "SG.")
      if (!apiKey.startsWith("SG.")) {
        logger.warn(
          "SendGrid API key format appears invalid. API keys should start with 'SG.'. Using mock email service."
        );
        this.isConfigured = false;
      } else {
        try {
          sgMail.setApiKey(apiKey);
          this.isConfigured = true;
          logger.info("SendGrid email service configured successfully", {
            fromEmail: this.fromEmail,
            fromName: this.fromName,
          });
        } catch (error) {
          logger.error("Failed to configure SendGrid:", error);
          this.isConfigured = false;
        }
      }
    } else {
      this.isConfigured = false;
      logger.warn(
        "SendGrid API key not found or not set. Using mock email service for development."
      );
    }
  }

  /**
   * Send OTP email
   */
  async sendOTPEmail(
    email: string,
    otp: string,
    type: string
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log the OTP
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] OTP for ${email}: ${otp} (Type: ${type})`);
        return true;
      }

      const subject = this.getOTPSubject(type);
      const html = this.getOTPEmailTemplate(otp, type);
      const text = this.getOTPTextTemplate(otp, type);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(`OTP email sent successfully to ${email} via SendGrid`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send OTP email via SendGrid:", {
        email,
        type,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });

      // In case of error, log OTP for development/debugging
      logger.info(`[FALLBACK] OTP for ${email}: ${otp} (Type: ${type})`);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Welcome email for ${email}: Welcome ${name}!`);
        return true;
      }

      const subject = "Welcome to Viteezy!";
      const html = this.getWelcomeEmailTemplate(name);
      const text = `Welcome ${name}! Thank you for joining Viteezy.`;

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(`Welcome email sent successfully to ${email} via SendGrid`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send welcome email via SendGrid:", {
        email,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send password reset email (OTP-based - kept for backward compatibility)
   */
  async sendPasswordResetEmail(email: string, otp: string): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Password reset OTP for ${email}: ${otp}`);
        return true;
      }

      const subject = "Password Reset - Viteezy";
      const html = this.getPasswordResetEmailTemplate(otp);
      const text = `Your password reset OTP is: ${otp}. This OTP is valid for 10 minutes.`;

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `Password reset email sent successfully to ${email} via SendGrid`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send password reset email via SendGrid:", {
        email,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send password reset link email
   * @param email - User's email address
   * @param name - User's name
   * @param resetUrl - Password reset URL with token
   */
  async sendPasswordResetLinkEmail(
    email: string,
    name: string,
    resetUrl: string
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Password reset link for ${email}: ${resetUrl}`);
        return true;
      }

      const subject = "Reset Your Password - Viteezy";
      const html = this.getPasswordResetLinkEmailTemplate(name, resetUrl);
      const text = `Hello ${name},\n\nPlease click the following link to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this password reset, please ignore this email.\n\nBest regards,\nThe Viteezy Team`;

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `Password reset link sent successfully to ${email} via SendGrid`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send password reset link via SendGrid:", {
        email,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      // In development, log the reset URL
      if (!this.isConfigured) {
        logger.info(`[FALLBACK] Password reset link for ${email}: ${resetUrl}`);
      }
      return false;
    }
  }

  /**
   * Send admin notification email
   */
  async sendAdminNotification(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Admin notification to ${to}: ${subject}`);
        return true;
      }

      await this.sendEmail({
        to,
        subject,
        html,
        text,
      });

      logger.info(`Admin notification sent successfully to ${to} via SendGrid`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send admin notification via SendGrid:", {
        to,
        subject,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send user account status change email
   * @param email - User's email address
   * @param name - User's name
   * @param isActive - Whether account is activated (true) or deactivated (false)
   */
  async sendUserStatusChangeEmail(
    email: string,
    name: string,
    isActive: boolean
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(
          `[DEV MODE] User status change email for ${email}: Account ${
            isActive ? "activated" : "deactivated"
          }`
        );
        return true;
      }

      const subject = isActive
        ? "Your Account Has Been Activated - Viteezy"
        : "Your Account Has Been Deactivated - Viteezy";

      const html = this.getUserStatusChangeEmailTemplate(name, isActive);
      const text = this.getUserStatusChangeEmailText(name, isActive);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `User status change email sent successfully to ${email} via SendGrid`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send user status change email via SendGrid:", {
        email,
        isActive,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(
    options: OrderConfirmationEmailOptions
  ): Promise<boolean> {
    console.log(
      "📧 [EMAIL SERVICE] ========== Sending Order Confirmation =========="
    );
    console.log("📧 [EMAIL SERVICE] To:", options.to);
    console.log("📧 [EMAIL SERVICE] Order Number:", options.orderNumber);
    console.log("📧 [EMAIL SERVICE] User Name:", options.userName);

    try {
      if (!this.isConfigured) {
        console.log(
          "ℹ️ [EMAIL SERVICE] - DEV MODE: Email not configured, logging only"
        );
        logger.info(
          `[DEV MODE] Order confirmation email for ${options.to}: Order ${options.orderNumber}`
        );
        return true;
      }

      console.log("📧 [EMAIL SERVICE] Step 1: Preparing email content");
      const subject = `Your Viteezy order ${options.orderNumber} is confirmed`;
      const html = this.getOrderConfirmationTemplate(options);
      const text = this.getOrderConfirmationText(options);

      console.log("📧 [EMAIL SERVICE] - Subject:", subject);
      console.log("📧 [EMAIL SERVICE] - HTML length:", html.length);
      console.log("📧 [EMAIL SERVICE] - Text length:", text.length);

      console.log("📧 [EMAIL SERVICE] Step 2: Sending email via SendGrid");
      await this.sendEmail({
        to: options.to,
        subject,
        html,
        text,
      });

      console.log("✅ [EMAIL SERVICE] - Email sent successfully");
      console.log(
        "✅ [EMAIL SERVICE] ============================================"
      );

      logger.info(
        `Order confirmation email sent to ${options.to} for order ${options.orderNumber}`
      );
      return true;
    } catch (error: any) {
      console.error("❌ [EMAIL SERVICE] ========== ERROR ==========");
      console.error("❌ [EMAIL SERVICE] Failed to send email");
      console.error("❌ [EMAIL SERVICE] Error:", error?.message);
      console.error("❌ [EMAIL SERVICE] Code:", error?.code);
      console.error("❌ [EMAIL SERVICE] ===========================");

      logger.error("Failed to send order confirmation email:", {
        to: options.to,
        orderNumber: options.orderNumber,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send custom HTML email (public method)
   */
  async sendCustomEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<boolean> {
    try {
      await this.sendEmail({ to, subject, html, text });
      return true;
    } catch (error) {
      logger.error("Failed to send custom email:", error);
      return false;
    }
  }

  /**
   * Generic email sending method using SendGrid
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Warn if using Gmail address (DMARC issues)
      // Even verified Gmail addresses can have DMARC alignment issues
      if (this.fromEmail.includes("@gmail.com")) {
        logger.warn(
          "⚠️  Gmail addresses may still go to spam due to DMARC alignment issues, even when verified.",
          {
            fromEmail: this.fromEmail,
            recommendation:
              "For production, use a custom domain email (e.g., noreply@yourdomain.com) with domain authentication",
            note: "Sender is verified but Gmail's DMARC policy restricts third-party sending",
          }
        );
      }

      const msg: any = {
        to: options.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        replyTo: this.fromEmail, // Add reply-to header
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
        html: options.html,
        // Add custom headers to improve deliverability and prevent spam
        headers: {
          "X-Entity-Ref-ID": `viteezy-${Date.now()}`, // Unique identifier
          "X-Mailer": "Viteezy Email Service",
          "X-Priority": "1", // Normal priority
          "X-MSMail-Priority": "Normal",
          Importance: "normal",
          "List-Unsubscribe": `<mailto:${this.fromEmail}?subject=unsubscribe>`, // Unsubscribe header
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          Precedence: "bulk", // Mark as transactional
          "Auto-Submitted": "auto-generated", // Indicate automated email
        },
        // Add categories for better tracking and deliverability
        categories: ["viteezy", "transactional", "verification"],
        // Set mail settings for better deliverability
        mailSettings: {
          sandboxMode: {
            enable: process.env.NODE_ENV === "test", // Disable in production
          },
          // Enable footer to improve deliverability
          footer: {
            enable: false, // We have custom footer
          },
          // Bypass list management for transactional emails
          bypassListManagement: {
            enable: true, // Important: Bypass unsubscribe list for transactional emails
          },
        },
        // Add tracking settings
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: true,
          },
          openTracking: {
            enable: true,
          },
          subscriptionTracking: {
            enable: false, // Disable SendGrid's default unsubscribe footer
          },
        },
        // Add ASM (Advanced Suppression Management) for better deliverability
        asm: {
          groupId: parseInt(process.env.SENDGRID_UNSUBSCRIBE_GROUP_ID || "0"),
          groupsToDisplay: [],
        },
      };

      // Remove ASM if groupId is 0 (not configured)
      if (!msg.asm.groupId || msg.asm.groupId === 0) {
        delete msg.asm;
      }

      await sgMail.send(msg);
      logger.debug(`Email sent successfully to ${options.to}`);
    } catch (error: any) {
      // Log detailed error information
      const errorDetails = {
        message: error?.message,
        code: error?.code,
        response: error?.response?.body,
        statusCode: error?.response?.statusCode,
      };

      logger.error("SendGrid email sending failed:", {
        to: options.to,
        subject: options.subject,
        ...errorDetails,
      });

      // Provide more helpful error messages based on status code and error details
      let errorMessage = error?.message || "Unknown error";
      const errorBody = error?.response?.body;
      const firstError = errorBody?.errors?.[0];
      const errorText = firstError?.message || errorMessage;

      if (error?.response?.statusCode === 401) {
        // Check for specific error messages
        if (
          errorText?.toLowerCase().includes("maximum credits exceeded") ||
          errorText?.toLowerCase().includes("credits exceeded")
        ) {
          errorMessage =
            "SendGrid account has exceeded email credits/quota. Please upgrade your plan or wait for quota reset.";
          logger.error("SendGrid Credits Exceeded:", {
            hint: "Check your SendGrid account credits at https://app.sendgrid.com/settings/billing",
            message:
              "You may need to upgrade your SendGrid plan or wait for monthly quota reset",
          });
        } else {
          errorMessage =
            "SendGrid API key is invalid, expired, or revoked. Please check your SENDGRID_API_KEY in .env file.";
          logger.error("SendGrid Authentication Error:", {
            hint: "Verify your API key at https://app.sendgrid.com/settings/api_keys",
            apiKeyPrefix:
              process.env.SENDGRID_API_KEY?.substring(0, 5) + "..." ||
              "not set",
          });
        }
      } else if (error?.response?.statusCode === 403) {
        errorMessage =
          "SendGrid API key does not have permission to send emails. Please check your API key permissions.";
      } else if (error?.response?.statusCode === 400) {
        errorMessage = `SendGrid validation error: ${errorText}`;
      } else if (error?.response?.statusCode === 429) {
        errorMessage = "SendGrid rate limit exceeded. Please try again later.";
      }

      // Re-throw error so calling methods can handle it
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  }

  /**
   * Get OTP subject based on type
   */
  private getOTPSubject(type: string): string {
    switch (type) {
      case "email_verification":
      case "Email Verification":
        return "Verify Your Email - Viteezy";
      case "password_reset":
      case "Password Reset":
        return "Password Reset - Viteezy";
      case "login_verification":
      case "Login Verification":
        return "Login Verification - Viteezy";
      default:
        return "Verification Code - Viteezy";
    }
  }

  /**
   * Get OTP email HTML template
   */
  private getOTPEmailTemplate(otp: string, type: string): string {
    let title = "Verification Code";
    let message = "Please use this verification code to complete your request.";

    if (type === "email_verification" || type === "Email Verification") {
      title = "Verify Your Email";
      message =
        "Please verify your email address to complete your registration.";
    } else if (type === "password_reset" || type === "Password Reset") {
      title = "Password Reset";
      message =
        "You requested to reset your password. Please use the verification code below to reset your password.";
    } else if (type === "login_verification" || type === "Login Verification") {
      title = "Login Verification";
      message = "Please use this verification code to complete your login.";
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${title} - Viteezy</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header { 
            background: #4f46e5; 
            color: #ffffff; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header h2 {
            margin: 10px 0 0 0;
            font-size: 20px;
            font-weight: 400;
          }
          .content { 
            background: #ffffff; 
            padding: 40px 30px; 
          }
          .content p {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333333;
          }
          .otp-code { 
            background: #1f2937; 
            color: #ffffff; 
            font-size: 36px; 
            font-weight: bold; 
            text-align: center; 
            padding: 25px; 
            margin: 30px 0; 
            border-radius: 8px; 
            letter-spacing: 10px;
            font-family: 'Courier New', monospace;
          }
          .footer { 
            text-align: center; 
            padding: 20px 30px;
            background-color: #f9fafb;
            color: #6b7280; 
            font-size: 12px; 
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Viteezy</h1>
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${message}</p>
            <div class="otp-code">${otp}</div>
            <p><strong>This code will expire in 5 minutes.</strong></p>
            <p>If you didn't request this code, please ignore this email or contact our support team.</p>
            <p>Best regards,<br><strong>The Viteezy Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get OTP text template
   */
  private getOTPTextTemplate(otp: string, type: string): string {
    let message = "Please use this verification code to complete your request.";

    if (type === "email_verification" || type === "Email Verification") {
      message =
        "Please verify your email address to complete your registration.";
    } else if (type === "password_reset" || type === "Password Reset") {
      message =
        "You requested to reset your password. Please use the verification code below to reset your password.";
    } else if (type === "login_verification" || type === "Login Verification") {
      message = "Please use this verification code to complete your login.";
    }

    return `
Viteezy - Verification Code

${message}

Your verification code is: ${otp}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

Best regards,
The Viteezy Team
    `;
  }

  /**
   * Get welcome email HTML template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Welcome to Viteezy</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header { 
            background: #4f46e5; 
            color: #ffffff; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content { 
            background: #ffffff; 
            padding: 40px 30px; 
          }
          .content p {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333333;
          }
          .footer { 
            text-align: center; 
            padding: 20px 30px;
            background-color: #f9fafb;
            color: #6b7280; 
            font-size: 12px; 
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <h1>Welcome to Viteezy!</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Welcome to Viteezy! We're excited to have you on board.</p>
            <p>Your account has been created successfully. Please verify your email address to get started.</p>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br><strong>The Viteezy Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get password reset email HTML template (OTP-based - kept for backward compatibility)
   */
  private getPasswordResetEmailTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Viteezy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .otp-code { 
            background: #1f2937; 
            color: #f9fafb; 
            font-size: 32px; 
            font-weight: bold; 
            text-align: center; 
            padding: 20px; 
            margin: 20px 0; 
            border-radius: 8px; 
            letter-spacing: 8px;
          }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Viteezy</h1>
            <h2>Password Reset</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password. Please use the verification code below:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>Best regards,<br>The Viteezy Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Viteezy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get password reset link email HTML template
   */
  private getPasswordResetLinkEmailTemplate(
    name: string,
    resetUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Viteezy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { 
            display: inline-block; 
            background: #dc2626; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0;
            text-align: center;
          }
          .button:hover { background: #b91c1c; }
          .link-fallback { 
            color: #6b7280; 
            font-size: 12px; 
            word-break: break-all; 
            margin-top: 10px;
          }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Viteezy</h1>
            <h2>Reset Your Password</h2>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>You requested to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p class="link-fallback">If the button doesn't work, copy and paste this link into your browser:<br>${resetUrl}</p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
            <p>Best regards,<br>The Viteezy Team</p>
          </div>
          <div class="footer">
            <p>© 2024 Viteezy. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  private getOrderConfirmationTemplate(
    options: OrderConfirmationEmailOptions
  ): string {
    const {
      userName,
      orderNumber,
      orderDate,
      paymentMethod,
      subtotal,
      tax,
      shipping,
      discount,
      total,
      items,
      shippingAddress,
    } = options;

    const orderDateDisplay = orderDate
      ? orderDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US");

    const itemsRows = items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">${this.formatCurrency(
              item.unitAmount * item.quantity,
              item.currency
            )}</td>
          </tr>`
      )
      .join("");

    const shippingBlock = this.formatAddress(shippingAddress);

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Order Confirmation</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f5f5f7; margin: 0; padding: 0; color: #111827; }
            .wrapper { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
            .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08); }
            .title { margin: 0 0 8px; font-size: 24px; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
            th { text-align: left; font-size: 12px; letter-spacing: 0.05em; color: #6b7280; text-transform: uppercase; }
            .totals td { border-bottom: none; }
            .grand-total { font-size: 18px; font-weight: 600; }
            .summary { margin-top: 24px; }
            .summary p { margin: 4px 0; color: #4b5563; }
            .footer { text-align: center; margin-top: 32px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="card">
              <p>Hello ${userName || "there"},</p>
              <h1 class="title">Thank you for your order!</h1>
              <p>Your order <strong>${orderNumber}</strong> has been confirmed on ${orderDateDisplay}.</p>

              <table>
                <thead>
                  <tr>
                    <th style="text-align:left;">Item</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>

              <table class="totals">
                <tbody>
                  <tr>
                    <td>Subtotal</td>
                    <td style="text-align:right;">${this.formatCurrency(
                      subtotal.amount,
                      subtotal.currency
                    )}</td>
                  </tr>
                  ${
                    tax && tax.amount
                      ? `<tr>
                          <td>Tax</td>
                          <td style="text-align:right;">${this.formatCurrency(
                            tax.amount,
                            tax.currency
                          )}</td>
                        </tr>`
                      : ""
                  }
                  ${
                    shipping && shipping.amount
                      ? `<tr>
                          <td>Shipping</td>
                          <td style="text-align:right;">${this.formatCurrency(
                            shipping.amount,
                            shipping.currency
                          )}</td>
                        </tr>`
                      : ""
                  }
                  ${
                    discount && discount.amount
                      ? `<tr>
                          <td>Discount</td>
                          <td style="text-align:right; color:#059669;">-${this.formatCurrency(
                            discount.amount,
                            discount.currency
                          )}</td>
                        </tr>`
                      : ""
                  }
                  <tr class="grand-total">
                    <td>Total</td>
                    <td style="text-align:right;">${this.formatCurrency(
                      total.amount,
                      total.currency
                    )}</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary">
                <p><strong>Payment Method:</strong> ${
                  paymentMethod || "Online payment"
                }</p>
                ${
                  shippingBlock
                    ? `<p><strong>Shipping Address:</strong><br/>${shippingBlock}</p>`
                    : ""
                }
              </div>

              <p style="margin-top:24px;">We’ll send another email once your order ships. If you have any questions, simply reply to this email.</p>
              <p style="margin-bottom:0;">— The Viteezy Team</p>
            </div>
            <p class="footer">© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;
  }

  private getOrderConfirmationText(
    options: OrderConfirmationEmailOptions
  ): string {
    const lines = [
      `Hi ${options.userName || "there"},`,
      "",
      `Thanks for your order ${options.orderNumber}. It has been confirmed.`,
      "",
      "Order summary:",
    ];

    options.items.forEach((item) => {
      lines.push(
        `- ${item.quantity} x ${item.name} = ${this.formatCurrency(
          item.unitAmount * item.quantity,
          item.currency
        )}`
      );
    });

    lines.push("");
    lines.push(
      `Subtotal: ${this.formatCurrency(
        options.subtotal.amount,
        options.subtotal.currency
      )}`
    );
    if (options.tax?.amount) {
      lines.push(
        `Tax: ${this.formatCurrency(options.tax.amount, options.tax.currency)}`
      );
    }
    if (options.shipping?.amount) {
      lines.push(
        `Shipping: ${this.formatCurrency(
          options.shipping.amount,
          options.shipping.currency
        )}`
      );
    }
    if (options.discount?.amount) {
      lines.push(
        `Discount: -${this.formatCurrency(
          options.discount.amount,
          options.discount.currency
        )}`
      );
    }
    lines.push(
      `Total: ${this.formatCurrency(
        options.total.amount,
        options.total.currency
      )}`
    );
    lines.push("");
    if (options.paymentMethod) {
      lines.push(`Paid via: ${options.paymentMethod}`);
    }
    if (options.shippingAddress) {
      lines.push("");
      lines.push("Shipping address:");
      lines.push(this.formatAddress(options.shippingAddress));
    }
    lines.push("");
    lines.push("We’ll email again when your order ships.");
    lines.push("");
    lines.push("The Viteezy Team");

    return lines.filter(Boolean).join("\n");
  }

  private formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "EUR",
      }).format(amount);
    } catch (_error) {
      return `${amount.toFixed(2)} ${currency || "EUR"}`;
    }
  }

  private formatAddress(address?: AddressSnapshotType): string {
    if (!address) {
      return "";
    }

    const parts = [
      address.name,
      address.line1,
      address.line2,
      [address.zip, address.city].filter(Boolean).join(" "),
      address.country,
    ]
      .filter(Boolean)
      .join("<br/>");

    return parts;
  }

  /**
   * Get user status change email HTML template
   */
  private getUserStatusChangeEmailTemplate(
    name: string,
    isActive: boolean
  ): string {
    const title = isActive
      ? "Your Account Has Been Activated"
      : "Your Account Has Been Deactivated";
    const headerColor = isActive ? "#059669" : "#dc2626";
    const icon = isActive ? "✅" : "⚠️";
    const message = isActive
      ? "Great news! Your account has been activated by our admin team. You can now log in and access all features of Viteezy."
      : "Your account has been deactivated by our admin team. You will not be able to log in until your account is reactivated.";
    const actionMessage = isActive
      ? "You can now log in to your account and start using all our services."
      : "If you believe this is a mistake or have any questions, please contact our support team immediately.";

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${title} - Viteezy</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
          }
          .header { 
            background: ${headerColor}; 
            color: #ffffff; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header .icon {
            font-size: 48px;
            margin-bottom: 10px;
          }
          .content { 
            background: #ffffff; 
            padding: 40px 30px; 
          }
          .content p {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333333;
          }
          .status-box {
            background: ${isActive ? "#d1fae5" : "#fee2e2"};
            border-left: 4px solid ${headerColor};
            padding: 20px;
            margin: 30px 0;
            border-radius: 8px;
          }
          .status-box p {
            margin: 0;
            color: ${isActive ? "#065f46" : "#991b1b"};
            font-weight: 500;
          }
          .footer { 
            text-align: center; 
            padding: 20px 30px;
            background-color: #f9fafb;
            color: #6b7280; 
            font-size: 12px; 
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            margin: 5px 0;
          }
          .support-link {
            color: #4f46e5;
            text-decoration: none;
          }
          .support-link:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="icon">${icon}</div>
            <h1>${title}</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>${message}</p>
            <div class="status-box">
              <p><strong>Account Status:</strong> ${
                isActive ? "Active" : "Deactivated"
              }</p>
            </div>
            <p>${actionMessage}</p>
            ${
              !isActive
                ? '<p>If you need assistance, please contact our support team at <a href="mailto:support@viteezy.com" class="support-link">support@viteezy.com</a>.</p>'
                : ""
            }
            <p>Best regards,<br><strong>The Viteezy Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get user status change email text template
   */
  private getUserStatusChangeEmailText(
    name: string,
    isActive: boolean
  ): string {
    const title = isActive
      ? "Your Account Has Been Activated"
      : "Your Account Has Been Deactivated";
    const message = isActive
      ? "Great news! Your account has been activated by our admin team. You can now log in and access all features of Viteezy."
      : "Your account has been deactivated by our admin team. You will not be able to log in until your account is reactivated.";
    const actionMessage = isActive
      ? "You can now log in to your account and start using all our services."
      : "If you believe this is a mistake or have any questions, please contact our support team immediately at support@viteezy.com.";

    return `
Viteezy - ${title}

Hello ${name},

${message}

Account Status: ${isActive ? "Active" : "Deactivated"}

${actionMessage}

Best regards,
The Viteezy Team

---
© ${new Date().getFullYear()} Viteezy. All rights reserved.
This is an automated message, please do not reply to this email.
    `;
  }
}

export const emailService = new EmailService();
