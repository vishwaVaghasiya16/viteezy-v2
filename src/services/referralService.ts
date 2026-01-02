import mongoose from "mongoose";
import { User, Referrals } from "../models/index.model";
import { ReferralStatus } from "../models/enums";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { emailService } from "./emailService";

interface ReferralConfig {
  defaultDiscountAmount: number;
  defaultMinOrderAmount: number;
  currency: string;
}

class ReferralService {
  private readonly config: ReferralConfig;

  constructor() {
    this.config = {
      defaultDiscountAmount: 10, // €10
      defaultMinOrderAmount: 19.99, // €19.99
      currency: "EUR",
    };
  }

  /**
   * Generate a unique referral code for a user
   * Format: FIRSTNAME + 5-digit random number (e.g., JOHN12345)
   */
  async generateReferralCode(firstName: string): Promise<string> {
    // Clean firstName: remove spaces, special chars, convert to uppercase
    const cleanFirstName = firstName
      .trim()
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase();

    if (!cleanFirstName || cleanFirstName.length === 0) {
      throw new AppError("First name is required to generate referral code", 400);
    }

    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Generate 5-digit random number
      const randomNumber = Math.floor(10000 + Math.random() * 90000); // 10000-99999
      const referralCode = `${cleanFirstName}${randomNumber}`;

      // Check if code already exists
      const existingUser = await User.findOne({
        referralCode: referralCode,
        isDeleted: false,
      });

      if (!existingUser) {
        return referralCode;
      }

      attempts++;
    }

