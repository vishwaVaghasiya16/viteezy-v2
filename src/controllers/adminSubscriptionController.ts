/**
 * @fileoverview Admin Subscription Controller
 * @description Controller for admin subscription operations
 * @module controllers/adminSubscriptionController
 */

import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { Subscriptions, Payments, Orders } from "@/models/commerce";
import { SubscriptionRenewalHistory } from "@/models/commerce/subscriptionRenewalHistory.model";
import { User } from "@/models/core";
import { SubscriptionStatus, OrderStatus, PaymentStatus, OrderPlanType, PaymentMethod } from "@/models/enums";
import { emailService } from "@/services/emailService";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
  };
}

const ensureObjectId = (id: string, label: string): mongoose.Types.ObjectId => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${label}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

// Helper function to extract language-specific value from multi-language objects
const getLanguageValue = (value: any, userLanguage: string = 'en'): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    // Try to get the user's preferred language first
    if (value[userLanguage]) {
      return value[userLanguage];
    }
    // Fallback to English if user's language is not available
    if (value.en) {
      return value.en;
    }
    // If English is not available, return the first available language
    const availableLanguages = Object.keys(value);
    if (availableLanguages.length > 0) {
      return value[availableLanguages[0]];
    }
  }
  return value || '';
};

class AdminSubscriptionController {
  /**
   * Calculate total from subscription items
   */
  private calculateFromItems(items: any[]): number {
    if (!items || items.length === 0) return 0;
    return items.reduce((total: number, item: any) => total + (item.totalAmount || 0), 0);
  }

