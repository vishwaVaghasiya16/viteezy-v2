import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { MembershipPlans, Memberships, Payments } from "@/models/commerce";
import { membershipService } from "@/services/membershipService";
import { paymentService } from "@/services/payment/PaymentService";
import { PaymentMethod, PaymentStatus } from "@/models/enums";
import { MemberReferrals } from "@/models/core/memberReferrals.model";
import { User } from "@/models/index.model";
import { 
  MembershipStatus, 
  MembershipInterval 
} from "@/models/enums";

// Fixed TypeScript compilation errors

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }
}

/**
 * Get effective membership for a user with family benefits
 * Merges self benefits with inherited benefits from main member
 */
const getEffectiveMembership = async (userId: string) => {
  try {
    // Get user's family role
    const user = await User.findById(userId).select('parentId').lean();
    if (!user) {
      return null;
    }

    // Get user's own membership
    const userMembership = await Memberships.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: MembershipStatus.ACTIVE,
      isDeleted: false
    }).populate('planId').lean();

    // If user is independent or main member, return their own membership
    if (!user.parentId) {
      return userMembership;
    }

    // For sub-members, get main member's membership
    const mainMembership = await Memberships.findOne({
      userId: user.parentId,
      status: MembershipStatus.ACTIVE,
      isDeleted: false
    }).populate('planId').lean();

    // Merge benefits: self benefits take priority over inherited
    if (userMembership && mainMembership && userMembership.planId && mainMembership.planId) {
      const selfBenefits = (userMembership.planId as any).benefits || [];
      const inheritedBenefits = ((mainMembership.planId as any).benefits || []).filter(
        (benefit: any) => benefit.familyShareable !== false
      );
      
      // Remove duplicates, keeping self benefits
      const allBenefits = [...new Set([...selfBenefits, ...inheritedBenefits])];
      
      return {
        ...userMembership,
        effectiveBenefits: allBenefits,
        hasInheritedBenefits: inheritedBenefits.length > 0,
        inheritedFrom: user.parentId
      };
    }

    // Return whichever membership exists
    return userMembership || mainMembership;
  } catch (error) {
    console.error('Error getting effective membership:', error);
    return null;
  }
};

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

      // FAMILY BENEFIT MARKING
      const { getUserFamilyRole } = await import("@/services/familyValidationService");
      const userRole = await getUserFamilyRole(req.user._id);
      if (userRole === 'MAIN_MEMBER') {
        await Memberships.updateOne(
          { _id: membership._id },
          { 
            $set: { 
              'benefits.$[elem].familyShareable': true 
            }
          },
          { 
            arrayFilters: [{ 'elem.type': { $in: ['FREE_SHIPPING', 'DISCOUNT'] } }]
          }
        );
      }

      const membershipId = (
        membership._id as mongoose.Types.ObjectId
      ).toString();

      const amount = plan.price?.amount || 0;
      const currency = plan.price?.currency || "USD";

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

      // Set redirect URLs to /products for membership payments (clean URLs without query params)
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
      const membershipReturnUrl = `${frontendUrl}/products`;
      const membershipCancelUrl = `${frontendUrl}/products`;

      // Get email from authenticated user token
      const customerEmail = req.user?.email;

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
          returnUrl: membershipReturnUrl,
          cancelUrl: membershipCancelUrl,
          customerEmail,
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
            membershipId: paymentResponse.payment.membershipId,
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

  /**
   * Get user's memberships (subscriptions)
   * @route GET /api/memberships
   * @access Private
   */
  getUserMemberships = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { status, page = 1, limit = 20 } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const paginationOptions = getPaginationOptions(req);
      const skip = (paginationOptions.page - 1) * paginationOptions.limit;

      // Build query - get ALL memberships regardless of status
      const query: any = {
        userId,
        isDeleted: false,
      };

      // Only filter by status if explicitly provided
      if (status && status !== "all") {
        query.status = status;
      }

      // Get memberships
      const [memberships, total] = await Promise.all([
        Memberships.find(query)
          .populate("planId", "name slug interval durationDays price benefits")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        Memberships.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(
        paginationOptions.page,
        paginationOptions.limit,
        total
      );

      // Format response to match Postman collection expectations
      const formattedMemberships = memberships.map((membership: any) => {
        const now = new Date();
        const daysUntilExpiry = membership.expiresAt
          ? Math.ceil(
              (membership.expiresAt.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        const daysUntilNextBilling = membership.nextBillingDate
          ? Math.ceil(
              (membership.nextBillingDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        // Get plan label from interval
        const getPlanLabel = (interval: string): string => {
          const labels: Record<string, string> = {
            [MembershipInterval.MONTHLY]: "Monthly",
            [MembershipInterval.QUARTERLY]: "Quarterly", 
            [MembershipInterval.YEARLY]: "Yearly",
          };
          return labels[interval] || interval;
        };

        // Get amount display
        const amount = membership.planSnapshot?.price;
        const amountDisplay = amount 
          ? `${amount.currency} ${amount.amount.toFixed(2)}/${getPlanLabel(membership.planSnapshot?.interval)}`
          : null;

        return {
          id: membership._id,
          status: membership.status,
          planLabel: getPlanLabel(membership.planSnapshot?.interval),
          planId: membership.planId,
          planSnapshot: membership.planSnapshot,
          amountDisplay,
          startDate: membership.startedAt,
          expiryDate: membership.expiresAt,
          nextBillingDate: membership.nextBillingDate,
          cancelDate: membership.cancelledAt,
          pauseDate: null, // Memberships don't support pause
          daysUntilExpiry,
          daysUntilNextBilling,
          cancellationReason: membership.cancellationReason,
          pauseReason: null, // Memberships don't support pause
          isAutoRenew: membership.isAutoRenew,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        message: "Memberships retrieved successfully",
        data: formattedMemberships,
        pagination: paginationMeta,
      });
    }
  );

  /**
   * Get membership details
   * @route GET /api/memberships/:membershipId
   * @access Private
   */
  getMembershipDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { membershipId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const membership = await Memberships.findOne({
        _id: new mongoose.Types.ObjectId(membershipId),
        userId,
        isDeleted: false,
      })
        .populate("planId", "name slug interval durationDays price benefits")
        .lean();

      if (!membership) {
        throw new AppError("Membership not found", 404);
      }

      const now = new Date();
      const daysUntilExpiry = membership.expiresAt
        ? Math.ceil(
            (membership.expiresAt.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const daysUntilNextBilling = membership.nextBillingDate
        ? Math.ceil(
            (membership.nextBillingDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      // Get plan label from interval
      const getPlanLabel = (interval: string): string => {
        const labels: Record<string, string> = {
          [MembershipInterval.MONTHLY]: "Monthly",
          [MembershipInterval.QUARTERLY]: "Quarterly",
          [MembershipInterval.YEARLY]: "Yearly",
        };
        return labels[interval] || interval;
      };

      // Get amount display
      const amount = membership.planSnapshot?.price;
      const amountDisplay = amount 
        ? `${amount.currency} ${amount.amount.toFixed(2)}/${getPlanLabel(membership.planSnapshot?.interval)}`
        : null;

      res.status(200).json({
        success: true,
        message: "Membership details retrieved successfully",
        data: {
          membership: {
            id: membership._id,
            status: membership.status,
            planLabel: getPlanLabel(membership.planSnapshot?.interval),
            planId: membership.planId,
            planSnapshot: membership.planSnapshot,
            amountDisplay,
            startDate: membership.startedAt,
            expiryDate: membership.expiresAt,
            nextBillingDate: membership.nextBillingDate,
            cancelDate: membership.cancelledAt,
            pauseDate: null, // Memberships don't support pause
            daysUntilExpiry,
            daysUntilNextBilling,
            cancellationReason: membership.cancellationReason,
            pauseReason: null, // Memberships don't support pause
            isAutoRenew: membership.isAutoRenew,
            metadata: membership.metadata,
            createdAt: membership.createdAt,
            updatedAt: membership.updatedAt,
          },
        },
      });
    }
  );

  /**
   * Cancel membership
   * @route POST /api/memberships/:membershipId/cancel
   * @access Private
   *
   * Cancellation window:
   * - Cancellation is NOT allowed in the last 10 days before membership expiry (any plan).
   * - Example: 1-month plan → cancel allowed in first ~20 days; not in last 10 days.
   *
   * Refund Rules:
   * - Quarterly Plan: No cancellation or refund allowed
   * - Annual Plan:
   *   - No cancellation allowed during first quarter
   *   - Post first quarter: Refund for remaining full quarters only
   *   - No partial refunds
   *   - If cancelled mid-quarter, access remains till quarter end
   */
  cancelMembership = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { membershipId } = req.params;
      const { cancellationReason } = req.body;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const membership = await Memberships.findOne({
        _id: new mongoose.Types.ObjectId(membershipId),
        userId,
        isDeleted: false,
      });

      if (!membership) {
        throw new AppError("Membership not found", 404);
      }

      if (membership.status === MembershipStatus.CANCELLED) {
        throw new AppError("Membership is already cancelled", 400);
      }

      // Do not allow cancellation in the last 10 days before expiry (any plan)
      const LAST_DAYS_NO_CANCEL = 10;
      const expiresAt = membership.expiresAt ? new Date(membership.expiresAt) : null;
      if (expiresAt) {
        const now = new Date();
        const msPerDay = 1000 * 60 * 60 * 24;
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
        if (daysUntilExpiry <= LAST_DAYS_NO_CANCEL && daysUntilExpiry > 0) {
          throw new AppError(
            `Cancellation is not allowed in the last ${LAST_DAYS_NO_CANCEL} days before membership expiry. Your membership expires in ${daysUntilExpiry} day(s).`,
            400
          );
        }
        if (daysUntilExpiry <= 0) {
          throw new AppError("Membership has already expired", 400);
        }
      }

      const interval = membership.planSnapshot?.interval;

      // Quarterly Plan: No cancellation or refund allowed
      if (interval === MembershipInterval.QUARTERLY) {
        throw new AppError(
          "Cancellation is not allowed for Quarterly membership plans",
          400
        );
      }

      // Annual Plan: Check if cancellation is allowed
      let refundDetails: {
        refundAmount: number;
        refundableQuarters: number;
        currentQuarter: number;
        accessEndDate: Date;
      } | null = null;
      let refundProcessed = false;
      let refundAmount = 0;

      if (interval === MembershipInterval.YEARLY) {
        refundDetails = membershipService.calculateRefundAmount(membership);

        // No cancellation allowed during first quarter
        if (!refundDetails) {
          const startedAt = membership.startedAt || membership.createdAt;
          const now = new Date();
          const daysElapsed = Math.ceil(
            (now.getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysPerQuarter = 365 / 4; // ~91.25 days per quarter
          const currentQuarter = Math.floor(daysElapsed / daysPerQuarter) + 1;

          if (currentQuarter === 1) {
            throw new AppError(
              "Cancellation is not allowed during the first quarter of Annual membership",
              400
            );
          }
        }

        // Process refund if applicable
        let accessEndDate = membership.expiresAt || new Date();

        if (refundDetails && refundDetails.refundAmount > 0) {
          // Set access end date (quarter end if cancelled mid-quarter)
          accessEndDate = refundDetails.accessEndDate;

          // Process refund through payment service
          if (membership.paymentId) {
            try {
              await paymentService.refundPayment({
                paymentId: membership.paymentId.toString(),
                amount: refundDetails.refundAmount,
                reason: `Membership cancellation refund - ${refundDetails.refundableQuarters} quarter(s) remaining`,
                metadata: {
                  membershipId: String(membership._id),
                  refundableQuarters: refundDetails.refundableQuarters.toString(),
                  currentQuarter: refundDetails.currentQuarter.toString(),
                },
              });
              refundProcessed = true;
              refundAmount = refundDetails.refundAmount;
            } catch (error: any) {
              // Log error but don't fail cancellation if refund fails
              console.error("Refund processing failed:", error);
              // Continue with cancellation even if refund fails
            }
          }
        }

        // Update membership with access end date
        membership.expiresAt = accessEndDate;
      }

      // Cancel membership
      membership.status = MembershipStatus.CANCELLED;
      membership.cancelledAt = new Date();
      if (cancellationReason && typeof cancellationReason === "string") {
        membership.cancellationReason = cancellationReason.trim().substring(0, 500);
      }

      await membership.save();

      // Update user's membership status
      await User.findByIdAndUpdate(membership.userId, {
        isMember: false,
        membershipStatus: MembershipStatus.CANCELLED,
      });

      const responseData: any = {
        id: membership._id,
        status: membership.status,
        cancelledAt: membership.cancelledAt,
        cancellationReason: membership.cancellationReason,
        accessEndDate: membership.expiresAt,
      };

      // Add refund information if applicable
      if (interval === MembershipInterval.YEARLY) {
        if (refundDetails && refundAmount > 0) {
          responseData.refund = {
            amount: refundAmount,
            refundableQuarters: refundDetails.refundableQuarters,
            processed: refundProcessed,
          };
        } else {
          responseData.refund = {
            amount: 0,
            message: "No refund applicable",
          };
        }
      }

      res.status(200).json({
        success: true,
        message: "Membership cancelled successfully",
        data: {
          membership: responseData,
        },
      });
    }
  );

  /**
   * Membership widget overview for user dashboard
   * @route GET /api/memberships/widget/overview
   * @access Private
   */
  getMembershipWidget = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const userId = new mongoose.Types.ObjectId(req.user._id);

      const membership = await Memberships.findOne({
        userId,
        isDeleted: false,
        status: { $in: [MembershipStatus.ACTIVE] }, // Only active memberships since PAUSED is not supported
      })
        .populate("planId", "name slug interval durationDays price")
        .sort({ nextBillingDate: 1, createdAt: -1 })
        .lean();

      if (!membership) {
        res.status(200).json({
          success: true,
          message: "No active membership",
          data: {
            widget: {
              hasActiveSubscription: false,
              headline: "Try Membership Plans - Get exclusive benefits and save more",
              cta: {
                label: "Explore Plans",
                action: "explore-memberships",
              },
            },
          },
        });
        return;
      }

      const now = new Date();
      const daysUntilExpiry = membership.expiresAt
        ? Math.ceil(
            (membership.expiresAt.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const daysUntilNextBilling = membership.nextBillingDate
        ? Math.ceil(
            (membership.nextBillingDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      // Get plan label from interval
      const getPlanLabel = (interval: string): string => {
        const labels: Record<string, string> = {
          [MembershipInterval.MONTHLY]: "Monthly",
          [MembershipInterval.QUARTERLY]: "Quarterly",
          [MembershipInterval.YEARLY]: "Yearly",
        };
        return labels[interval] || interval;
      };

      // Get amount display
      const amount = membership.planSnapshot?.price;
      const amountDisplay = amount 
        ? `${amount.currency} ${amount.amount.toFixed(2)}/${getPlanLabel(membership.planSnapshot?.interval)}`
        : null;

      res.status(200).json({
        success: true,
        message: "Membership widget data retrieved successfully",
        data: {
          widget: {
            hasActiveSubscription: true,
            membershipId: membership._id,
            status: membership.status,
            planLabel: getPlanLabel(membership.planSnapshot?.interval),
            amountDisplay,
            expiryDate: membership.expiresAt,
            nextBillingDate: membership.nextBillingDate,
            daysUntilExpiry,
            daysUntilNextBilling,
            actions: {
              manage: {
                label: "Manage Plan",
                action: "manage-membership",
                membershipId: membership._id,
              },
              cancel: {
                label: "Cancel Plan",
                action: "cancel-membership",
                membershipId: membership._id,
              },
            },
          },
        },
      });
    }
  );

  /**
   * Get user's effective membership with family benefits
   * @route GET /api/memberships/effective
   * @access Private
   */
  getEffectiveMembership = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const effectiveMembership = await getEffectiveMembership(req.user._id);

      if (!effectiveMembership) {
        res.apiSuccess(
          { hasMembership: false },
          "No active membership found"
        );
        return;
      }

      res.apiSuccess(
        { 
          hasMembership: true,
          membership: effectiveMembership
        },
        "Effective membership retrieved successfully"
      );
    }
  );

  /**
   * Get membership benefits (available benefits from active plans)
   * @route GET /api/memberships/benefits
   * @access Private
   */
  getMembershipBenefits = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { lang = "en" } = req.query as { lang?: string };

      // Get all active membership plans and their benefits
      const membershipPlans = await MembershipPlans.find({
        isActive: true,
        isDeleted: false,
      })
        .select("name benefits")
        .lean();

      // Collect all unique benefits from all plans
      const allBenefits = new Set<string>();
      membershipPlans.forEach((plan) => {
        if (plan.benefits && Array.isArray(plan.benefits)) {
          plan.benefits.forEach((benefit) => {
            if (typeof benefit === "string" && benefit.trim()) {
              allBenefits.add(benefit.trim());
            }
          });
        }
      });

      // Convert to array and sort alphabetically
      const benefitsList = Array.from(allBenefits).sort();

      res.apiSuccess(
        { 
          benefits: benefitsList,
          totalBenefits: benefitsList.length 
        },
        "Membership benefits retrieved successfully"
      );
    }
  );

  /**
   * Get membership transaction history
   * @route GET /api/memberships/:membershipId/transactions
   * @access Private
   * @query {Number} [page] - Page number (default: 1)
   * @query {Number} [limit] - Items per page (default: 10)
   * @query {String} [status] - Filter by payment status
   * @query {String} [paymentMethod] - Filter by payment method
   * @query {String} [sortBy] - Sort by field (createdAt, processedAt, amount, status)
   * @query {String} [sortOrder] - Sort order (asc, desc)
   * @query {String} [search] - Search by transaction ID
   */
  getMembershipTransactions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { membershipId } = req.params;
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, paymentMethod, search } = req.query as {
        status?: string;
        paymentMethod?: string;
        search?: string;
      };

      // Validate membershipId format
      if (!mongoose.Types.ObjectId.isValid(membershipId)) {
        throw new AppError("Invalid membership ID format", 400);
      }

      const membershipObjectId = new mongoose.Types.ObjectId(membershipId);

      // Check if membership exists and belongs to the user
      const membership = await Memberships.findOne({
        _id: membershipObjectId,
        userId: req.user._id,
        isDeleted: { $ne: true },
      })
        .populate("planId")
        .lean();

      if (!membership) {
        throw new AppError("Membership not found or access denied", 404);
      }

      // Build filters for payments
      const filters: any = {
        userId: req.user._id,
        membershipId: membershipObjectId,
        isDeleted: { $ne: true },
      };

      // Filter by payment status
      if (status) {
        filters.status = status as PaymentStatus;
      }

      // Filter by payment method
      if (paymentMethod) {
        filters.paymentMethod = paymentMethod as PaymentMethod;
      }

      // Search functionality
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filters.$or = [
          { transactionId: regex },
          { gatewayTransactionId: regex },
          { gatewaySessionId: regex },
        ];
      }

      // Get transactions and total count
      const [transactions, total] = await Promise.all([
        Payments.find(filters)
          .select(
            "paymentMethod status amount currency transactionId gatewayTransactionId gatewaySessionId processedAt createdAt orderId metadata failureReason"
          )
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Payments.countDocuments(filters),
      ]);

      // Format transactions for response
      const formattedTransactions = transactions.map((payment: any) => ({
        id: payment._id,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        transactionId:
          payment.transactionId ||
          payment.gatewayTransactionId ||
          payment.gatewaySessionId ||
          null,
        amount: payment.amount?.amount ?? null,
        currency: payment.amount?.currency || payment.currency || "USD",
        taxRate: payment.amount?.taxRate ?? null,
        processedAt: payment.processedAt || payment.createdAt,
        createdAt: payment.createdAt,
        orderId: payment.orderId,
        failureReason: payment.failureReason || null,
        metadata: payment.metadata || {},
      }));

      // Add membership details to response
      const membershipDetails = {
        id: membership._id,
        planName: (membership as any).planSnapshot?.name || ((membership as any).planId as any)?.name || "Unknown Plan",
        status: membership.status,
        startedAt: membership.startedAt,
        expiresAt: membership.expiresAt,
        planPrice: (membership as any).planSnapshot?.price?.amount || ((membership as any).planId as any)?.price?.amount || 0,
        currency: (membership as any).planSnapshot?.price?.currency || ((membership as any).planId as any)?.price?.currency || "USD",
        interval: (membership as any).planSnapshot?.interval || ((membership as any).planId as any)?.interval || "Monthly",
      };

      // Response with pagination
      const pagination = getPaginationMeta(
        Number(page) || 1, 
        Number(limit) || 10, 
        total
      );

      res.apiPaginated(
        {
          membership: membershipDetails,
          transactions: formattedTransactions,
        } as any,
        pagination,
        "Membership transactions retrieved successfully"
      );
    }
  );
}

export const membershipController = new MembershipController();
