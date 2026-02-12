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
      const result = await subscriptionRenewalJob.processRenewals(limit);

      // Note: processRenewals currently returns void from the job,
      // so we only return a generic success message.
      // Detailed stats can be fetched via getRenewalJobStatus.
      res.apiSuccess(
        {
          message: "Subscription renewal job started successfully",
        },
        "Subscription renewal job started successfully"
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
        isOneTime: false,
        variantType: "SACHETS",
        selectedPlanDays: cycleDays,
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
        currency: "EUR",
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

      // Calculate dates - set nextBillingDate to today so it's due for renewal
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Start date: 30 days ago (so subscription has been running)
      const subscriptionStartDate = new Date(today);
      subscriptionStartDate.setDate(subscriptionStartDate.getDate() - cycleDays);
      
      // End date: today
      const subscriptionEndDate = new Date(today);
      
      // Next billing date: TODAY (so it's due for renewal)
      const nextBillingDate = new Date(today);
      
      // Next delivery date: today
      const nextDeliveryDate = new Date(today);
      
      // Initial delivery date: 30 days ago
      const initialDeliveryDate = new Date(subscriptionStartDate);

      // Create test subscription
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
        metadata: {
          isTestSubscription: true,
          createdForRenewalTesting: true,
          createdAt: now.toISOString(),
        },
      });

      logger.info(
        `Test subscription created: ${testSubscription.subscriptionNumber} (ID: ${testSubscription._id})`
      );

      let renewalResult = null;

      // Process renewal if requested
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
            
            // Refresh subscription to get updated data
            await testSubscription.populate("userId", "firstName lastName email");
            await testSubscription.populate("orderId", "orderNumber");
            
            logger.info(
              `Renewal processed for test subscription: ${testSubscription.subscriptionNumber}`
            );
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

      // Get renewal history if renewal was processed
      let renewalHistory = null;
      let transactionHistory = null;
      
      if (processRenewal && renewalResult?.success) {
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
      }

      // Refresh subscription to get latest data
      await testSubscription.populate("userId", "firstName lastName email");
      await testSubscription.populate("orderId", "orderNumber");

      res.apiSuccess(
        {
          subscription: testSubscription,
          order: testOrder,
          renewalResult: renewalResult,
          renewalHistory: renewalHistory,
          transactionHistory: transactionHistory,
          testInfo: {
            nextBillingDate: nextBillingDate.toISOString(),
            isDueForRenewal: nextBillingDate <= new Date(),
            cycleDays: cycleDays,
            renewalProcessed: processRenewal,
          },
        },
        `Test subscription created successfully${processRenewal ? " and renewal processed" : ""}`
      );
    }
  );
}

export const adminSubscriptionController = new AdminSubscriptionController();