  /**
   * Build overall pricing object from subscription items
   */
  private buildOverallFromItems(items: any): any {
    if (!items || items.length === 0) {
      return {
        subTotal: 0,
        discountedPrice: 0,
        membershipDiscountAmount: 0,
        subscriptionPlanDiscountAmount: 0,
        taxAmount: 0,
        total: 0,
        grandTotal: 0,
        currency: "USD",
      };
    }

    const subTotal = items.reduce((total: number, item: any) => total + (item.amount || 0), 0);
    const discountedPrice = items.reduce((total: number, item: any) => total + (item.discountedPrice || 0), 0);
    const totalAmount = items.reduce((total: number, item: any) => total + (item.totalAmount || 0), 0);
    const totalDiscount = subTotal - discountedPrice;
    const taxAmount = 0; // Assuming no tax for now

    return {
      subTotal: Math.round(subTotal * 100) / 100,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      membershipDiscountAmount: 0,
      subscriptionPlanDiscountAmount: Math.round(totalDiscount * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(totalAmount * 100) / 100,
      grandTotal: Math.round(totalAmount * 100) / 100,
      currency: "USD",
    };
  }
  /**
   * Get all subscriptions with pagination and filters
   * @route GET /api/v1/admin/subscriptions
   * @access Admin
   * @query {Number} [page] - Page number (default: 1)
   * @query {Number} [limit] - Items per page (default: 10)
   * @query {String} [search] - Search by subscription number, user firstName, lastName, product name, or subscription ID
   * @query {String} [status] - Filter by subscription status
   * @query {String} [startDate] - Filter subscriptions from date (ISO date string)
   * @query {String} [endDate] - Filter subscriptions to date (ISO date string)
   * @query {String} [userId] - Filter by user ID
   */
  getAllSubscriptions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const {
        search,
        status,
        startDate,
        endDate,
        userId,
      } = req.query as {
        search?: string;
        status?: SubscriptionStatus;
        startDate?: string;
        endDate?: string;
        userId?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: { $ne: true },
      };

      // Filter by status
      if (status) {
        filter.status = status;
      }

      // Filter by user ID
      if (userId) {
        filter.userId = ensureObjectId(userId, "user ID");
      }

      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          const fromDate = new Date(startDate);
          fromDate.setHours(0, 0, 0, 0);
          filter.createdAt.$gte = fromDate;
        }
        if (endDate) {
          const toDate = new Date(endDate);
          toDate.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = toDate;
        }
      }

      // Search filter - search by subscription number, user firstName, lastName, product name, or subscription ID
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        const searchLower = search.toLowerCase();

        // Check if search is a valid ObjectId (for subscription ID)
        const isObjectId = mongoose.Types.ObjectId.isValid(search);

        // Find user IDs matching firstName or lastName
        const matchingUsers = await User.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
          ],
        }).select("_id").lean();

        const userIds = matchingUsers.map((u) => u._id);

        // Find product IDs matching product name
        const { Products } = await import("@/models/commerce");
        const matchingProducts = await Products.find({
          title: searchRegex,
        }).select("_id").lean();

        const productIds = matchingProducts.map((p) => p._id);

        // Build search filter
        const searchConditions: any[] = [
          { subscriptionNumber: searchRegex },
        ];

        if (isObjectId) {
          searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
        }

        if (userIds.length > 0) {
          searchConditions.push({ userId: { $in: userIds } });
        }

        if (productIds.length > 0) {
          searchConditions.push({
            "items.productId": { $in: productIds },
          });
        }

        // Also search in items.name
        searchConditions.push({
          "items.name": searchRegex,
        });

        filter.$or = searchConditions;
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      // Get total count
      const total = await Subscriptions.countDocuments(filter);

      // Get admin user's language preference
      const adminUser = await User.findById(req.user?._id).select('language').lean();
      const adminLanguage = adminUser?.language || 'en';

      // Get subscriptions with pagination
      const subscriptions = await Subscriptions.find(filter)
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "title slug")
        .populate("orderId", "orderNumber")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform subscriptions for response
      const transformedSubscriptions = subscriptions.map((subscription: any) => {
        const user = subscription.userId as any;
        const isPopulatedUser =
          user && typeof user === "object" && user.firstName !== undefined;

        return {
          id: subscription._id,
          subscriptionNumber: subscription.subscriptionNumber,
          status: subscription.status,
          planType: subscription.planType,
          cycleDays: subscription.cycleDays,
          subscriptionStartDate: subscription.subscriptionStartDate,
          subscriptionEndDate: subscription.subscriptionEndDate,
          user: isPopulatedUser
            ? {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
              }
            : null,
          order: subscription.orderId
            ? {
                id: subscription.orderId._id || subscription.orderId,
                orderNumber:
                  (subscription.orderId as any).orderNumber || null,
              }
            : null,
          items: subscription.items.map((item: any) => ({
            productId: item.productId?._id || item.productId,
            product: item.productId
              ? {
                  id: item.productId._id,
                  title: getLanguageValue(item.productId.title, adminLanguage),
                  slug: item.productId.slug,
                }
              : null,
            name: item.name,
            amount: item.amount,
            discountedPrice: item.discountedPrice,
            totalAmount: item.totalAmount,
            durationDays: item.durationDays,
            capsuleCount: item.capsuleCount,
          })),
          initialDeliveryDate: subscription.initialDeliveryDate,
          nextDeliveryDate: subscription.nextDeliveryDate,
          nextBillingDate: subscription.nextBillingDate,
          lastBilledDate: subscription.lastBilledDate,
          lastDeliveredDate: subscription.lastDeliveredDate,
          cancelledAt: subscription.cancelledAt,
          cancelledBy: subscription.cancelledBy,
          cancellationReason: subscription.cancellationReason,
          pausedAt: subscription.pausedAt,
          pausedUntil: subscription.pausedUntil,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedSubscriptions,
        pagination,
        "Subscriptions retrieved successfully"
      );
    }
  );

  /**
   * Get subscription detail by ID with payment/transaction logs
   * @route GET /api/v1/admin/subscriptions/:id
   * @access Admin
   */
  getSubscriptionById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      // Get admin user's language preference
      const adminUser = await User.findById(req.user?._id).select('language').lean();
      const adminLanguage = adminUser?.language || 'en';

      const subscription = await Subscriptions.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone")
        .populate("items.productId", "title slug description media")
        .populate("orderId", "orderNumber paymentStatus paymentMethod overall")
        .populate("cancelledBy", "firstName lastName email")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Debug logging - detailed
      console.log('🔍 [DEBUG] Subscription userId:', JSON.stringify(subscription.userId, null, 2));
      console.log('🔍 [DEBUG] Subscription orderId:', JSON.stringify(subscription.orderId, null, 2));
      console.log('🔍 [DEBUG] Subscription items:', JSON.stringify(subscription.items, null, 2));
      console.log('🔍 [DEBUG] Full subscription object:', JSON.stringify(subscription, null, 2));

      // Get payment/transaction logs for this subscription
      // Get payments linked to subscription (renewal payments)
      const subscriptionId = subscription._id;
      const subscriptionPayments = await Payments.find({
        subscriptionId: subscriptionId,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email")
        .populate("orderId", "orderNumber status")
        .sort({ createdAt: -1 })
        .lean();

      // Also get initial payment from order
      const orderId = subscription.orderId?._id || subscription.orderId;
      const initialPayments = orderId
        ? await Payments.find({
            orderId: orderId,
            subscriptionId: { $exists: false }, // Initial payment, not renewal
            isDeleted: { $ne: true },
          })
            .populate("userId", "firstName lastName email")
            .sort({ createdAt: -1 })
            .lean()
        : [];

      // Combine all payments (initial + renewals)
      const allPayments = [...initialPayments, ...subscriptionPayments].sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Get renewal history
      const { subscriptionAutoRenewalService } = await import(
        "@/services/subscriptionAutoRenewalService"
      );
      const renewalHistory = await subscriptionAutoRenewalService.getRenewalHistory(
        (subscriptionId as mongoose.Types.ObjectId).toString(),
        50
      );

      // Get transaction history (all payments related to subscription)
      const transactionHistory = await subscriptionAutoRenewalService.getTransactionHistory(
        (subscriptionId as mongoose.Types.ObjectId).toString(),
        50
      );

      const user = subscription.userId as any;
      
      // Handle both populated and non-populated user data
      const isPopulatedUser = user && typeof user === "object" && user.firstName !== undefined;
      
      // If user is not populated, fetch user data
      let userData = null;
      if (isPopulatedUser) {
        userData = {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        };
      } else if (user) {
        // User is ObjectId, fetch user data
        const userDoc = await User.findById(user).select('firstName lastName email phone').lean();
        userData = userDoc ? {
          id: userDoc._id,
          firstName: userDoc.firstName,
          lastName: userDoc.lastName,
          email: userDoc.email,
          phone: userDoc.phone,
          fullName: `${userDoc.firstName || ''} ${userDoc.lastName || ''}`.trim(),
        } : null;
      }

      const transformedSubscription = {
        id: subscription._id,
        subscriptionNumber: subscription.subscriptionNumber,
        status: subscription.status,
        planType: subscription.planType,
        cycleDays: subscription.cycleDays,
        subscriptionStartDate: subscription.subscriptionStartDate,
        subscriptionEndDate: subscription.subscriptionEndDate,
        user: userData,
        order: subscription.orderId
          ? {
              id: orderId,
              orderNumber: (subscription.orderId as any).orderNumber || null,
              paymentStatus: (subscription.orderId as any).paymentStatus || null,
              paymentMethod: (subscription.orderId as any).paymentMethod || null,
              grandTotal: (subscription.orderId as any).overall?.grandTotal ?? (subscription.orderId as any).grandTotal ?? this.calculateFromItems(subscription.items),
              currency: (subscription.orderId as any).overall?.currency ?? (subscription.orderId as any).currency ?? "USD",
              overall: (subscription.orderId as any).overall || this.buildOverallFromItems(subscription.items) || null,
            }
          : null,
        items: subscription.items.map((item: any) => ({
          productId: item.productId?._id || item.productId,
          product: item.productId
            ? {
                id: item.productId._id,
                title: getLanguageValue(item.productId.title, adminLanguage),
                slug: item.productId.slug,
                description: getLanguageValue(item.productId.description, adminLanguage),
                media: item.productId.media,
              }
            : null,
          name: item.name,
          planDays: item.planDays,
          capsuleCount: item.capsuleCount,
          amount: item.amount,
          discountedPrice: item.discountedPrice,
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          savingsPercentage: item.savingsPercentage,
          features: item.features,
        })),
        initialDeliveryDate: subscription.initialDeliveryDate,
        nextDeliveryDate: subscription.nextDeliveryDate,
        nextBillingDate: subscription.nextBillingDate,
        lastBilledDate: subscription.lastBilledDate,
        lastDeliveredDate: subscription.lastDeliveredDate,
        cancelledAt: subscription.cancelledAt,
        cancelledBy: subscription.cancelledBy
          ? {
              id: (subscription.cancelledBy as any)._id,
              firstName: (subscription.cancelledBy as any).firstName,
              lastName: (subscription.cancelledBy as any).lastName,
              email: (subscription.cancelledBy as any).email,
            }
          : null,
        cancellationReason: subscription.cancellationReason,
        pausedAt: subscription.pausedAt,
        pausedUntil: subscription.pausedUntil,
        metadata: subscription.metadata,
        payments: allPayments.map((payment: any) => ({
          id: payment._id,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          gatewayTransactionId: payment.gatewayTransactionId,
          gatewaySessionId: payment.gatewaySessionId,
          failureReason: payment.failureReason,
          refundAmount: payment.refundAmount,
          refundReason: payment.refundReason,
          refundedAt: payment.refundedAt,
          processedAt: payment.processedAt,
          isRenewalPayment: payment.isRenewalPayment || false,
          renewalCycleNumber: payment.renewalCycleNumber || null,
          order: payment.orderId
            ? {
                id: payment.orderId._id || payment.orderId,
                orderNumber: (payment.orderId as any).orderNumber || null,
                status: (payment.orderId as any).status || null,
              }
            : null,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
        })),
        renewalHistory: renewalHistory.map((renewal: any) => ({
          id: renewal._id,
          renewalNumber: renewal.renewalNumber,
          previousBillingDate: renewal.previousBillingDate,
          newBillingDate: renewal.newBillingDate,
          previousDeliveryDate: renewal.previousDeliveryDate,
          newDeliveryDate: renewal.newDeliveryDate,
          payment: renewal.paymentId
            ? {
                id: renewal.paymentId._id || renewal.paymentId,
                status: (renewal.paymentId as any).status || null,
                amount: (renewal.paymentId as any).amount || null,
                currency: (renewal.paymentId as any).currency || null,
                transactionId: (renewal.paymentId as any).transactionId || null,
              }
            : null,
          order: renewal.orderId
            ? {
                id: renewal.orderId._id || renewal.orderId,
                orderNumber: (renewal.orderId as any).orderNumber || null,
                status: (renewal.orderId as any).status || null,
              }
            : null,
          amount: renewal.amount,
          status: renewal.status,
          renewalDate: renewal.renewalDate,
          failureReason: renewal.failureReason,
          retryCount: renewal.retryCount,
          nextRetryDate: renewal.nextRetryDate,
          createdAt: renewal.createdAt,
          updatedAt: renewal.updatedAt,
        })),
        transactionHistory: transactionHistory.map((transaction: any) => ({
          id: transaction._id,
          paymentMethod: transaction.paymentMethod,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          transactionId: transaction.transactionId,
          gatewayTransactionId: transaction.gatewayTransactionId,
          gatewaySessionId: transaction.gatewaySessionId,
          failureReason: transaction.failureReason,
          refundAmount: transaction.refundAmount,
          refundReason: transaction.refundReason,
          refundedAt: transaction.refundedAt,
          processedAt: transaction.processedAt,
          isRenewalPayment: transaction.isRenewalPayment || false,
          renewalCycleNumber: transaction.renewalCycleNumber || null,
          order: transaction.orderId
            ? {
                id: transaction.orderId._id || transaction.orderId,
                orderNumber: (transaction.orderId as any).orderNumber || null,
                status: (transaction.orderId as any).status || null,
              }
            : null,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
        })),
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      };

      res.apiSuccess(
        { subscription: transformedSubscription },
        "Subscription retrieved successfully"
      );
    }
  );

  /**
   * Cancel subscription by admin
   * @route POST /api/v1/admin/subscriptions/:id/cancel
   * @access Admin
   * @body {Boolean} cancelAtEndDate - Cancel at end date (toggle)
   * @body {Boolean} cancelImmediately - Cancel immediately (toggle)
   * @body {String} cancellationReason - Cancellation reason (required)
   * @body {String} [customReason] - Custom cancellation reason (required if cancellationReason is "Other")
   * @body {Date} [scheduledCancellationDate] - Specific date to cancel subscription (ISO date string)
   */
  cancelSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        cancelAtEndDate,
        cancelImmediately,
        cancellationReason,
        customReason,
        scheduledCancellationDate,
      } = req.body;

      const adminId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : null;

      const subscription = await Subscriptions.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Check if already cancelled or pending cancellation
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new AppError("Subscription is already cancelled", 400);
      }

      if (subscription.status === SubscriptionStatus.PENDING_CANCELLATION) {
        throw new AppError("Subscription is already pending cancellation", 400);
      }

      const user = subscription.userId as any;
      const isPopulatedUser =
        user && typeof user === "object" && user.firstName !== undefined;

      // Build cancellation reason text
      // If "Other" is selected, use customReason, otherwise use the selected reason
      const finalCancellationReason =
        cancellationReason === "Other" && customReason
          ? customReason.trim()
          : cancellationReason;

      let updateData: any;
      let responseMessage: string;

      if (cancelImmediately) {
        // Cancel immediately
        updateData = {
          status: SubscriptionStatus.CANCELLED,
          cancelledBy: adminId,
          cancellationReason: finalCancellationReason,
          cancelledAt: new Date(),
          subscriptionEndDate: new Date(),
          scheduledCancellationDate: null, // Clear scheduled date if any
        };
        responseMessage = "cancelled immediately";
      } else if (scheduledCancellationDate) {
        // Cancel on specific future date
        const cancellationDate = new Date(scheduledCancellationDate);
        const now = new Date();

        if (cancellationDate <= now) {
          throw new AppError("Scheduled cancellation date must be in the future", 400);
        }

        updateData = {
          status: SubscriptionStatus.PENDING_CANCELLATION,
          cancelledBy: adminId,
          cancellationReason: finalCancellationReason,
          scheduledCancellationDate: cancellationDate,
        };
        responseMessage = `scheduled for cancellation on ${cancellationDate.toISOString().split('T')[0]}`;
      } else if (cancelAtEndDate) {
        // Cancel at subscription end date
        const endDate = subscription.subscriptionEndDate || new Date();
        
        if (endDate <= new Date()) {
          // If end date is in the past or today, cancel immediately
          updateData = {
            status: SubscriptionStatus.CANCELLED,
            cancelledBy: adminId,
            cancellationReason: finalCancellationReason,
            cancelledAt: new Date(),
            subscriptionEndDate: endDate,
            scheduledCancellationDate: null,
          };
          responseMessage = "cancelled immediately (subscription end date already passed)";
        } else {
          // Schedule for end date
          updateData = {
            status: SubscriptionStatus.PENDING_CANCELLATION,
            cancelledBy: adminId,
            cancellationReason: finalCancellationReason,
            scheduledCancellationDate: endDate,
          };
          responseMessage = `scheduled for cancellation on ${endDate.toISOString().split('T')[0]}`;
        }
      } else if (cancelImmediately === false) {
        // When cancelImmediately is explicitly false, always set to PENDING_CANCELLATION
        const endDate = subscription.subscriptionEndDate || new Date();
        
        // Always set to PENDING_CANCELLATION when cancelImmediately is false
        // The automated job will handle the transition to CANCELLED when end date is reached
        updateData = {
          status: SubscriptionStatus.PENDING_CANCELLATION,
          cancelledBy: adminId,
          cancellationReason: finalCancellationReason,
          scheduledCancellationDate: endDate, // Use subscription end date
        };
        responseMessage = `scheduled for cancellation on ${endDate.toISOString().split('T')[0]}`;
      } else {
        throw new AppError("Either cancelImmediately, cancelAtEndDate, or scheduledCancellationDate must be provided", 400);
      }

      await Subscriptions.updateOne({ _id: id }, updateData);

      // Send email notification to user
      if (isPopulatedUser && user.email) {
        const userName = `${user.firstName} ${user.lastName}`.trim();
        const emailSent = await emailService.sendSubscriptionCancellationEmail(
          user.email,
          userName,
          {
            subscriptionNumber: subscription.subscriptionNumber,
            cancellationReason: finalCancellationReason,
            cancelledAt: updateData.cancelledAt,
            cancelledImmediately: cancelImmediately,
            scheduledCancellationDate: updateData.scheduledCancellationDate,
          }
        );

        if (emailSent) {
          logger.info(
            `Subscription cancellation email sent to ${user.email} for subscription ${subscription.subscriptionNumber}`
          );
        } else {
          logger.warn(
            `Failed to send subscription cancellation email to ${user.email}`
          );
        }
      }

      logger.info(
        `Subscription ${subscription.subscriptionNumber} ${responseMessage} by admin ${adminId}`
      );

      res.apiSuccess(
        null,
        `Subscription ${responseMessage} successfully`
      );
    }
  );

  /**
   * Pause subscription by admin
   * @route POST /api/v1/admin/subscriptions/:id/pause
   * @access Admin
   */
  pauseSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const subscription = await Subscriptions.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Check if already paused
      if (subscription.status === SubscriptionStatus.PAUSED) {
        throw new AppError("Subscription is already paused", 400);
      }

      // Check if cancelled
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new AppError("Cannot pause a cancelled subscription", 400);
      }

      const user = subscription.userId as any;
      const isPopulatedUser =
        user && typeof user === "object" && user.firstName !== undefined;

      // Update subscription status to paused
      await Subscriptions.updateOne(
        { _id: id },
        {
          status: SubscriptionStatus.PAUSED,
          pausedAt: new Date(),
        }
      );

      // Send email notification to user
      if (isPopulatedUser && user.email) {
        const userName = `${user.firstName} ${user.lastName}`.trim();
        const emailSent = await emailService.sendSubscriptionPauseEmail(
          user.email,
          userName,
          {
            subscriptionNumber: subscription.subscriptionNumber,
            pausedAt: new Date(),
          }
        );

        if (emailSent) {
          logger.info(
            `Subscription pause email sent to ${user.email} for subscription ${subscription.subscriptionNumber}`
          );
        } else {
          logger.warn(
            `Failed to send subscription pause email to ${user.email}`
          );
        }
      }

      logger.info(
        `Subscription ${subscription.subscriptionNumber} paused by admin`
      );

      res.apiSuccess(null, "Subscription paused successfully"      );
    }
  );

  /**
   * Process auto-renewals for due subscriptions (Admin only)
   * @route POST /api/v1/admin/subscriptions/process-renewals
   * @access Admin
   * @query {Number} [limit] - Maximum number of subscriptions to process (default: 100)
   */
  processRenewals = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const limit = parseInt(req.query.limit as string) || 100;

      const { subscriptionRenewalJob } = await import("@/jobs/subscriptionRenewalJob");
      await subscriptionRenewalJob.processRenewals(limit);
      const status = subscriptionRenewalJob.getStatus();

      res.apiSuccess(
        {
          message: "Subscription renewal job completed",
          isRunning: status.isRunning,
          lastRunDate: status.lastRunDate,
          result: status.lastRunResult
            ? {
                processed: status.lastRunResult.processed,
                successful: status.lastRunResult.successful,
                failed: status.lastRunResult.failed,
                results: status.lastRunResult.results,
              }
            : null,
        },
        "Subscription renewal job completed"
      );
    }
  );

  /**
   * Get renewal history for a subscription (Admin only)
   * @route GET /api/v1/admin/subscriptions/:id/renewal-history
   * @access Admin
   */
  getRenewalHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const { subscriptionAutoRenewalService } = await import(
        "@/services/subscriptionAutoRenewalService"
      );
      const history = await subscriptionAutoRenewalService.getRenewalHistory(id, limit);

      res.apiSuccess({ history }, "Renewal history retrieved successfully");
    }
  );

  /**
   * Get transaction history for a subscription (Admin only)
   * @route GET /api/v1/admin/subscriptions/:id/transaction-history
   * @access Admin
   */
  getTransactionHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const { subscriptionAutoRenewalService } = await import(
        "@/services/subscriptionAutoRenewalService"
      );
      const transactions = await subscriptionAutoRenewalService.getTransactionHistory(
        id,
        limit
      );

      res.apiSuccess(
        { transactions },
        "Transaction history retrieved successfully"
      );
    }
  );

  /**
   * Get renewal job status (Admin only)
   * @route GET /api/v1/admin/subscriptions/renewal-job/status
   * @access Admin
   */
  getRenewalJobStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { subscriptionRenewalJob } = await import("@/jobs/subscriptionRenewalJob");
      const status = subscriptionRenewalJob.getStatus();

      res.apiSuccess({ status }, "Renewal job status retrieved successfully");
    }
  );

  /**
   * Create test subscription for renewal testing (Admin only)
   * @route POST /api/v1/admin/subscriptions/test-renewal
   * @access Admin
   * @body {String} userId - User ID for the test subscription
   * @body {Number} [cycleDays] - Cycle days (30, 60, 90, 180) - default: 30
   * @body {Boolean} [processRenewal] - Whether to process renewal immediately - default: true
   */
  createTestSubscriptionForRenewal = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { userId, cycleDays = 30, processRenewal = true } = req.body;

      if (!userId) {
        throw new AppError("userId is required", 400);
      }

      const validCycleDays = [30, 60, 90, 180];
      if (!validCycleDays.includes(cycleDays)) {
        throw new AppError("cycleDays must be 30, 60, 90, or 180", 400);
      }

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Create a dummy order for the subscription
      const testOrder = await Orders.create({
        orderNumber: `TEST-${Date.now()}`,
        userId: new mongoose.Types.ObjectId(userId),
        planType: OrderPlanType.SUBSCRIPTION,
        items: [
          {
            productId: new mongoose.Types.ObjectId(), // Dummy product ID
            name: "Test Product for Renewal",
            planDays: cycleDays,
            capsuleCount: 30,
            amount: 49.99,
            discountedPrice: 39.99,
            taxRate: 0.21,
            totalAmount: 48.39,
            durationDays: cycleDays,
            savingsPercentage: 20,
            features: ["Test Feature"],
          },
        ],
        subTotal: 49.99,
        discountedPrice: 39.99,
        taxAmount: 8.39,
        grandTotal: 48.39,
        currency: "USD",
        shippingAddressId: new mongoose.Types.ObjectId(), // Dummy address
        billingAddressId: new mongoose.Types.ObjectId(), // Dummy address
        paymentMethod: PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.CONFIRMED,
        metadata: {
          isTestOrder: true,
          createdForRenewalTesting: true,
        },
      });

      // Create a test payment for the order (required for renewal processing)
      const testPayment = await Payments.create({
        orderId: testOrder._id,
        userId: new mongoose.Types.ObjectId(userId),
        paymentMethod: PaymentMethod.STRIPE,
        status: PaymentStatus.COMPLETED,
        amount: {
          amount: 48.39,
          currency: "USD",
          taxRate: 0.21,
        },
        currency: "USD",
        gatewayTransactionId: `TEST_TXN_${Date.now()}_${testOrder._id}`,
        gatewaySessionId: `TEST_SESSION_${Date.now()}_${testOrder._id}`,
        transactionId: `TEST_TXN_${Date.now()}_${testOrder._id}`,
        processedAt: new Date(),
        gatewayResponse: {
          test: true,
          autoCompleted: true,
          metadata: {
            isTestPayment: true,
            createdForRenewalTesting: true,
          },
        },
        metadata: {
          isTestPayment: true,
          createdForRenewalTesting: true,
        },
      });

      logger.info(
        `Test payment created: ${testPayment._id} for order: ${testOrder.orderNumber}`
      );

      // Calculate dates - set nextBillingDate to today so it's due for renewal
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Start date: cycleDays ago (so subscription has been running)
      const subscriptionStartDate = new Date(today);
      subscriptionStartDate.setDate(subscriptionStartDate.getDate() - cycleDays);
      
      // End date: today
      const subscriptionEndDate = new Date(today);
      
      // Next billing date: TODAY (so it's due for renewal)
      const nextBillingDate = new Date(today);
      
      // Next delivery date: today
      const nextDeliveryDate = new Date(today);
      
      // Initial delivery date: cycleDays ago
      const initialDeliveryDate = new Date(subscriptionStartDate);

      // Create gateway subscription (Stripe/Mollie) for auto-renewal
      const { subscriptionGatewayService } = await import("@/services/subscriptionGatewayService");
      const totalAmount = (testOrder.pricing?.overall?.grandTotal || 0) * 100; // Convert to cents
      
      const gatewayResult = await subscriptionGatewayService.createSubscription({
        userId: userId,
        orderId: (testOrder._id as mongoose.Types.ObjectId).toString(),
        paymentMethod: PaymentMethod.STRIPE, // Use Stripe for test
        amount: totalAmount,
        currency: testOrder.pricing?.overall?.currency || "USD",
        cycleDays: cycleDays,
        customerEmail: user.email,
        customerName: `${user.firstName} ${user.lastName}`.trim(),
        metadata: {
          isTestSubscription: "true",
          createdForRenewalTesting: "true",
          orderNumber: testOrder.orderNumber,
        },
      });

      if (!gatewayResult.success) {
        logger.warn(`Failed to create gateway subscription: ${gatewayResult.error}`);
        // Continue without gateway subscription for testing purposes
      }

      // Create test subscription with gateway subscription details
      const testSubscription = await Subscriptions.create({
        userId: new mongoose.Types.ObjectId(userId),
        orderId: testOrder._id,
        planType: OrderPlanType.SUBSCRIPTION,
        cycleDays: cycleDays,
        subscriptionStartDate: subscriptionStartDate,
        subscriptionEndDate: subscriptionEndDate,
        items: [
          {
            productId: new mongoose.Types.ObjectId(), // Dummy product ID
            name: "Test Product for Renewal",
            planDays: cycleDays,
            capsuleCount: 30,
            amount: 49.99,
            discountedPrice: 39.99,
            taxRate: 0.21,
            totalAmount: 48.39,
            durationDays: cycleDays,
            savingsPercentage: 20,
            features: ["Test Feature"],
          },
        ],
        initialDeliveryDate: initialDeliveryDate,
        nextDeliveryDate: nextDeliveryDate,
        nextBillingDate: nextBillingDate, // Set to today - due for renewal
        status: SubscriptionStatus.ACTIVE,
        isAutoRenew: true,
        renewalCount: 0,
        // Gateway subscription details
        gatewaySubscriptionId: gatewayResult.gatewaySubscriptionId || undefined,
        gatewayCustomerId: gatewayResult.gatewayCustomerId || undefined,
        gatewayPaymentMethodId: gatewayResult.gatewayPaymentMethodId || undefined,
        cancelAtPeriodEnd: false,
        retryCount: 0,
        metadata: {
          isTestSubscription: true,
          createdForRenewalTesting: true,
          createdAt: now.toISOString(),
          gatewaySubscriptionCreated: gatewayResult.success,
          gatewayError: gatewayResult.error || undefined,
        },
      });

      logger.info(
        `Test subscription created: ${testSubscription.subscriptionNumber} (ID: ${testSubscription._id})`
      );

      if (gatewayResult.success) {
        logger.info(
          `Gateway subscription created: ${gatewayResult.gatewaySubscriptionId} for test subscription: ${testSubscription.subscriptionNumber}`
        );
      } else {
        logger.warn(
          `Gateway subscription creation failed for test subscription: ${testSubscription.subscriptionNumber}. Error: ${gatewayResult.error}`
        );
      }

      // Create initial renewal history record for the test subscription
      // This represents the initial subscription payment (renewalNumber: 0)
      let initialRenewalHistory = null;
      try {
        initialRenewalHistory = await SubscriptionRenewalHistory.create({
          subscriptionId: testSubscription._id as mongoose.Types.ObjectId,
          userId: new mongoose.Types.ObjectId(userId),
          renewalNumber: 0, // 0 represents the initial subscription payment
          previousBillingDate: subscriptionStartDate, // No previous billing for initial
          newBillingDate: nextBillingDate, // First billing date
          previousDeliveryDate: subscriptionStartDate, // No previous delivery for initial
          newDeliveryDate: initialDeliveryDate, // First delivery date
          paymentId: testPayment._id as mongoose.Types.ObjectId,
          orderId: testOrder._id as mongoose.Types.ObjectId,
          amount: {
            amount: testOrder.pricing?.overall?.grandTotal || 0,
            currency: testOrder.pricing?.overall?.currency || "USD",
            taxRate: testOrder.items[0]?.taxRate || 0.21,
          },
          status: PaymentStatus.COMPLETED,
          renewalDate: now,
          retryCount: 0,
          metadata: {
            isTestSubscription: true,
            isInitialPayment: true,
            createdForRenewalTesting: true,
            cycleDays: cycleDays,
          },
        });

        logger.info(
          `Initial renewal history record created for test subscription: ${testSubscription.subscriptionNumber} (Renewal #0)`
        );
      } catch (renewalHistoryError: any) {
        logger.error(
          `Failed to create initial renewal history record: ${renewalHistoryError.message}`
        );
        // Continue even if renewal history creation fails
      }

      let renewalResult = null;
      let renewalPayment = null;

      // Process renewal if requested
      // For testing purposes, always process a renewal to create renewal history record
      if (processRenewal) {
        try {
          const { subscriptionAutoRenewalService } = await import(
            "@/services/subscriptionAutoRenewalService"
          );
          
          // Fetch the subscription as a document (not lean) for renewal processing
          const subscriptionDoc = await Subscriptions.findById(testSubscription._id);
          if (subscriptionDoc) {
            renewalResult = await subscriptionAutoRenewalService.processRenewal(
              subscriptionDoc
            );
            
            // Fetch the renewal payment record if renewal was successful
            if (renewalResult?.success && renewalResult?.paymentId) {
              renewalPayment = await Payments.findById(renewalResult.paymentId);
              
              // Update payment metadata to mark it as test payment
              if (renewalPayment) {
                renewalPayment.metadata = {
                  ...(renewalPayment.metadata || {}),
                  isTestPayment: true,
                  isRenewalPayment: true,
                  createdForRenewalTesting: true,
                  subscriptionNumber: testSubscription.subscriptionNumber,
                };
                await renewalPayment.save();
                
                logger.info(
                  `Renewal payment record updated with test metadata: ${renewalPayment._id}`
                );
              }
            }
            
            // Refresh subscription to get updated data
            await testSubscription.populate("userId", "firstName lastName email");
            await testSubscription.populate("orderId", "orderNumber");
            
            if (gatewayResult.success && gatewayResult.gatewaySubscriptionId) {
              logger.info(
                `Test renewal processed for subscription: ${testSubscription.subscriptionNumber}. ` +
                `Gateway subscription exists (${gatewayResult.gatewaySubscriptionId}). ` +
                `Future renewals will be handled automatically via webhooks.`
              );
            } else {
              logger.info(
                `Manual renewal processed for test subscription: ${testSubscription.subscriptionNumber}`
              );
            }
          }
        } catch (renewalError: any) {
          logger.error(
            `Failed to process renewal for test subscription: ${renewalError.message}`
          );
          renewalResult = {
            success: false,
            error: renewalError.message,
          };
        }
      }

      // Get renewal history (includes initial record + any processed renewals)
      let renewalHistory = null;
      let transactionHistory = null;
      
      try {
        const { subscriptionAutoRenewalService } = await import(
          "@/services/subscriptionAutoRenewalService"
        );
        const subscriptionId = (testSubscription._id as mongoose.Types.ObjectId).toString();
        renewalHistory = await subscriptionAutoRenewalService.getRenewalHistory(
          subscriptionId,
          10
        );
        transactionHistory = await subscriptionAutoRenewalService.getTransactionHistory(
          subscriptionId,
          10
        );
      } catch (error: any) {
        logger.warn(`Failed to fetch renewal/transaction history: ${error.message}`);
      }

      // Refresh subscription to get latest data
      await testSubscription.populate("userId", "firstName lastName email");
      await testSubscription.populate("orderId", "orderNumber");

      // Refresh subscription to get latest data including gateway details
      await testSubscription.populate("userId", "firstName lastName email");
      await testSubscription.populate("orderId", "orderNumber");

      res.apiSuccess(
        {
          subscription: testSubscription,
          order: testOrder,
          payment: testPayment,
          renewalPayment: renewalPayment,
          gatewaySubscription: gatewayResult.success ? {
            gatewaySubscriptionId: gatewayResult.gatewaySubscriptionId,
            gatewayCustomerId: gatewayResult.gatewayCustomerId,
            gatewayPaymentMethodId: gatewayResult.gatewayPaymentMethodId,
            success: true,
          } : {
            success: false,
            error: gatewayResult.error,
          },
          renewalResult: renewalResult,
          initialRenewalHistory: initialRenewalHistory,
          renewalHistory: renewalHistory,
          transactionHistory: transactionHistory,
          testInfo: {
            nextBillingDate: nextBillingDate.toISOString(),
            isDueForRenewal: nextBillingDate <= new Date(),
            cycleDays: cycleDays,
            renewalProcessed: processRenewal,
            gatewaySubscriptionCreated: gatewayResult.success,
            note: gatewayResult.success 
              ? "Gateway subscription created. Renewals will be handled automatically via webhooks (invoice.paid, invoice.payment_failed, etc.)"
              : "Gateway subscription creation failed. Manual renewal will be used for testing.",
          },
        },
        `Test subscription created successfully${gatewayResult.success ? " with gateway subscription" : ""}${processRenewal ? " and renewal processed" : ""}`
      );
    }
  );
}

export const adminSubscriptionController = new AdminSubscriptionController();

