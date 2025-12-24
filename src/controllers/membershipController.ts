import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { MembershipPlans } from "@/models/commerce";
import { membershipService } from "@/services/membershipService";
import { paymentService } from "@/services/payment/PaymentService";
import { PaymentMethod } from "@/models/enums";
import { MemberReferrals } from "@/models/core/memberReferrals.model";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
}

class MembershipController {
  /**
   * Get all active membership plans
   * @route GET /api/memberships/plans
   * @access Public
   */
  getMembershipPlans = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { interval, lang = "en" } = req.query as {
        interval?: string;
        lang?: string;
      };

      const filter: Record<string, any> = {
        isActive: true,
        isDeleted: false,
      };

      // Filter by interval if provided
      if (interval) {
        filter.interval = interval;
      }

      const membershipPlans = await MembershipPlans.find(filter)
        .sort({ durationDays: 1, createdAt: -1 })
        .select(
          "name slug shortDescription description price interval durationDays benefits isAutoRenew"
        )
        .lean();

      // Format response with language-specific content
      const formattedPlans = membershipPlans.map((plan) => ({
        id: plan._id,
        name: plan.name,
        slug: plan.slug,
        shortDescription:
          plan.shortDescription?.[lang as "en" | "nl"] ||
          plan.shortDescription?.en ||
          "",
        description:
          plan.description?.[lang as "en" | "nl"] || plan.description?.en || "",
        price: plan.price,
        interval: plan.interval,
        durationDays: plan.durationDays,
        benefits: plan.benefits || [],
        isAutoRenew: plan.isAutoRenew,
      }));

      res.apiSuccess(
        { plans: formattedPlans },
        "Membership plans retrieved successfully"
      );
    }
  );

  /**
   * Buy membership plan
   * @route POST /api/memberships/buy
   * @access Private
   */
  buyMembership = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { planId, paymentMethod, returnUrl, metadata, beneficiaryUserId } =
        req.body as {
          planId: string;
          paymentMethod: PaymentMethod;
          returnUrl?: string;
          metadata?: Record<string, any>;
          beneficiaryUserId?: string;
        };

      const plan = await MembershipPlans.findOne({
        _id: new mongoose.Types.ObjectId(planId),
        isActive: true,
        isDeleted: false,
      }).lean();

      if (!plan) {
        throw new AppError("Membership plan not found", 404);
      }

      const activeMembership =
        await membershipService.getActiveMembershipForUser(req.user._id);
      if (activeMembership) {
        throw new AppError(
          "You already have an active membership. Please cancel or wait until it expires before purchasing a new plan.",
          400
        );
      }

      let targetUserId = req.user._id;
      let beneficiaryInfo: {
        userId: string;
        name?: string;
        email?: string;
        memberId?: string;
      } | null = null;

      if (
        beneficiaryUserId &&
        beneficiaryUserId !== req.user._id &&
        mongoose.Types.ObjectId.isValid(beneficiaryUserId)
      ) {
        const referral = await MemberReferrals.findOne({
          parentUserId: new mongoose.Types.ObjectId(req.user._id),
          childUserId: new mongoose.Types.ObjectId(beneficiaryUserId),
          isActive: true,
          isDeleted: false,
        })
          .populate("childUserId", "name email memberId isActive")
          .lean();

        if (!referral || !referral.childUserId) {
          throw new AppError(
            "Selected member is not linked to your account",
            403
          );
        }

        const child = referral.childUserId as any;
        if (child.isActive === false) {
          throw new AppError("Selected member account is inactive", 400);
        }

        targetUserId = child._id.toString();
        beneficiaryInfo = {
          userId: child._id.toString(),
          name: child.name,
          email: child.email,
          memberId: child.memberId,
        };
      }

      const membership = await membershipService.createPendingMembership({
        userId: targetUserId,
        plan,
        paymentMethod,
        metadata: {
          ...metadata,
          purchasedByUserId:
            beneficiaryInfo && beneficiaryInfo.userId !== req.user._id
              ? req.user._id
              : undefined,
          beneficiaryUserId: beneficiaryInfo?.userId,
        },
        purchasedByUserId:
          beneficiaryInfo && beneficiaryInfo.userId !== req.user._id
            ? req.user._id
            : undefined,
      });

      const membershipId = (
        membership._id as mongoose.Types.ObjectId
      ).toString();

      const amount = plan.price?.amount || 0;
      const currency = plan.price?.currency || "EUR";

      const paymentMetadata: Record<string, string> = {
        membershipId,
        planId: plan._id.toString(),
        planName: plan.name,
        beneficiaryUserId: beneficiaryInfo?.userId || targetUserId,
        beneficiaryName:
          beneficiaryInfo?.name ??
          (req.user?.firstName && req.user?.lastName
            ? `${req.user.firstName} ${req.user.lastName}`.trim()
            : req.user?.firstName || req.user?.lastName || ""),
      };

      const paymentResponse =
        await paymentService.createMembershipPaymentIntent({
          membershipId,
          userId: req.user._id,
          paymentMethod,
          amount: {
            value: amount,
            currency,
          },
          description: `Membership - ${plan.name}`,
          metadata: paymentMetadata,
          returnUrl,
        });

      res.status(201).json({
        success: true,
        message: "Membership payment initiated",
        data: {
          membership: {
            id: membership._id,
            status: membership.status,
            plan: {
              id: plan._id,
              name: plan.name,
              interval: plan.interval,
              price: plan.price,
              durationDays: plan.durationDays,
            },
            beneficiary: beneficiaryInfo
              ? beneficiaryInfo
              : {
                  userId: req.user._id,
                  name:
                    req.user.firstName && req.user.lastName
                      ? `${req.user.firstName} ${req.user.lastName}`.trim()
                      : req.user.firstName || req.user.lastName || "",
                },
          },
          payment: {
            id: paymentResponse.payment._id,
            status: paymentResponse.payment.status,
            paymentMethod: paymentResponse.payment.paymentMethod,
            gatewayTransactionId: paymentResponse.payment.gatewayTransactionId,
            redirectUrl: paymentResponse.result.redirectUrl,
            clientSecret: paymentResponse.result.clientSecret,
          },
        },
      });
    }
  );
}

export const membershipController = new MembershipController();
