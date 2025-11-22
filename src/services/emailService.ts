import sgMail from "@sendgrid/mail";
import { logger } from "../utils/logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
   * Send password reset email
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
        return "Verify Your Email - Viteezy";
      case "password_reset":
        return "Password Reset - Viteezy";
      case "login_verification":
        return "Login Verification - Viteezy";
      default:
        return "Verification Code - Viteezy";
    }
  }

  /**
   * Get OTP email HTML template
   */
  private getOTPEmailTemplate(otp: string, type: string): string {
    const title =
      type === "email_verification" ? "Verify Your Email" : "Verification Code";
    const message =
      type === "email_verification"
        ? "Please verify your email address to complete your registration."
        : "Please use this verification code to complete your request.";

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
    const message =
      type === "email_verification"
        ? "Please verify your email address to complete your registration."
        : "Please use this verification code to complete your request.";

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
   * Get password reset email HTML template
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
}

export const emailService = new EmailService();
