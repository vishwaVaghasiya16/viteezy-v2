import mongoose from "mongoose";
import { MembershipPlans, Memberships } from "@/models/commerce";
import { User } from "@/models/index.model";
import { MembershipStatus, MEMBERSHIP_STATUS_VALUES } from "@/models/enums";
import { IMembershipPlan } from "@/models/commerce/membershipPlans.model";
import { AppError } from "@/utils/AppError";

interface PendingMembershipInput {
  userId: string;
  plan: IMembershipPlan;
  paymentMethod?: string;
  metadata?: Record<string, any>;
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
      isAutoRenew: plan.isAutoRenew,
      metadata: metadata || {},
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
}

export const membershipService = new MembershipService();
