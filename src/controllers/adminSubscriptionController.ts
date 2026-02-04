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
import { User } from "@/models/core";
import { SubscriptionStatus } from "@/models/enums";
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

class AdminSubscriptionController {
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
    async (req: Request, res: Response): Promise<void> => {
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
                  title: item.productId.title,
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
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const subscription = await Subscriptions.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone")
        .populate("items.productId", "title slug description media")
        .populate("orderId", "orderNumber paymentStatus paymentMethod")
        .populate("cancelledBy", "firstName lastName email")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Get payment/transaction logs for this subscription
      // Payments are linked to orders, so we get payments for the subscription's order
      const orderId = subscription.orderId?._id || subscription.orderId;
      const payments = await Payments.find({
        orderId: orderId,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email")
        .sort({ createdAt: -1 })
        .lean();

      const user = subscription.userId as any;
      const isPopulatedUser =
        user && typeof user === "object" && user.firstName !== undefined;

      const transformedSubscription = {
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
              phone: user.phone,
              fullName: `${user.firstName} ${user.lastName}`.trim(),
            }
          : null,
        order: subscription.orderId
          ? {
              id: orderId,
              orderNumber: (subscription.orderId as any).orderNumber || null,
              paymentStatus: (subscription.orderId as any).paymentStatus || null,
              paymentMethod: (subscription.orderId as any).paymentMethod || null,
            }
          : null,
        items: subscription.items.map((item: any) => ({
          productId: item.productId?._id || item.productId,
          product: item.productId
            ? {
                id: item.productId._id,
                title: item.productId.title,
                slug: item.productId.slug,
                description: item.productId.description,
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
        payments: payments.map((payment: any) => ({
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
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
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
   */
  cancelSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        cancelAtEndDate,
        cancelImmediately,
        cancellationReason,
        customReason,
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

      // Check if already cancelled
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new AppError("Subscription is already cancelled", 400);
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

      // Update subscription
      const updateData: any = {
        status: SubscriptionStatus.CANCELLED,
        cancelledBy: adminId,
        cancellationReason: finalCancellationReason,
      };

      if (cancelImmediately) {
        updateData.cancelledAt = new Date();
        updateData.subscriptionEndDate = new Date();
      } else if (cancelAtEndDate) {
        // Cancel at end date - set cancelledAt to subscriptionEndDate
        updateData.cancelledAt = subscription.subscriptionEndDate || new Date();
        // Keep subscriptionEndDate as is
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
        `Subscription ${subscription.subscriptionNumber} cancelled by admin ${adminId}`
      );

      res.apiSuccess(
        null,
        `Subscription ${cancelImmediately ? "cancelled immediately" : "scheduled for cancellation at end date"} successfully`
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

      res.apiSuccess(null, "Subscription paused successfully");
    }
  );
}

export const adminSubscriptionController = new AdminSubscriptionController();

