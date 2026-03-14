import axios from "axios";
import { logger } from "../utils/logger";
import { AddressSnapshotType } from "@/models/common.model";
import * as fs from "fs";
import * as path from "path";

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
    // Check if Brevo API key is available
    const apiKey = process.env.BREVO_API_KEY;
    this.fromEmail = process.env.BREVO_FROM_EMAIL || "noreply@viteezy.com";
    this.fromName = process.env.BREVO_FROM_NAME || "Viteezy";

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
          brevoGuide:
            "Verify sender at: https://app.brevo.com/settings/senders",
        }
      );
    }

    if (
      apiKey &&
      apiKey !== "your_brevo_api_key_here" &&
      apiKey.trim().length > 0
    ) {
      // Validate API key format (Brevo API keys start with "xkeysib-")
      if (!apiKey.startsWith("xkeysib-")) {
        logger.warn(
          "Brevo API key format appears invalid. API keys should start with 'xkeysib-'. Using mock email service."
        );
        this.isConfigured = false;
      } else {
        try {
          this.isConfigured = true;
          logger.info("Brevo email service configured successfully", {
            fromEmail: this.fromEmail,
            fromName: this.fromName,
          });
        } catch (error) {
          logger.error("Failed to configure Brevo:", error);
          this.isConfigured = false;
        }
      }
    } else {
      this.isConfigured = false;
      logger.warn(
        "Brevo API key not found or not set. Using mock email service for development."
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

      logger.info(`OTP email sent successfully to ${email} via Brevo`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send OTP email via Brevo:", {
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

      logger.info(`Welcome email sent successfully to ${email} via Brevo`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send welcome email via Brevo:", {
        email,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send contact form confirmation to user (after "Ask us a question" submit)
   */
  async sendContactConfirmationEmail(
    email: string,
    name?: string,
    subject?: string
  ): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Contact confirmation for ${email}`);
        return true;
      }
      const displayName = name || "there";
      const emailSubject = "We received your message - Viteezy";
      const html = this.getContactConfirmationTemplate(displayName, subject);
      const text = `Hello ${displayName},\n\nThank you for contacting us. We have received your message${subject ? ` regarding "${subject}"` : ""} and will get back to you soon.\n\nBest regards,\nThe Viteezy Team`;

      await this.sendEmail({ to: email, subject: emailSubject, html, text });
      logger.info(`Contact confirmation sent to ${email} via Brevo`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send contact confirmation via Brevo:", {
        email,
        error: error?.message,
      });
      return false;
    }
  }

  /**
   * Send welcome / promotional email when user enters email in footer
   */
  async sendFooterWelcomeEmail(email: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Footer welcome email for ${email}`);
        return true;
      }
      const subject = "Welcome to Viteezy – Tips, offers & more";
      const html = this.getFooterWelcomeEmailTemplate();
      const text = `Welcome to Viteezy!\n\nThank you for signing up. You'll receive our latest news, wellness tips, and exclusive offers.\n\nBest regards,\nThe Viteezy Team`;

      await this.sendEmail({ to: email, subject, html, text });
      logger.info(`Footer welcome email sent to ${email} via Brevo`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send footer welcome email via Brevo:", {
        email,
        error: error?.message,
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
        `Password reset email sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send password reset email via Brevo:", {
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
        `Password reset link sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send password reset link via Brevo:", {
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

      logger.info(`Admin notification sent successfully to ${to} via Brevo`);
      return true;
    } catch (error: any) {
      logger.error("Failed to send admin notification via Brevo:", {
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
        `User status change email sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send user status change email via Brevo:", {
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

      console.log("📧 [EMAIL SERVICE] Step 2: Sending email via Brevo");
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
   * Generic email sending method using Brevo
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const apiKey = process.env.BREVO_API_KEY;
      if (!apiKey) {
        throw new Error("Brevo API key not configured");
      }

      // Warn if using Gmail address (DMARC issues)
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

      const emailData = {
        sender: {
          email: this.fromEmail,
          name: this.fromName,
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text || options.html.replace(/<[^>]*>/g, ""),
        headers: {
          "X-Entity-Ref-ID": `viteezy-${Date.now()}`,
          "X-Mailer": "Viteezy Email Service",
        },
        tags: ["viteezy", "transactional"],
      };

      const response = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        emailData,
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          timeout: 10000, // 10 seconds timeout
        }
      );

      logger.debug(`Email sent successfully to ${options.to}`, {
        messageId: response.data?.messageId,
      });
    } catch (error: any) {
      // Log detailed error information
      const errorDetails = {
        message: error?.message,
        code: error?.code,
        response: error?.response?.data,
        statusCode: error?.response?.status,
      };

      logger.error("Brevo email sending failed:", {
        to: options.to,
        subject: options.subject,
        ...errorDetails,
      });

      // Provide more helpful error messages based on status code and error details
      let errorMessage = error?.message || "Unknown error";
      const errorData = error?.response?.data;

      if (error?.response?.status === 401) {
        // Check for specific error messages
        if (
          errorData?.message?.toLowerCase().includes("credits") ||
          errorData?.message?.toLowerCase().includes("quota") ||
          errorData?.code === "unauthorized"
        ) {
          errorMessage =
            "Brevo account has exceeded email credits/quota. Please upgrade your plan or wait for quota reset.";
          logger.error("Brevo Credits Exceeded:", {
            hint: "Check your Brevo account credits at https://app.brevo.com/settings/billing",
            message:
              "You may need to upgrade your Brevo plan or wait for monthly quota reset",
          });
        } else {
          errorMessage =
            "Brevo API key is invalid, expired, or revoked. Please check your BREVO_API_KEY in .env file.";
          logger.error("Brevo Authentication Error:", {
            hint: "Verify your API key at https://app.brevo.com/settings/api-keys",
            apiKeyPrefix:
              process.env.BREVO_API_KEY?.substring(0, 10) + "..." ||
              "not set",
          });
        }
      } else if (error?.response?.status === 403) {
        errorMessage =
          "Brevo API key does not have permission to send emails. Please check your API key permissions.";
      } else if (error?.response?.status === 400) {
        errorMessage = `Brevo validation error: ${errorData?.message || errorMessage}`;
      } else if (error?.response?.status === 429) {
        errorMessage = "Brevo rate limit exceeded. Please try again later.";
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
   * Contact form confirmation template (Ask us a question)
   */
  private getContactConfirmationTemplate(name: string, subject?: string): string {
    const subjectLine = subject ? `<p><strong>Subject:</strong> ${subject}</p>` : "";
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>We received your message</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
          .header { background: #0d9488; color: #fff; padding: 24px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 600; }
          .content { padding: 32px 24px; }
          .content p { margin: 0 0 12px 0; font-size: 15px; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header"><h1>We received your message</h1></div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Thank you for getting in touch. We have received your message and will respond as soon as possible.</p>
            ${subjectLine}
            <p>Best regards,<br><strong>The Viteezy Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Footer welcome / promotional email template (newsletter signup)
   */
  private getFooterWelcomeEmailTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Viteezy</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 0; }
          .wrapper { max-width: 600px; margin: 0 auto; background: #fff; }
          .header { background: #0d9488; color: #fff; padding: 28px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 32px 24px; }
          .content p { margin: 0 0 14px 0; font-size: 15px; }
          .cta { margin: 24px 0; text-align: center; }
          .cta a { display: inline-block; background: #0d9488; color: #fff !important; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; }
          .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header"><h1>Welcome to Viteezy</h1></div>
          <div class="content">
            <p>Thank you for signing up! You're now part of the Viteezy community.</p>
            <p>We'll send you wellness tips, product updates, and exclusive offers. Stay tuned for our best content.</p>
            <p>If you have any questions, just reply to this email or visit our contact page.</p>
            <div class="cta"><a href="#">Explore our products</a></div>
            <p>Best regards,<br><strong>The Viteezy Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            <p>You received this email because you signed up at viteezy.com.</p>
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

  /**
   * Send subscription cancellation email
   * @param email - User's email address
   * @param name - User's name
   * @param data - Subscription cancellation data
   */
  async sendSubscriptionCancellationEmail(
    email: string,
    name: string,
    data: {
      subscriptionNumber: string;
      cancellationReason: string;
      cancelledAt: Date;
      cancelledImmediately: boolean;
    }
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(
          `[DEV MODE] Subscription cancellation email for ${email}: Subscription ${data.subscriptionNumber}`
        );
        return true;
      }

      const subject = "Your Subscription Has Been Cancelled - Viteezy";
      const html = this.getSubscriptionCancellationEmailTemplate(name, data);
      const text = this.getSubscriptionCancellationEmailText(name, data);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `Subscription cancellation email sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send subscription cancellation email via Brevo:", {
        email,
        subscriptionNumber: data.subscriptionNumber,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send subscription pause email
   * @param email - User's email address
   * @param name - User's name
   * @param data - Subscription pause data
   */
  async sendSubscriptionPauseEmail(
    email: string,
    name: string,
    data: {
      subscriptionNumber: string;
      pausedAt: Date;
    }
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(
          `[DEV MODE] Subscription pause email for ${email}: Subscription ${data.subscriptionNumber}`
        );
        return true;
      }

      const subject = "Your Subscription Has Been Paused - Viteezy";
      const html = this.getSubscriptionPauseEmailTemplate(name, data);
      const text = this.getSubscriptionPauseEmailText(name, data);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `Subscription pause email sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send subscription pause email via Brevo:", {
        email,
        subscriptionNumber: data.subscriptionNumber,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Send subscription payment failed email
   * @param email - User's email address
   * @param name - User's name
   * @param data - Payment failed data
   */
  async sendSubscriptionPaymentFailedEmail(
    email: string,
    name: string,
    data: {
      subscriptionNumber: string;
      amount: number;
      currency: string;
      retryCount: number;
      nextRetryDate: Date;
      failureReason?: string;
    }
  ): Promise<boolean> {
    try {
      // If not configured (development mode), just log
      if (!this.isConfigured) {
        logger.info(
          `[DEV MODE] Subscription payment failed email for ${email}: Subscription ${data.subscriptionNumber}`
        );
        return true;
      }

      const subject = "Payment Failed - Action Required - Viteezy";
      const html = this.getSubscriptionPaymentFailedEmailTemplate(name, data);
      const text = this.getSubscriptionPaymentFailedEmailText(name, data);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(
        `Subscription payment failed email sent successfully to ${email} via Brevo`
      );
      return true;
    } catch (error: any) {
      logger.error("Failed to send subscription payment failed email via Brevo:", {
        email,
        subscriptionNumber: data.subscriptionNumber,
        error: error?.message,
        code: error?.code,
        response: error?.response?.body,
      });
      return false;
    }
  }

  /**
   * Get subscription payment failed email HTML template
   */
  private getSubscriptionPaymentFailedEmailTemplate(
    name: string,
    data: {
      subscriptionNumber: string;
      amount: number;
      currency: string;
      retryCount: number;
      nextRetryDate: Date;
      failureReason?: string;
    }
  ): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const nextRetryDate = new Date(data.nextRetryDate).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed - Viteezy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #dc3545; margin-top: 0;">Payment Failed</h1>
          <p>Dear ${name},</p>
          <p>We were unable to process your subscription payment for <strong>${data.subscriptionNumber}</strong>.</p>
          
          <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0;"><strong>Amount:</strong> ${formattedAmount}</p>
            <p style="margin: 5px 0;"><strong>Retry Attempt:</strong> ${data.retryCount}</p>
            <p style="margin: 5px 0;"><strong>Next Retry:</strong> ${nextRetryDate}</p>
            ${data.failureReason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${data.failureReason}</p>` : ''}
          </div>

          <p><strong>What happens next?</strong></p>
          <ul>
            <li>We will automatically retry the payment on ${nextRetryDate}</li>
            <li>Please ensure your payment method has sufficient funds</li>
            <li>Update your payment method if needed</li>
          </ul>

          <p>If the payment continues to fail, your subscription may be cancelled.</p>

          <p style="margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'https://viteezy.com'}/subscriptions" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Update Payment Method
            </a>
          </p>

          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            If you have any questions, please contact our support team.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get subscription payment failed email text version
   */
  private getSubscriptionPaymentFailedEmailText(
    name: string,
    data: {
      subscriptionNumber: string;
      amount: number;
      currency: string;
      retryCount: number;
      nextRetryDate: Date;
      failureReason?: string;
    }
  ): string {
    const formattedAmount = `${data.currency} ${data.amount.toFixed(2)}`;
    const nextRetryDate = new Date(data.nextRetryDate).toLocaleDateString();

    return `
Payment Failed - Action Required

Dear ${name},

We were unable to process your subscription payment for ${data.subscriptionNumber}.

Amount: ${formattedAmount}
Retry Attempt: ${data.retryCount}
Next Retry: ${nextRetryDate}
${data.failureReason ? `Reason: ${data.failureReason}` : ''}

What happens next?
- We will automatically retry the payment on ${nextRetryDate}
- Please ensure your payment method has sufficient funds
- Update your payment method if needed

If the payment continues to fail, your subscription may be cancelled.

Update your payment method: ${process.env.FRONTEND_URL || 'https://viteezy.com'}/subscriptions

If you have any questions, please contact our support team.

Best regards,
Viteezy Team
    `;
  }

  /**
   * Get subscription cancellation email HTML template
   */
  private getSubscriptionCancellationEmailTemplate(
    name: string,
    data: {
      subscriptionNumber: string;
      cancellationReason: string;
      cancelledAt: Date;
      cancelledImmediately: boolean;
    }
  ): string {
    const cancelledDate = data.cancelledAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Subscription Cancelled - Viteezy</title>
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
            background: #dc2626; 
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
          .info-box {
            background: #f9fafb;
            border-left: 4px solid #dc2626;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box p {
            margin: 5px 0;
          }
          .info-label {
            font-weight: 600;
            color: #1f2937;
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
            <h1>Subscription Cancelled</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>We wanted to inform you that your subscription has been cancelled.</p>
            
            <div class="info-box">
              <p><span class="info-label">Subscription Number:</span> ${data.subscriptionNumber}</p>
              <p><span class="info-label">Cancellation Date:</span> ${cancelledDate}</p>
              <p><span class="info-label">Cancellation Type:</span> ${data.cancelledImmediately ? "Immediate Cancellation" : "Cancelled at End Date"}</p>
              <p><span class="info-label">Reason:</span> ${data.cancellationReason}</p>
            </div>

            <p>If you have any questions or concerns about this cancellation, please don't hesitate to contact our support team.</p>
            <p>We're sorry to see you go and hope to serve you again in the future.</p>
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
   * Get subscription cancellation email text template
   */
  private getSubscriptionCancellationEmailText(
    name: string,
    data: {
      subscriptionNumber: string;
      cancellationReason: string;
      cancelledAt: Date;
      cancelledImmediately: boolean;
    }
  ): string {
    const cancelledDate = data.cancelledAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
Viteezy - Subscription Cancelled

Hello ${name},

We wanted to inform you that your subscription has been cancelled.

Subscription Number: ${data.subscriptionNumber}
Cancellation Date: ${cancelledDate}
Cancellation Type: ${data.cancelledImmediately ? "Immediate Cancellation" : "Cancelled at End Date"}
Reason: ${data.cancellationReason}

If you have any questions or concerns about this cancellation, please don't hesitate to contact our support team.

We're sorry to see you go and hope to serve you again in the future.

Best regards,
The Viteezy Team

---
© ${new Date().getFullYear()} Viteezy. All rights reserved.
This is an automated message, please do not reply to this email.
    `;
  }

  /**
   * Get subscription pause email HTML template
   */
  private getSubscriptionPauseEmailTemplate(
    name: string,
    data: {
      subscriptionNumber: string;
      pausedAt: Date;
    }
  ): string {
    const pausedDate = data.pausedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Subscription Paused - Viteezy</title>
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
            background: #f59e0b; 
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
          .info-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .info-box p {
            margin: 5px 0;
          }
          .info-label {
            font-weight: 600;
            color: #1f2937;
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
            <h1>Subscription Paused</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>We wanted to inform you that your subscription has been paused.</p>
            
            <div class="info-box">
              <p><span class="info-label">Subscription Number:</span> ${data.subscriptionNumber}</p>
              <p><span class="info-label">Paused Date:</span> ${pausedDate}</p>
            </div>

            <p>Your subscription is currently on hold. No charges or deliveries will occur while your subscription is paused.</p>
            <p>If you have any questions or would like to resume your subscription, please contact our support team.</p>
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
   * Get subscription pause email text template
   */
  private getSubscriptionPauseEmailText(
    name: string,
    data: {
      subscriptionNumber: string;
      pausedAt: Date;
    }
  ): string {
    const pausedDate = data.pausedAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `
Viteezy - Subscription Paused

Hello ${name},

We wanted to inform you that your subscription has been paused.

Subscription Number: ${data.subscriptionNumber}
Paused Date: ${pausedDate}

Your subscription is currently on hold. No charges or deliveries will occur while your subscription is paused.

If you have any questions or would like to resume your subscription, please contact our support team.

Best regards,
The Viteezy Team

---
© ${new Date().getFullYear()} Viteezy. All rights reserved.
This is an automated message, please do not reply to this email.
    `;
  }

  /**
   * Send pharmacist request email with CSV attachments
   */
  async sendPharmacistRequestEmail(options: {
    to: string;
    subject: string;
    files: string[];
  }): Promise<void> {
    try {
      if (!this.isConfigured) {
        logger.warn(
          "Email service not configured. Skipping pharmacist request email."
        );
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9f9f9; }
            .message { margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Pharmacist Order CSV Files</h1>
            </div>
            <div class="content">
              <p>Dear Pharmacist,</p>
              <div class="message">
                <p>Please find attached ${options.files.length} CSV file(s) containing order information for processing.</p>
                <p>Files attached:</p>
                <ul>
                  ${options.files.map((file) => `<li>${path.basename(file)}</li>`).join("")}
                </ul>
              </div>
              <p>Thank you for your service.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const attachments = options.files.map((filePath) => {
        const fileName = path.basename(filePath);
        const fileContent = fs.readFileSync(filePath);
        return {
          content: fileContent.toString("base64"),
          name: fileName,
        };
      });

      const apiKey = process.env.BREVO_API_KEY;
      if (!apiKey) {
        throw new Error("Brevo API key not configured");
      }

      const emailData = {
        sender: {
          email: this.fromEmail,
          name: this.fromName,
        },
        to: [
          {
            email: options.to,
          },
        ],
        subject: options.subject,
        htmlContent: html,
        textContent: html.replace(/<[^>]*>/g, ""),
        attachment: attachments,
        headers: {
          "X-Entity-Ref-ID": `viteezy-pharmacist-${Date.now()}`,
          "X-Mailer": "Viteezy Email Service",
        },
        tags: ["viteezy", "pharmacist", "csv"],
      };

      const response = await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        emailData,
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          timeout: 10000,
        }
      );

      logger.info(`Pharmacist request email sent successfully to ${options.to} with ${options.files.length} attachment(s)`, {
        messageId: response.data?.messageId,
      });
    } catch (error: any) {
      logger.error(`Failed to send pharmacist request email: ${error.message}`, {
        to: options.to,
        files: options.files,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Send delivery postponement approved email (and optional date update)
   */
  async sendPostponementApprovedEmail(options: {
    to: string;
    userName: string;
    orderNumber: string;
    approvedDeliveryDate: Date;
    wasDateModified: boolean;
    requestedDeliveryDate: Date;
  }): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Postponement approved email for ${options.to}`);
        return true;
      }
      const d = (x: Date) => new Date(x).toLocaleDateString(undefined, { dateStyle: "medium" });
      const subject = options.wasDateModified
        ? "Your Delivery Date Has Been Updated - Viteezy"
        : "Your Delivery Postponement Has Been Approved - Viteezy";
      const html = `
        <p>Hello ${options.userName},</p>
        <p>Your delivery postponement request for order <strong>${options.orderNumber}</strong> has been approved.</p>
        ${options.wasDateModified ? `<p>We have updated your requested date to <strong>${d(options.approvedDeliveryDate)}</strong>.</p>` : ""}
        <p><strong>New delivery date:</strong> ${d(options.approvedDeliveryDate)}</p>
        <p>Thank you,<br>Viteezy Team</p>
      `;
      const text = `Hello ${options.userName}, Your delivery postponement for order ${options.orderNumber} has been approved. New delivery date: ${d(options.approvedDeliveryDate)}. Thank you, Viteezy Team.`;
      await this.sendEmail({ to: options.to, subject, html, text });
      logger.info(`Postponement approved email sent to ${options.to}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to send postponement approved email: ${error?.message}`);
      return false;
    }
  }

  /**
   * Send delivery postponement rejected email
   */
  async sendPostponementRejectedEmail(options: {
    to: string;
    userName: string;
    orderNumber: string;
    reason: string;
    requestedDeliveryDate: Date;
  }): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        logger.info(`[DEV MODE] Postponement rejected email for ${options.to}`);
        return true;
      }
      const d = (x: Date) => new Date(x).toLocaleDateString(undefined, { dateStyle: "medium" });
      const subject = "Your Delivery Postponement Request - Viteezy";
      const html = `
        <p>Hello ${options.userName},</p>
        <p>Unfortunately, your delivery postponement request for order <strong>${options.orderNumber}</strong> could not be approved.</p>
        <p><strong>Requested date:</strong> ${d(options.requestedDeliveryDate)}</p>
        <p><strong>Reason:</strong> ${options.reason}</p>
        <p>If you have questions, please contact our support team.</p>
        <p>Thank you,<br>Viteezy Team</p>
      `;
      const text = `Hello ${options.userName}, Your delivery postponement for order ${options.orderNumber} was not approved. Reason: ${options.reason}. Thank you, Viteezy Team.`;
      await this.sendEmail({ to: options.to, subject, html, text });
      logger.info(`Postponement rejected email sent to ${options.to}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to send postponement rejected email: ${error?.message}`);
      return false;
    }
  }
}

export const emailService = new EmailService();