    throw new AppError(
      "Failed to generate unique referral code. Please try again.",
      500
    );
  }

  /**
   * Validate referral code and check if it can be used
   */
  async validateReferralCode(
    referralCode: string,
    userId: string,
    orderAmount: number
  ): Promise<{
    isValid: boolean;
    referrer?: any;
    discountAmount: number;
    minOrderAmount: number;
    message?: string;
  }> {
    const normalizedCode = referralCode.toUpperCase().trim();

    // Find user with this referral code
    const referrer = await User.findOne({
      referralCode: normalizedCode,
      isDeleted: false,
      isActive: true,
    });

    if (!referrer) {
      return {
        isValid: false,
        discountAmount: this.config.defaultDiscountAmount,
        minOrderAmount: this.config.defaultMinOrderAmount,
        message: "Invalid referral code",
      };
    }

    // Check if user is trying to use their own referral code
    if (referrer._id.toString() === userId) {
      return {
        isValid: false,
        discountAmount: this.config.defaultDiscountAmount,
        minOrderAmount: this.config.defaultMinOrderAmount,
        message: "You cannot use your own referral code",
      };
    }

    // Check if user has already used a referral code (one-time use for referred customer)
    const existingReferral = await Referrals.findOne({
      toUserId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    });

    if (existingReferral) {
      return {
        isValid: false,
        discountAmount: this.config.defaultDiscountAmount,
        minOrderAmount: this.config.defaultMinOrderAmount,
        message: "You have already used a referral code",
      };
    }

    // Check minimum order amount
    if (orderAmount < this.config.defaultMinOrderAmount) {
      return {
        isValid: false,
        referrer,
        discountAmount: this.config.defaultDiscountAmount,
        minOrderAmount: this.config.defaultMinOrderAmount,
        message: `Minimum order amount of ${this.config.defaultMinOrderAmount} ${this.config.currency} is required for referral code`,
      };
    }

    return {
      isValid: true,
      referrer,
      discountAmount: this.config.defaultDiscountAmount,
      minOrderAmount: this.config.defaultMinOrderAmount,
    };
  }

  /**
   * Create referral record when referral code is used during checkout
   */
  async createReferralRecord(
    fromUserId: string,
    toUserId: string,
    referralCode: string,
    orderId: string,
    orderAmount: number
  ): Promise<any> {
    // Check if referral already exists for this order
    const existingReferral = await Referrals.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      isDeleted: false,
    });

    if (existingReferral) {
      return existingReferral;
    }

    const referral = await Referrals.create({
      fromUserId: new mongoose.Types.ObjectId(fromUserId),
      toUserId: new mongoose.Types.ObjectId(toUserId),
      referralCode: referralCode.toUpperCase().trim(),
      orderId: new mongoose.Types.ObjectId(orderId),
      status: ReferralStatus.PENDING,
      discountAmount: {
        amount: this.config.defaultDiscountAmount,
        currency: this.config.currency,
      },
      minOrderAmount: {
        amount: this.config.defaultMinOrderAmount,
        currency: this.config.currency,
      },
      referredOrderAmount: {
        amount: orderAmount,
        currency: this.config.currency,
      },
      referredDiscountApplied: false,
      referrerDiscountApplied: false,
    });

    logger.info(
      `Referral record created: ${referral._id} for order ${orderId}`
    );

    return referral;
  }

  /**
   * Update referral status when payment is confirmed (PENDING → PAID)
   */
  async updateReferralStatusToPaid(
    orderId: string,
    paymentId: string
  ): Promise<any> {
    const referral = await Referrals.findOne({
      orderId: new mongoose.Types.ObjectId(orderId),
      status: ReferralStatus.PENDING,
      isDeleted: false,
    });

    if (!referral) {
      logger.warn(`No pending referral found for order ${orderId}`);
      return null;
    }

    referral.status = ReferralStatus.PAID;
    referral.paymentId = new mongoose.Types.ObjectId(paymentId);
    referral.referredDiscountApplied = true;
    await referral.save();

    logger.info(
      `Referral status updated to PAID: ${referral._id} for order ${orderId}`
    );

    // Send email notification to referrer (Customer 1)
    try {
      const referrer = await User.findById(referral.fromUserId);
      if (referrer && referrer.email) {
        await this.sendReferralNotificationEmail(
          referrer.email,
          referrer.firstName,
          referral.discountAmount.amount,
          referral.discountAmount.currency
        );
      }
    } catch (error) {
      logger.error("Failed to send referral notification email:", error);
      // Don't throw error, just log it
    }

    return referral;
  }

  /**
   * Update referral status when referrer's recurring payment is processed (PAID → COMPLETED)
   */
  async updateReferralStatusToCompleted(
    fromUserId: string,
    orderId: string
  ): Promise<any> {
    // Find referrals for this referrer that are in PAID status
    const referral = await Referrals.findOne({
      fromUserId: new mongoose.Types.ObjectId(fromUserId),
      status: ReferralStatus.PAID,
      isDeleted: false,
    }).sort({ createdAt: -1 }); // Get the most recent one

    if (!referral) {
      logger.warn(
        `No paid referral found for referrer ${fromUserId}`
      );
      return null;
    }

    referral.status = ReferralStatus.COMPLETED;
    referral.referrerDiscountApplied = true;
    await referral.save();

    logger.info(
      `Referral status updated to COMPLETED: ${referral._id} for referrer ${fromUserId}`
    );

    return referral;
  }

  /**
   * Send email notification to referrer when their referral payment is confirmed
   */
  private async sendReferralNotificationEmail(
    email: string,
    firstName: string,
    discountAmount: number,
    currency: string
  ): Promise<void> {
    try {
      const subject = "Your Referral Reward is Ready! 🎉";
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
            .discount-box { background-color: #fff; border: 2px solid #4CAF50; padding: 15px; margin: 20px 0; text-align: center; }
            .discount-amount { font-size: 24px; font-weight: bold; color: #4CAF50; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Congratulations!</h1>
            </div>
            <div class="content">
              <p>Hi ${firstName},</p>
              <div class="message">
                <p>Great news! Someone used your referral code and completed their first order.</p>
                <p>You've earned a discount on your next recurring payment!</p>
              </div>
              <div class="discount-box">
                <p>Your Referral Reward:</p>
                <div class="discount-amount">${discountAmount} ${currency}</div>
                <p>This discount will be automatically applied to your next recurring payment.</p>
              </div>
              <p>Thank you for referring friends to Viteezy!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Viteezy. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendCustomEmail(email, subject, html);

      logger.info(`Referral notification email sent to ${email}`);
    } catch (error) {
      logger.error(`Failed to send referral notification email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getUserReferralStats(userId: string): Promise<{
    totalReferrals: number;
    pendingReferrals: number;
    paidReferrals: number;
    completedReferrals: number;
  }> {
    const [total, pending, paid, completed] = await Promise.all([
      Referrals.countDocuments({
        fromUserId: new mongoose.Types.ObjectId(userId),
        isDeleted: false,
      }),
      Referrals.countDocuments({
        fromUserId: new mongoose.Types.ObjectId(userId),
        status: ReferralStatus.PENDING,
        isDeleted: false,
      }),
      Referrals.countDocuments({
        fromUserId: new mongoose.Types.ObjectId(userId),
        status: ReferralStatus.PAID,
        isDeleted: false,
      }),
      Referrals.countDocuments({
        fromUserId: new mongoose.Types.ObjectId(userId),
        status: ReferralStatus.COMPLETED,
        isDeleted: false,
      }),
    ]);

    return {
      totalReferrals: total,
      pendingReferrals: pending,
      paidReferrals: paid,
      completedReferrals: completed,
    };
  }
}

export const referralService = new ReferralService();

