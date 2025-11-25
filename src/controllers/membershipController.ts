import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { MembershipPlans } from "@/models/commerce";
import { membershipService } from "@/services/membershipService";
import { paymentService } from "@/services/payment/PaymentService";
import { PaymentMethod } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

class MembershipController {
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

      const { planId, paymentMethod, returnUrl, metadata } = req.body as {
        planId: string;
        paymentMethod: PaymentMethod;
        returnUrl?: string;
        metadata?: Record<string, any>;
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

      const membership = await membershipService.createPendingMembership({
        userId: req.user._id,
        plan,
        paymentMethod,
        metadata,
      });

      const membershipId = (
        membership._id as mongoose.Types.ObjectId
      ).toString();

      const amount = plan.price?.amount || 0;
      const currency = plan.price?.currency || "EUR";

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
          metadata: {
            membershipId,
            planId: plan._id.toString(),
            planName: plan.name,
          },
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
