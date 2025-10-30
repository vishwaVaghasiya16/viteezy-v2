import nodemailer from "nodemailer";
import { logger } from "../utils/logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Check if email credentials are available
    const hasCredentials = process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasCredentials) {
      // Create transporter using environment variables
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
        pool: true,
        auth: {
          user: process.env.SMTP_USER as string,
          pass: process.env.SMTP_PASS as string,
        },
        tls: {
          // Allow configuration via env; default to standard verification
          rejectUnauthorized:
            process.env.SMTP_REJECT_UNAUTHORIZED === "false" ? false : true,
        },
      });

      // Verify connection configuration
      this.verifyConnection();
    } else {
      // Development mode - create a mock transporter
      logger.warn(
        "Email credentials not found. Using mock email service for development."
      );
      this.transporter = null as any; // Mock transporter
    }
  }

  private async verifyConnection() {
    try {
      if (this.transporter) {
        await this.transporter.verify();
        logger.info("Email service connected successfully");
      }
    } catch (error) {
      logger.error("Email service connection failed:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        response: (error as any)?.response,
        command: (error as any)?.command,
      });
      // Don't throw error to prevent app crash, just log it
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
      // If no transporter (development mode), just log the OTP
      if (!this.transporter) {
        logger.info(`[DEV MODE] OTP for ${email}: ${otp} (Type: ${type})`);
        return true;
      }

      console.log({ email, otp });

      const subject = this.getOTPSubject(type);
      const html = this.getOTPEmailTemplate(otp, type);
      const text = this.getOTPTextTemplate(otp, type);

      await this.sendEmail({
        to: email,
        subject,
        html,
        text,
      });

      logger.info(`OTP email sent successfully to ${email}`);
      return true;
    } catch (error) {
      logger.error("Failed to send OTP email:", error);
      // In case of error, log OTP for development
      logger.info(`[FALLBACK] OTP for ${email}: ${otp} (Type: ${type})`);
      return false;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      // If no transporter (development mode), just log
      if (!this.transporter) {
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

      logger.info(`Welcome email sent successfully to ${email}`);
      return true;
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
      return false;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, otp: string): Promise<boolean> {
    try {
      // If no transporter (development mode), just log
      if (!this.transporter) {
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

      logger.info(`Password reset email sent successfully to ${email}`);
      return true;
    } catch (error) {
      logger.error("Failed to send password reset email:", error);
      return false;
    }
  }

  /**
   * Generic email sending method
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (error) {
      logger.error("Email sending failed:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        response: (error as any)?.response,
        command: (error as any)?.command,
      });
      throw error;
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
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Viteezy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
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
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${message}</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
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

This code will expire in 10 minutes.

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
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Viteezy</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Viteezy!</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>Welcome to Viteezy! We're excited to have you on board.</p>
            <p>Your account has been created successfully. Please verify your email address to get started.</p>
            <p>If you have any questions, feel free to contact our support team.</p>
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
            <p>This code will expire in 10 minutes.</p>
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
