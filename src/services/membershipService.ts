import mongoose from "mongoose";
import { MembershipPlans, Memberships } from "@/models/commerce";
import { User } from "@/models/index.model";
import { MembershipStatus, MEMBERSHIP_STATUS_VALUES, MembershipInterval } from "@/models/enums";
import { IMembershipPlan } from "@/models/commerce/membershipPlans.model";
import { AppError } from "@/utils/AppError";

interface PendingMembershipInput {
  userId: string;
  plan: IMembershipPlan;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  purchasedByUserId?: string;
}

class MembershipService {
  async getActiveMembershipForUser(userId: string) {
    return Memberships.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE,
      isDeleted: false,
      expiresAt: { $gt: new Date() },
    }).lean();
  }

  async createPendingMembership({
    userId,
    plan,
    paymentMethod,
    metadata,
    purchasedByUserId,
  }: PendingMembershipInput) {
    const planSnapshot = {
      planId: plan._id as mongoose.Types.ObjectId,
      name: plan.name,
      slug: plan.slug,
      interval: plan.interval,
      durationDays: plan.durationDays,
      price: plan.price,
      benefits: plan.benefits,
    };

    return Memberships.create({
      userId: new mongoose.Types.ObjectId(userId),
      planId: plan._id,
      planSnapshot,
      status: MembershipStatus.PENDING,
      paymentMethod,
      purchasedByUserId: purchasedByUserId
        ? new mongoose.Types.ObjectId(purchasedByUserId)
        : undefined,
      isAutoRenew: plan.isAutoRenew,
      metadata: {
        ...(metadata || {}),
        purchasedByUserId:
          purchasedByUserId ||
          (userId ? new mongoose.Types.ObjectId(userId).toString() : undefined),
      },
    });
  }

  async activateMembership(
    membershipId: string,
    paymentId?: string | mongoose.Types.ObjectId
  ) {
    const membership = await Memberships.findById(membershipId);
    if (!membership) {
      throw new AppError("Membership not found", 404);
    }

    if (membership.status === MembershipStatus.ACTIVE) {
      return membership;
    }

    const now = new Date();
    const durationDays =
      membership.planSnapshot?.durationDays &&
      membership.planSnapshot.durationDays > 0
        ? membership.planSnapshot.durationDays
        : 30;

    const startDate = membership.startedAt || now;
    const expiresAt = new Date(startDate);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    membership.status = MembershipStatus.ACTIVE;
    membership.startedAt = startDate;
    membership.expiresAt = expiresAt;
    membership.nextBillingDate = membership.isAutoRenew ? expiresAt : undefined;
    if (paymentId) {
      membership.paymentId = new mongoose.Types.ObjectId(paymentId);
    }

    await membership.save();

    await User.findByIdAndUpdate(membership.userId, {
      isMember: true,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipPlanId: membership.planId,
      membershipExpiresAt: expiresAt,
      membershipActivatedAt: startDate,
    });

    return membership;
  }

  /**
   * Calculate refund amount for membership cancellation
   * @param membership - The membership to calculate refund for
   * @returns Object with refund details or null if no refund
   */
  calculateRefundAmount(membership: any): {
    refundAmount: number;
    refundableQuarters: number;
    currentQuarter: number;
    accessEndDate: Date;
  } | null {
    const interval = membership.planSnapshot?.interval;
    const startedAt = membership.startedAt || membership.createdAt;
    const expiresAt = membership.expiresAt;
    const price = membership.planSnapshot?.price?.amount || 0;

    // Quarterly Plan: No cancellation or refund allowed
    if (interval === MembershipInterval.QUARTERLY) {
      return null;
    }

    // Annual Plan: Check cancellation rules
    if (interval === MembershipInterval.YEARLY) {
      const now = new Date();
      const startDate = new Date(startedAt);
      const endDate = expiresAt ? new Date(expiresAt) : null;

      if (!endDate) {
        return null; // No expiry date, can't calculate
      }

      // Calculate total duration in days
      const totalDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Calculate days elapsed since start
      const daysElapsed = Math.ceil(
        (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Annual plan has 4 quarters (365 days / 4 = ~91.25 days per quarter)
      const daysPerQuarter = totalDays / 4;
      const currentQuarter = Math.floor(daysElapsed / daysPerQuarter) + 1;

      // No cancellation allowed during first quarter
      if (currentQuarter === 1) {
        return null;
      }

      // Calculate remaining full quarters
      const remainingDays = totalDays - daysElapsed;
      const remainingFullQuarters = Math.floor(remainingDays / daysPerQuarter);

      // No refund if no full quarters remaining
      if (remainingFullQuarters <= 0) {
        return null;
      }

      // Calculate refund amount (only for full quarters)
      const pricePerQuarter = price / 4;
      const refundAmount = remainingFullQuarters * pricePerQuarter;

      // Calculate access end date (end of current quarter if cancelled mid-quarter)
      const currentQuarterStart = new Date(startDate);
      currentQuarterStart.setDate(
        currentQuarterStart.getDate() + (currentQuarter - 1) * daysPerQuarter
      );
      const currentQuarterEnd = new Date(currentQuarterStart);
      currentQuarterEnd.setDate(currentQuarterEnd.getDate() + daysPerQuarter);

      // If cancelled mid-quarter, access remains till quarter end
      const accessEndDate = now < currentQuarterEnd ? currentQuarterEnd : endDate;

      return {
        refundAmount: Math.round(refundAmount * 100) / 100, // Round to 2 decimal places
        refundableQuarters: remainingFullQuarters,
        currentQuarter,
        accessEndDate,
      };
    }

    return null;
  }

  /**
   * Get quarter end date for a given date
   */
  getQuarterEndDate(startDate: Date, currentDate: Date, totalDays: number): Date {
    const daysPerQuarter = totalDays / 4;
    const daysElapsed = Math.ceil(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const currentQuarter = Math.floor(daysElapsed / daysPerQuarter) + 1;
    
    const quarterStart = new Date(startDate);
    quarterStart.setDate(quarterStart.getDate() + (currentQuarter - 1) * daysPerQuarter);
    
    const quarterEnd = new Date(quarterStart);
    quarterEnd.setDate(quarterEnd.getDate() + daysPerQuarter);
    
    return quarterEnd;
  }
}

export const membershipService = new MembershipService();
