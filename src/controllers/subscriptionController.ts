import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Subscriptions, Orders, Products } from "@/models/commerce";
import { User, Addresses } from "@/models/core";
import { Payments } from "@/models/commerce";
import {
  SubscriptionStatus,
  SubscriptionCycle,
  OrderPlanType,
  PaymentStatus,
  ProductVariant,
  OrderStatus,
  PaymentMethod,
} from "@/models/enums";
import { logger } from "@/utils/logger";
import { computeSubscriptionMetrics } from "@/services/subscriptionService";
import { getSubscriptionPriceFromProduct } from "@/utils/productSubscriptionPrice";
import { calculateMemberPrice } from "@/utils/membershipPrice";
import { getTranslatedString } from "@/utils/translationUtils";
import { SupportedLanguage } from "@/models/common.model";
import { paymentService } from "@/services/payment/PaymentService";
import { subscriptionAutoRenewalService } from "@/services/subscriptionAutoRenewalService";
import { cartService } from "@/services/cartService";
import { translateProductsForUser } from "@/services/productTranslationCommonService";
import { getSachetsPlanKey } from "@/config/planConfig";
import { SubscriptionChanges } from "@/models/commerce/subscriptionChanges.model";
import { config } from "@/config";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    email?: string;
    name?: string;
  };
}

class SubscriptionController {
  /**
   * Create subscription after checkout
   * @route POST /api/subscriptions
   * @access Private
   */
  createSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const {
        orderId,
        cycleDays,
        subscriptionStartDate,
        subscriptionEndDate,
        initialDeliveryDate,
        nextDeliveryDate,
        nextBillingDate,
        metadata,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate order exists and belongs to user
      const order = await Orders.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        userId,
        isDeleted: false,
      }).lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Validate order is a subscription order
      if (order.planType !== OrderPlanType.SUBSCRIPTION) {
        throw new AppError(
          "Subscription can only be created for subscription orders",
          400,
        );
      }

      // Validate payment is successful before creating subscription
      if (order.paymentStatus !== PaymentStatus.COMPLETED) {
        throw new AppError(
          "Subscription can only be created after payment is successful",
          400,
        );
      }

      // Validate cycle days (30, 60, 90, or 180 allowed)
      if (![30, 60, 90, 180].includes(cycleDays)) {
        throw new AppError("Cycle days must be 30, 60, 90, or 180 days", 400);
      }

      // Validate subscription start date
      const startDate = subscriptionStartDate
        ? new Date(subscriptionStartDate)
        : new Date();
      if (isNaN(startDate.getTime())) {
        throw new AppError("Invalid subscription start date", 400);
      }

      // Validate subscription end date if provided
      let endDate: Date | undefined;
      if (subscriptionEndDate) {
        endDate = new Date(subscriptionEndDate);
        if (isNaN(endDate.getTime())) {
          throw new AppError("Invalid subscription end date", 400);
        }
      }

      // Validate dates
      const initialDate = new Date(initialDeliveryDate);
      const nextDelDate = new Date(nextDeliveryDate);
      const nextBillDate = new Date(nextBillingDate);

      if (isNaN(initialDate.getTime())) {
        throw new AppError("Invalid initial delivery date", 400);
      }

      if (isNaN(nextDelDate.getTime())) {
        throw new AppError("Invalid next delivery date", 400);
      }

      if (isNaN(nextBillDate.getTime())) {
        throw new AppError("Invalid next billing date", 400);
      }

      // Check if subscription already exists for this order
      const existingSubscription = await Subscriptions.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        isDeleted: false,
      }).lean();

      if (existingSubscription) {
        throw new AppError("Subscription already exists for this order", 400);
      }

      // Use order items directly (they already have the correct structure)
      const subscriptionItems = order.items.map((item: any) => ({
        productId: new mongoose.Types.ObjectId(item.productId),
        product_id: item.productId, // Add product_id key
        name: item.name,
        planDays: item.planDays,
        capsuleCount: item.capsuleCount,
        amount: item.amount,
        discountedPrice: item.discountedPrice,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
        durationDays: item.durationDays,
        savingsPercentage: item.savingsPercentage,
        features: item.features || [],
      }));

      // Create subscription
      const subscription = await Subscriptions.create({
        userId,
        orderId: new mongoose.Types.ObjectId(orderId),
        planType: order.planType,
        cycleDays,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        items: subscriptionItems,
        initialDeliveryDate: initialDate,
        nextDeliveryDate: nextDelDate,
        nextBillingDate: nextBillDate,
        status: SubscriptionStatus.ACTIVE,
        isAutoRenew: true, // Enable auto-renewal by default
        renewalCount: 0, // Initial subscription is not a renewal
        metadata: {
          ...(metadata || {}),
        },
      });

      // Send subscription activated notification (only after payment success)
      // Payment status is COMPLETED (validated above), so subscription is activated
      try {
        const { subscriptionNotifications } =
          await import("@/utils/notificationHelpers");
        await subscriptionNotifications.subscriptionActivated(
          userId,
          String(subscription._id),
          subscription.subscriptionNumber,
          userId,
        );
        logger.info(
          `Subscription activated notification sent for subscription: ${subscription.subscriptionNumber} (payment successful)`,
        );
      } catch (error: any) {
        logger.error(
          `Failed to send subscription activated notification: ${error.message}`,
        );
        // Don't fail subscription creation if notification fails
      }

      logger.info(
        `Subscription created: ${subscription.subscriptionNumber} for order: ${orderId}`,
      );

      const derivedMetrics = computeSubscriptionMetrics(subscription);

      res.status(201).json({
        success: true,
        message: "Subscription created successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            orderId: subscription.orderId,
            status: subscription.status,
            planType: subscription.planType,
            cycleDays: subscription.cycleDays,
            subscriptionStartDate: subscription.subscriptionStartDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            items: subscription.items,
            initialDeliveryDate: subscription.initialDeliveryDate,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
            daysUntilNextDelivery: derivedMetrics.daysUntilNextDelivery,
            daysUntilNextBilling: derivedMetrics.daysUntilNextBilling,
            cycleCount: derivedMetrics.cycleCount,
            createdAt: subscription.createdAt,
          },
        },
      });
    },
  );

  getSubscriptionActivity = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }
      const { subscriptionId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);
      const options = getPaginationOptions(req);
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      }).lean();
      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }
      const fullLog = (subscription as any).activityLog || [];
      const sorted = fullLog.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const total = sorted.length;
      const items = sorted.slice(options.skip, options.skip + options.limit);
      res.status(200).json({
        success: true,
        message: "Subscription activity retrieved successfully",
        data: items,
        pagination: getPaginationMeta(options.page, options.limit, total),
      });
    }
  );

  /**
   * Get user's subscriptions
   * @route GET /api/subscriptions
   * @access Private
   */
  getSubscriptions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { status, lang } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Get language from query parameter or fall back to user language
      let userLang: SupportedLanguage = "en"; // Default
      if (lang && typeof lang === 'string') {
        const validLangs: SupportedLanguage[] = ['en', 'es', 'fr', 'nl', 'de'];
        if (validLangs.includes(lang as SupportedLanguage)) {
          userLang = lang as SupportedLanguage;
        }
      } else {
        // Fall back to user language from database
        try {
          const user = await User.findById(userId).select("language").lean();
          if (user?.language) {
            const languageMap: Record<string, SupportedLanguage> = {
              English: "en",
              Spanish: "es", 
              French: "fr",
              Dutch: "nl",
              German: "de",
            };
            userLang = languageMap[user.language] || "en";
          }
        } catch {
          // Ignore error and use default
        }
      }

      const paginationOptions = getPaginationOptions(req);
      const skip = (paginationOptions.page - 1) * paginationOptions.limit;

      // Build query
      const query: any = {
        userId,
        isDeleted: false,
      };

      if (status) {
        query.status = status;
      }

      // Get subscriptions
      const [subscriptions, total] = await Promise.all([
        Subscriptions.find(query)
          .populate(
            "orderId",
            "orderNumber status subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency",
          )
          .populate({
            path: "items.productId",
            select: "title slug description",
            model: Products,
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        Subscriptions.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(
        paginationOptions.page,
        paginationOptions.limit,
        total,
      );

      // Format response with translation
      const formattedSubscriptions = subscriptions.map((sub: any) => {
        const now = new Date();
        const daysUntilDelivery = sub.nextDeliveryDate
          ? Math.ceil(
              (sub.nextDeliveryDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
        const daysUntilBilling = sub.nextBillingDate
          ? Math.ceil(
              (sub.nextBillingDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;

        // Translate subscription items using product data
        const translatedItems = sub.items.map((item: any) => {
          let translatedName = item.name; // Default to stored name
          let translatedProductData = null;
          
          // Try to get translated name from product if available
          if (item.productId && typeof item.productId === 'object' && item.productId.title) {
            const productTitle = item.productId.title;
            if (typeof productTitle === 'object' && productTitle !== null) {
              // Product has I18n title, translate it
              translatedName = getTranslatedString(productTitle, userLang) || item.name;
              
              // Create translated product object with only requested language
              translatedProductData = {
                _id: item.productId._id,
                title: getTranslatedString(item.productId.title, userLang),
                slug: item.productId.slug,
                description: getTranslatedString(item.productId.description, userLang),
              };
            } else {
              // Product title is already a string, use as-is
              translatedName = productTitle;
              translatedProductData = {
                _id: item.productId._id,
                title: productTitle,
                slug: item.productId.slug,
                description: item.productId.description,
              };
            }
          }
          
          return {
            ...item,
            name: translatedName,
            productId: translatedProductData || item.productId, // Replace with translated data
            product_id: item.productId._id || item.productId, // Add product_id key
            // Keep other fields as-is
          };
        });

        return {
          id: sub._id,
          subscriptionNumber: sub.subscriptionNumber,
          orderId: sub.orderId,
          status: sub.status,
          planType: sub.planType,
          cycleDays: sub.cycleDays,
          subscriptionStartDate: sub.subscriptionStartDate,
          subscriptionEndDate: sub.subscriptionEndDate,
          items: translatedItems,
          initialDeliveryDate: sub.initialDeliveryDate,
          nextDeliveryDate: sub.nextDeliveryDate,
          nextBillingDate: sub.nextBillingDate,
          lastBilledDate: sub.lastBilledDate,
          lastDeliveredDate: sub.lastDeliveredDate,
          daysUntilNextDelivery: daysUntilDelivery,
          daysUntilNextBilling: daysUntilBilling,
          cancelledAt: sub.cancelledAt,
          pausedAt: sub.pausedAt,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        };
      });

      res.status(200).json({
        success: true,
        message: "Subscriptions retrieved successfully",
        data: formattedSubscriptions,
        pagination: paginationMeta,
      });
    },
  );

  /**
   * Get subscription details
   * @route GET /api/subscriptions/:subscriptionId
   * @access Private
   */
  getSubscriptionDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { lang } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Get language from query parameter or fall back to user language
      let userLang: SupportedLanguage = "en"; // Default
      if (lang && typeof lang === 'string') {
        const validLangs: SupportedLanguage[] = ['en', 'es', 'fr', 'nl', 'de'];
        if (validLangs.includes(lang as SupportedLanguage)) {
          userLang = lang as SupportedLanguage;
        }
      } else {
        // Fall back to user language from database
        try {
          const user = await User.findById(userId).select("language").lean();
          if (user?.language) {
            const languageMap: Record<string, SupportedLanguage> = {
              English: "en",
              Spanish: "es", 
              French: "fr",
              Dutch: "nl",
              German: "de",
            };
            userLang = languageMap[user.language] || "en";
          }
        } catch {
          // Ignore error and use default
        }
      }

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      })
        .populate(
          "orderId",
          "orderNumber status subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency",
        )
        .populate({
          path: "items.productId",
          select: "title slug description",
          model: Products,
        })
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      const now = new Date();
      const daysUntilDelivery = subscription.nextDeliveryDate
        ? Math.ceil(
            (subscription.nextDeliveryDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;
      const daysUntilBilling = subscription.nextBillingDate
        ? Math.ceil(
            (subscription.nextBillingDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      // Translate subscription items using product data
      const translatedItems = subscription.items.map((item: any) => {
        let translatedName = item.name; // Default to stored name
        let translatedProductData = null;
        
        // Try to get translated name from product if available
        if (item.productId && typeof item.productId === 'object' && item.productId.title) {
          const productTitle = item.productId.title;
          if (typeof productTitle === 'object' && productTitle !== null) {
            // Product has I18n title, translate it
            translatedName = getTranslatedString(productTitle, userLang) || item.name;
            
            // Create translated product object with only requested language
            translatedProductData = {
              _id: item.productId._id,
              title: getTranslatedString(item.productId.title, userLang),
              slug: item.productId.slug,
              description: getTranslatedString(item.productId.description, userLang),
            };
          } else {
            // Product title is already a string, use as-is
            translatedName = productTitle;
            translatedProductData = {
              _id: item.productId._id,
              title: productTitle,
              slug: item.productId.slug,
              description: item.productId.description,
            };
          }
        }
        
        return {
          ...item,
          name: translatedName,
          productId: translatedProductData || item.productId, // Replace with translated data
          product_id: item.productId._id || item.productId, // Add product_id key
          // Keep other fields as-is
        };
      });

      res.status(200).json({
        success: true,
        message: "Subscription details retrieved successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            orderId: subscription.orderId,
            status: subscription.status,
            planType: subscription.planType,
            cycleDays: subscription.cycleDays,
            subscriptionStartDate: subscription.subscriptionStartDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            items: translatedItems,
            initialDeliveryDate: subscription.initialDeliveryDate,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
            lastBilledDate: subscription.lastBilledDate,
            lastDeliveredDate: subscription.lastDeliveredDate,
            daysUntilNextDelivery: daysUntilDelivery,
            daysUntilNextBilling: daysUntilBilling,
            cancelledAt: subscription.cancelledAt,
            cancellationReason: subscription.cancellationReason,
            pausedAt: subscription.pausedAt,
            pausedUntil: subscription.pausedUntil,
            metadata: subscription.metadata,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
          },
        },
      });
    },
  );

  /**
   * Get subscription transaction history (membership payments for this subscription)
   * @route GET /api/subscriptions/:subscriptionId/transactions
   * @access Private
   * @query status (PaymentStatus), page, limit
   */
  getSubscriptionTransactionHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { status: statusFilter } = req.query as { status?: string };
      const userId = new mongoose.Types.ObjectId(req.user._id);
      const subId = new mongoose.Types.ObjectId(subscriptionId);

      const subscription = await Subscriptions.findOne({
        _id: subId,
        userId,
        isDeleted: false,
      })
        .select("orderId")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      const paginationOptions = getPaginationOptions(req);
      const skip = (paginationOptions.page - 1) * paginationOptions.limit;

      // Payments: either linked to this subscription (renewals) or initial order payment
      const paymentQuery: Record<string, unknown> = {
        userId,
        isDeleted: false,
        $or: [{ subscriptionId: subId }, { orderId: subscription.orderId }],
      };

      if (statusFilter) {
        paymentQuery.status = statusFilter;
      }

      const [payments, total] = await Promise.all([
        Payments.find(paymentQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        Payments.countDocuments(paymentQuery),
      ]);

      const paginationMeta = getPaginationMeta(
        paginationOptions.page,
        paginationOptions.limit,
        total,
      );

      const data = payments.map((p: any) => {
        const amount = p.amount;
        const value = amount?.amount ?? amount?.discountedPrice ?? 0;
        const currency = amount?.currency ?? "USD";
        const formattedAmount = `${currency === "USD" ? "$" : currency + " "}${Number(value).toFixed(2)}`;
        return {
          id: p._id,
          transactionId:
            p.transactionId ||
            p.gatewayTransactionId ||
            `TRN-${String(p._id).slice(-8).toUpperCase()}`,
          date: p.processedAt || p.createdAt,
          amount: formattedAmount,
          amountValue: value,
          currency,
          status: p.status,
          isRenewalPayment: p.isRenewalPayment ?? false,
        };
      });

      res.status(200).json({
        success: true,
        message: "Transaction history retrieved successfully",
        data,
        pagination: paginationMeta,
      });
    },
  );

  /**
   * Update subscription (for admin or system updates)
   * @route PUT /api/subscriptions/:subscriptionId
   * @access Private
   */
  updateSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const {
        status,
        nextDeliveryDate,
        nextBillingDate,
        pausedUntil,
        cancellationReason,
        metadata,
      } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Update fields
      if (status !== undefined) {
        subscription.status = status as SubscriptionStatus;
        if (status === SubscriptionStatus.CANCELLED) {
          subscription.cancelledAt = new Date();
          subscription.cancelledBy = userId;
        }
        if (status === SubscriptionStatus.PAUSED) {
          subscription.pausedAt = new Date();
        }
      }

      if (nextDeliveryDate !== undefined) {
        subscription.nextDeliveryDate = new Date(nextDeliveryDate);
      }

      if (nextBillingDate !== undefined) {
        subscription.nextBillingDate = new Date(nextBillingDate);
      }

      if (pausedUntil !== undefined) {
        subscription.pausedUntil = pausedUntil
          ? new Date(pausedUntil)
          : undefined;
      }

      if (cancellationReason !== undefined) {
        subscription.cancellationReason = cancellationReason?.trim();
      }

      if (metadata !== undefined) {
        subscription.metadata = { ...subscription.metadata, ...metadata };
      }

      await subscription.save();

      logger.info(`Subscription updated: ${subscriptionId} by user: ${userId}`);

      const derivedMetrics = computeSubscriptionMetrics(subscription);

      res.status(200).json({
        success: true,
        message: "Subscription updated successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            status: subscription.status,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
            daysUntilNextDelivery: derivedMetrics.daysUntilNextDelivery,
            daysUntilNextBilling: derivedMetrics.daysUntilNextBilling,
            updatedAt: subscription.updatedAt,
          },
        },
      });
    },
  );

  /**
   * Pause subscription
   * @route POST /api/subscriptions/:subscriptionId/pause
   * @access Private
   */
  pauseSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Check if subscription can be paused
      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new AppError("Cannot pause a cancelled subscription", 400);
      }

      if (subscription.status === SubscriptionStatus.EXPIRED) {
        throw new AppError("Cannot pause an expired subscription", 400);
      }

      if (subscription.status === SubscriptionStatus.PAUSED) {
        throw new AppError("Subscription is already paused", 400);
      }

      // Pause subscription
      const prevStatus = subscription.status;
      subscription.status = SubscriptionStatus.PAUSED;
      subscription.pausedAt = new Date();
      if (!subscription.activityLog) {
        (subscription as any).activityLog = [];
      }
      (subscription as any).activityLog.push({
        action: "pause",
        performedBy: userId,
        performedByRole: "User",
        fromStatus: prevStatus,
        toStatus: SubscriptionStatus.PAUSED,
        planCycleDays: subscription.cycleDays,
        planPriceTotal: subscription.pricing?.total ?? undefined,
        planCurrency: subscription.pricing?.currency ?? undefined,
        createdAt: new Date(),
      });

      await subscription.save();

      logger.info(`Subscription paused: ${subscriptionId} by user: ${userId}`);

      const derivedMetrics = computeSubscriptionMetrics(subscription);

      res.status(200).json({
        success: true,
        message: "Subscription paused successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            status: subscription.status,
            pausedAt: subscription.pausedAt,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
            daysUntilNextDelivery: derivedMetrics.daysUntilNextDelivery,
            daysUntilNextBilling: derivedMetrics.daysUntilNextBilling,
          },
        },
      });
    },
  );

  /**
   * Cancel subscription
   * @route POST /api/subscriptions/:subscriptionId/cancel
   * @access Private
   */
  cancelSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { cancellationReason } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new AppError("Subscription is already cancelled", 400);
      }

      // Cancel subscription
      const prevStatus = subscription.status;
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancelledBy = userId;
      if (cancellationReason) {
        subscription.cancellationReason = cancellationReason.trim();
      }
      if (!subscription.activityLog) {
        (subscription as any).activityLog = [];
      }
      (subscription as any).activityLog.push({
        action: "cancel",
        performedBy: userId,
        performedByRole: "User",
        reason: cancellationReason ? cancellationReason.trim() : undefined,
        fromStatus: prevStatus,
        toStatus: SubscriptionStatus.CANCELLED,
        planCycleDays: subscription.cycleDays,
        planPriceTotal: subscription.pricing?.total ?? undefined,
        planCurrency: subscription.pricing?.currency ?? undefined,
        createdAt: new Date(),
      });

      await subscription.save();

      logger.info(
        `Subscription cancelled: ${subscriptionId} by user: ${userId}`,
      );

      res.status(200).json({
        success: true,
        message: "Subscription cancelled successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            status: subscription.status,
            cancelledAt: subscription.cancelledAt,
            cancellationReason: subscription.cancellationReason,
          },
        },
      });
    },
  );

  /**
   * Subscription widget overview for user dashboard
   * @route GET /api/subscriptions/widget/overview
   * @access Private
   */
  getSubscriptionWidget = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const userId = new mongoose.Types.ObjectId(req.user._id);

      const subscription = await Subscriptions.findOne({
        userId,
        isDeleted: false,
        status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED] },
      })
        .sort({ nextBillingDate: 1, createdAt: -1 })
        .lean();

      if (!subscription) {
        res.status(200).json({
          success: true,
          message: "No active subscription",
          data: {
            widget: {
              hasActiveSubscription: false,
              headline:
                "Try Subscription Plans - Save more with scheduled deliveries",
              cta: {
                label: "Explore Plans",
                action: "explore-subscriptions",
              },
            },
          },
        });
        return;
      }

      const metrics = computeSubscriptionMetrics(subscription);
      const totalCycles =
        (subscription.metadata && subscription.metadata.totalCycles) || null;
      const currentCycleNumber = Math.max(1, (metrics.cycleCount ?? 0) + 1);

      res.status(200).json({
        success: true,
        message: "Subscription widget data retrieved successfully",
        data: {
          widget: {
            hasActiveSubscription: true,
            subscriptionId: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            status: subscription.status,
            cycleDays: subscription.cycleDays,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
            daysUntilNextDelivery: metrics.daysUntilNextDelivery,
            daysUntilNextBilling: metrics.daysUntilNextBilling,
            currentCycle: {
              current: currentCycleNumber,
              total: totalCycles,
              label: totalCycles
                ? `${Math.min(currentCycleNumber, totalCycles)}/${totalCycles}`
                : `${currentCycleNumber}`,
            },
            actions: {
              manage: {
                label: "Manage Plan",
                action: "manage-subscription",
                subscriptionId: subscription._id,
              },
              cancel: {
                label: "Cancel Plan",
                action: "cancel-subscription",
                subscriptionId: subscription._id,
              },
            },
          },
        },
      });
    },
  );

  /**
   * Add products to active subscription
   * @route POST /api/subscriptions/:subscriptionId/products
   * @access Private
   */
  addProductsToSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { productIds, paymentMethod, shippingAddressId, billingAddressId } =
        req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate payment method
      if (
        !paymentMethod ||
        !Object.values(PaymentMethod).includes(paymentMethod)
      ) {
        throw new AppError("Valid payment method is required", 400);
      }

      // Validate shipping address
      if (!shippingAddressId) {
        throw new AppError("Shipping address is required", 400);
      }

      // Verify shipping address belongs to user
      const shippingAddress = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(shippingAddressId),
        userId,
        isDeleted: false,
      });

      if (!shippingAddress) {
        throw new AppError(
          "Shipping address not found or does not belong to user",
          404,
        );
      }

      // Verify billing address if provided
      let billingAddress = null;
      if (billingAddressId) {
        billingAddress = await Addresses.findOne({
          _id: new mongoose.Types.ObjectId(billingAddressId),
          userId,
          isDeleted: false,
        });

        if (!billingAddress) {
          throw new AppError(
            "Billing address not found or does not belong to user",
            404,
          );
        }
      }

      // Find subscription
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Validate subscription is active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new AppError(
          "Products can only be added to active subscriptions",
          400,
        );
      }

      // Validate productIds
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError("At least one product ID is required", 400);
      }

      // Fetch products
      const productObjectIds = productIds.map(
        (id: string) => new mongoose.Types.ObjectId(id),
      );
      const products = await Products.find({
        _id: { $in: productObjectIds },
        isDeleted: false,
      }).lean();

      if (products.length !== productIds.length) {
        throw new AppError("One or more products are unavailable", 400);
      }

      // Check if products already exist in subscription
      const existingProductIds = subscription.items.map((item: any) =>
        item.productId.toString(),
      );
      const newProductIds = productIds.filter(
        (id: string) => !existingProductIds.includes(id),
      );

      if (newProductIds.length === 0) {
        throw new AppError("All products are already in the subscription", 400);
      }

      // Validate products support SACHETS variant (subscriptions only support SACHETS)
      const invalidProducts = products.filter(
        (product: any) => !product.sachetPrices,
      );
      if (invalidProducts.length > 0) {
        throw new AppError(
          "One or more products do not support subscription (SACHETS variant)",
          400,
        );
      }

      // Calculate pricing for new products
      const cycleDays = subscription.cycleDays;
      const user = await User.findById(userId).lean();

      const newItems: any[] = [];
      for (const product of products) {
        if (!newProductIds.includes(product._id.toString())) {
          continue; // Skip if already in subscription
        }

        // Get subscription price based on cycleDays
        const subscriptionPrice = getSubscriptionPriceFromProduct(
          product,
          cycleDays as SubscriptionCycle,
        );

        // Calculate member price if user is a member
        let finalPrice = subscriptionPrice.amount;
        let membershipDiscountAmount = 0;
        if (user) {
          const memberPriceResult = await calculateMemberPrice(product, user);
          if (
            memberPriceResult.isMember &&
            memberPriceResult.discountAmount > 0
          ) {
            finalPrice = memberPriceResult.memberPrice.amount;
            membershipDiscountAmount = memberPriceResult.discountAmount;
          }
        }

        // Calculate tax
        const taxAmount = finalPrice * (subscriptionPrice.taxRate || 0);

        // Get plan details based on cycleDays
        let planDays: number | undefined;
        let selectedPlan: any = null;

        switch (cycleDays) {
          case 30:
            selectedPlan = product.sachetPrices?.thirtyDays;
            planDays = 30;
            break;
          case 60:
            selectedPlan = product.sachetPrices?.sixtyDays;
            planDays = 60;
            break;
          case 90:
            selectedPlan = product.sachetPrices?.ninetyDays;
            planDays = 90;
            break;
          case 180:
            selectedPlan = product.sachetPrices?.oneEightyDays;
            planDays = 180;
            break;
        }

        if (!selectedPlan) {
          const productTitle =
            typeof product.title === "string"
              ? product.title
              : getTranslatedString(product.title, "en") ||
                product._id?.toString();
          throw new AppError(
            `Product ${productTitle} does not support ${cycleDays}-day subscription plan`,
            400,
          );
        }

        // Calculate subscription plan discount (15% for 90-day plan)
        let subscriptionPlanDiscountAmount = 0;
        if (cycleDays === 90) {
          subscriptionPlanDiscountAmount = finalPrice * 0.15;
        }

        // Total = discounted price (after membership discount) - subscription plan discount + tax
        const totalAmount =
          finalPrice - subscriptionPlanDiscountAmount + taxAmount;

        const productName =
          typeof product.title === "string"
            ? product.title
            : getTranslatedString(product.title, "en") ||
              getTranslatedString(product.title, "nl") ||
              product.slug ||
              "Product";

        const productIdString = product._id?.toString
          ? product._id.toString()
          : String(product._id || "");

        newItems.push({
          productId: new mongoose.Types.ObjectId(productIdString),
          name: productName,
          variantType: ProductVariant.SACHETS,
          planDays,
          capsuleCount: selectedPlan.capsuleCount,
          quantity: 1, // SACHETS always have quantity 1
          amount: Math.round(subscriptionPrice.amount * 100) / 100,
          discountedPrice: Math.round(finalPrice * 100) / 100,
          taxRate: subscriptionPrice.taxRate || 0,
          totalAmount: Math.round(totalAmount * 100) / 100,
          durationDays: selectedPlan.durationDays || planDays,
          savingsPercentage: selectedPlan.savingsPercentage,
          features: Array.isArray(selectedPlan.features)
            ? selectedPlan.features
            : [],
        });
      }

      // Calculate pricing for NEW items only (for order)
      const newItemsSubTotal = newItems.reduce(
        (sum: number, item: any) => sum + (item.amount || 0),
        0,
      );
      const newItemsDiscountedPrice = newItems.reduce(
        (sum: number, item: any) => sum + (item.discountedPrice || 0),
        0,
      );
      const newItemsMembershipDiscount = newItems.reduce(
        (sum: number, item: any) => {
          const itemDiscount = (item.amount || 0) - (item.discountedPrice || 0);
          return sum + Math.max(0, itemDiscount);
        },
        0,
      );
      const newItemsSubscriptionPlanDiscount =
        cycleDays === 90 ? newItemsDiscountedPrice * 0.15 : 0;
      const newItemsTaxAmount = newItems.reduce((sum: number, item: any) => {
        const itemTotal = item.discountedPrice || 0;
        return sum + itemTotal * (item.taxRate || 0);
      }, 0);
      const newItemsGrandTotal =
        newItemsDiscountedPrice -
        newItemsSubscriptionPlanDiscount +
        newItemsTaxAmount;

      // Generate order number
      const generateOrderNumber = (): string => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9000) + 1000;
        return `VTZ-${timestamp}-${random}`;
      };

      // Create order with new items
      const order = await Orders.create({
        orderNumber: generateOrderNumber(),
        userId,
        status: OrderStatus.PENDING,
        planType: OrderPlanType.SUBSCRIPTION,
        items: newItems,
        subTotal: Math.round(newItemsSubTotal * 100) / 100,
        discountedPrice: Math.round(newItemsDiscountedPrice * 100) / 100,
        couponDiscountAmount: 0,
        membershipDiscountAmount:
          Math.round(newItemsMembershipDiscount * 100) / 100,
        subscriptionPlanDiscountAmount:
          Math.round(newItemsSubscriptionPlanDiscount * 100) / 100,
        taxAmount: Math.round(newItemsTaxAmount * 100) / 100,
        grandTotal: Math.round(newItemsGrandTotal * 100) / 100,
        currency: subscription.pricing?.currency || "USD",
        pricing: {
          sachets: {
            subTotal: Math.round(newItemsSubTotal * 100) / 100,
            discountedPrice: Math.round(newItemsDiscountedPrice * 100) / 100,
            membershipDiscountAmount:
              Math.round(newItemsMembershipDiscount * 100) / 100,
            subscriptionPlanDiscountAmount:
              Math.round(newItemsSubscriptionPlanDiscount * 100) / 100,
            taxAmount: Math.round(newItemsTaxAmount * 100) / 100,
            total: Math.round(newItemsGrandTotal * 100) / 100,
            currency: subscription.pricing?.currency || "USD",
          },
          overall: {
            subTotal: Math.round(newItemsSubTotal * 100) / 100,
            discountedPrice: Math.round(newItemsDiscountedPrice * 100) / 100,
            couponDiscountAmount: 0,
            membershipDiscountAmount:
              Math.round(newItemsMembershipDiscount * 100) / 100,
            subscriptionPlanDiscountAmount:
              Math.round(newItemsSubscriptionPlanDiscount * 100) / 100,
            taxAmount: Math.round(newItemsTaxAmount * 100) / 100,
            grandTotal: Math.round(newItemsGrandTotal * 100) / 100,
            currency: subscription.pricing?.currency || "USD",
          },
        },
        shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
        billingAddressId: billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : undefined,
        paymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        metadata: {
          subscriptionId: (
            subscription._id as mongoose.Types.ObjectId
          ).toString(),
          subscriptionNumber: subscription.subscriptionNumber,
          isSubscriptionAddItems: true,
        },
      });

      // Create payment for the order
      const frontendUrl = config.frontend.url;
      const returnUrl = `${frontendUrl}/subscriptions/${subscriptionId}?payment=success`;
      const cancelUrl = `${frontendUrl}/subscriptions/${subscriptionId}?payment=cancelled`;

      const paymentResult = await paymentService.createPayment({
        orderId: (order._id as mongoose.Types.ObjectId).toString(),
        userId: userId.toString(),
        paymentMethod: paymentMethod as PaymentMethod,
        amount: {
          value: Math.round(newItemsGrandTotal * 100) / 100,
          currency: subscription.pricing?.currency || "USD",
        },
        description: `Payment for adding products to subscription ${subscription.subscriptionNumber}`,
        metadata: {
          subscriptionId: (
            subscription._id as mongoose.Types.ObjectId
          ).toString(),
          subscriptionNumber: subscription.subscriptionNumber,
          isSubscriptionAddItems: "true",
        },
        returnUrl,
        cancelUrl,
      });

      // Add new items to subscription
      subscription.items.push(...newItems);

      // Recalculate subscription pricing (for all items)
      const subTotal = subscription.items.reduce(
        (sum: number, item: any) => sum + (item.amount || 0),
        0,
      );
      const discountedPrice = subscription.items.reduce(
        (sum: number, item: any) => sum + (item.discountedPrice || 0),
        0,
      );

      // Calculate membership discount (difference between original and discounted price)
      const membershipDiscountAmount = subscription.items.reduce(
        (sum: number, item: any) => {
          const itemDiscount = (item.amount || 0) - (item.discountedPrice || 0);
          return sum + Math.max(0, itemDiscount);
        },
        0,
      );

      // Calculate subscription plan discount (15% for 90-day plan, applied to discounted price)
      const subscriptionPlanDiscountAmount =
        cycleDays === 90 ? discountedPrice * 0.15 : 0;

      // Calculate tax on discounted price (after membership discount, before subscription plan discount)
      const taxAmount = subscription.items.reduce((sum: number, item: any) => {
        const itemTotal = item.discountedPrice || 0;
        return sum + itemTotal * (item.taxRate || 0);
      }, 0);

      // Total = discounted price - subscription plan discount + tax
      const total =
        discountedPrice - subscriptionPlanDiscountAmount + taxAmount;

      // Update subscription pricing
      subscription.pricing = {
        subTotal: Math.round(subTotal * 100) / 100,
        discountedPrice: Math.round(discountedPrice * 100) / 100,
        membershipDiscountAmount:
          Math.round(membershipDiscountAmount * 100) / 100,
        subscriptionPlanDiscountAmount:
          Math.round(subscriptionPlanDiscountAmount * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        currency: subscription.pricing?.currency || "USD",
      };

      // Update subscription dates (start from today, end = start + cycleDays)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      subscription.subscriptionStartDate = today;

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + cycleDays);
      subscription.subscriptionEndDate = endDate;

      // Update next delivery and billing dates
      subscription.nextDeliveryDate = today;
      subscription.nextBillingDate = endDate;

      // Save subscription
      await subscription.save();

      logger.info(
        `Products added to subscription ${subscription.subscriptionNumber} by user ${userId}. Order ${order.orderNumber} created with payment.`,
      );

      res.status(200).json({
        success: true,
        message:
          "Products added to subscription successfully. Please complete payment.",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            items: subscription.items,
            pricing: subscription.pricing,
            subscriptionStartDate: subscription.subscriptionStartDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
          },
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            grandTotal: order.pricing?.overall?.grandTotal || 0,
            currency: order.pricing?.overall?.currency || "USD",
            paymentStatus: order.paymentStatus,
          },
          payment: {
            id: paymentResult.payment._id,
            status: paymentResult.payment.status,
            amount: paymentResult.payment.amount,
          },
          paymentLink: paymentResult.result.redirectUrl || null,
        },
      });
    },
  );

  /**
   * Remove products from active subscription
   * @route DELETE /api/subscriptions/:subscriptionId/products
   * @access Private
   */
  removeProductsFromSubscription = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { productIds } = req.body;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Find subscription
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Validate subscription is active
      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new AppError(
          "Products can only be removed from active subscriptions",
          400,
        );
      }

      // Validate productIds
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError("At least one product ID is required", 400);
      }

      // Check if products exist in subscription
      const existingProductIds = subscription.items.map((item: any) =>
        item.productId.toString(),
      );
      const productsToRemove = productIds.filter((id: string) =>
        existingProductIds.includes(id),
      );

      if (productsToRemove.length === 0) {
        throw new AppError(
          "None of the specified products are in the subscription",
          400,
        );
      }

      // Remove products from subscription items
      subscription.items = subscription.items.filter(
        (item: any) => !productIds.includes(item.productId.toString()),
      );

      // Validate at least one item remains
      if (subscription.items.length === 0) {
        throw new AppError(
          "Cannot remove all products from subscription. Cancel the subscription instead.",
          400,
        );
      }

      // Recalculate subscription pricing
      const cycleDays = subscription.cycleDays;
      const subTotal = subscription.items.reduce(
        (sum: number, item: any) => sum + (item.amount || 0),
        0,
      );
      const discountedPrice = subscription.items.reduce(
        (sum: number, item: any) => sum + (item.discountedPrice || 0),
        0,
      );

      // Calculate membership discount (difference between original and discounted price)
      const membershipDiscountAmount = subscription.items.reduce(
        (sum: number, item: any) => {
          const itemDiscount = (item.amount || 0) - (item.discountedPrice || 0);
          return sum + Math.max(0, itemDiscount);
        },
        0,
      );

      // Calculate subscription plan discount (15% for 90-day plan, applied to discounted price)
      const subscriptionPlanDiscountAmount =
        cycleDays === 90 ? discountedPrice * 0.15 : 0;

      // Calculate tax on discounted price (after membership discount, before subscription plan discount)
      const taxAmount = subscription.items.reduce((sum: number, item: any) => {
        const itemTotal = item.discountedPrice || 0;
        return sum + itemTotal * (item.taxRate || 0);
      }, 0);

      // Total = discounted price - subscription plan discount + tax
      const total =
        discountedPrice - subscriptionPlanDiscountAmount + taxAmount;

      // Update subscription pricing
      subscription.pricing = {
        subTotal: Math.round(subTotal * 100) / 100,
        discountedPrice: Math.round(discountedPrice * 100) / 100,
        membershipDiscountAmount:
          Math.round(membershipDiscountAmount * 100) / 100,
        subscriptionPlanDiscountAmount:
          Math.round(subscriptionPlanDiscountAmount * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        currency: subscription.pricing?.currency || "USD",
      };

      // Update subscription dates (start from today, end = start + cycleDays)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      subscription.subscriptionStartDate = today;

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + cycleDays);
      subscription.subscriptionEndDate = endDate;

      // Update next delivery and billing dates
      subscription.nextDeliveryDate = today;
      subscription.nextBillingDate = endDate;

      // Save subscription
      await subscription.save();

      logger.info(
        `Products removed from subscription ${subscription.subscriptionNumber} by user ${userId}`,
      );

      res.status(200).json({
        success: true,
        message: "Products removed from subscription successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            items: subscription.items,
            pricing: subscription.pricing,
            subscriptionStartDate: subscription.subscriptionStartDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            nextDeliveryDate: subscription.nextDeliveryDate,
            nextBillingDate: subscription.nextBillingDate,
          },
        },
      });
    },
  );

  /**
   * Get all shipping addresses for a subscription
   * @route GET /api/subscriptions/:subscriptionId/addresses
   * @access Private
   */
  getSubscriptionAddresses = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate subscription ID
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      // Find subscription and verify it belongs to user
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      }).lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Get all unique shipping address IDs from:
      // 1. Initial order (subscription.orderId)
      // 2. All renewal orders (metadata.subscriptionId)
      const addressIds = new Set<string>();

      // Get initial order's shipping address
      const initialOrder = await Orders.findOne({
        _id: subscription.orderId,
        isDeleted: false,
      })
        .select("shippingAddressId")
        .lean();

      if (initialOrder?.shippingAddressId) {
        addressIds.add(initialOrder.shippingAddressId.toString());
      }

      // Get all renewal orders' shipping addresses
      const renewalOrders = await Orders.find({
        "metadata.subscriptionId": subscriptionId,
        isDeleted: false,
      })
        .select("shippingAddressId")
        .lean();

      renewalOrders.forEach((order: any) => {
        if (order.shippingAddressId) {
          addressIds.add(order.shippingAddressId.toString());
        }
      });

      // Fetch all unique addresses
      const addressObjectIds = Array.from(addressIds).map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      const addresses = await Addresses.find({
        _id: { $in: addressObjectIds },
        userId,
        isDeleted: false,
      })
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();

      res.apiSuccess(
        { addresses },
        "Shipping addresses retrieved successfully",
      );
    },
  );

  /**
   * Test fast renewal for a subscription using existing auto-renewal flow
   * @route POST /api/subscriptions/:subscriptionId/test-renew
   * @access Private
   *
   * Flow:
   * - If delayMinutes > 0: only set subscription.nextBillingDate = now + delayMinutes
   *   (cron job will pick it up later).
   * - If delayMinutes === 0 (default): set nextBillingDate = now and call
   *   subscriptionAutoRenewalService.processRenewal(subscription) immediately.
   *
   * This uses the same renewal service that the cron job uses, so Stripe/Mollie
   * behavior is identical to real auto-renew.
   */
  testSubscriptionRenewal = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { delayMinutes = 0 } = req.body as { delayMinutes?: number };
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate subscription ID
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      // Find subscription and verify it belongs to user
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Only allow ACTIVE (or PAUSED) subscriptions
      if (
        subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== (SubscriptionStatus.PAUSED as SubscriptionStatus)
      ) {
        throw new AppError(
          "Test renewal is only allowed for active or paused subscriptions",
          400,
        );
      }

      // Set nextBillingDate based on delayMinutes
      const now = new Date();
      const nextBillingDate =
        delayMinutes && delayMinutes > 0
          ? new Date(now.getTime() + delayMinutes * 60 * 1000)
          : now;

      subscription.nextBillingDate = nextBillingDate;

      // For testing we keep nextDeliveryDate as-is; it will be recalculated
      // during renewal based on cycleDays.
      await subscription.save();

      // If delayMinutes > 0, we only prepare the subscription and let cron run later
      if (delayMinutes > 0) {
        res.apiSuccess(
          {
            subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
            nextBillingDate: subscription.nextBillingDate,
            message:
              "Subscription nextBillingDate updated; cron job will process renewal when due.",
          },
          "Test subscription renewal scheduled",
        );
        return;
      }

      // delayMinutes === 0 → trigger renewal immediately using the same service as cron
      const result = await subscriptionAutoRenewalService.processRenewal(subscription);

      res.apiSuccess(
        {
          subscriptionId: result.subscriptionId,
          renewalNumber: result.renewalNumber,
          paymentId: result.paymentId,
          orderId: result.orderId,
        },
        "Test subscription renewal processed successfully",
      );
    },
  );

  /**
   * Change shipping address for a subscription (affects future renewals)
   * @route POST /api/subscriptions/:subscriptionId/change-shipping-address
   * @access Private
   */
  changeSubscriptionShippingAddress = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { shippingAddressId } = req.body;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      // Validate subscription ID
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      // Validate shipping address ID
      if (!mongoose.Types.ObjectId.isValid(shippingAddressId)) {
        throw new AppError("Invalid shipping address ID format", 400);
      }

      // Find subscription and verify it belongs to user
      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      });

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Ensure subscription is active (optional: allow also PAUSED)
      if (
        subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== (SubscriptionStatus.PAUSED as SubscriptionStatus)
      ) {
        throw new AppError(
          "Shipping address can only be changed for active or paused subscriptions",
          400,
        );
      }

      // Validate that the new shipping address belongs to the user and is not deleted
      const address = await Addresses.findOne({
        _id: new mongoose.Types.ObjectId(shippingAddressId),
        userId,
        isDeleted: false,
      }).lean();

      if (!address) {
        throw new AppError(
          "Shipping address not found for this user",
          404,
        );
      }

      // Update subscription metadata with preferred shipping address ID
      const currentMetadata = (subscription.metadata || {}) as Record<string, any>;
      subscription.metadata = {
        ...currentMetadata,
        shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
      };

      await subscription.save();

       // Also update the base order's shipping address so future queries use the new address
       await Orders.updateOne(
         {
           _id: subscription.orderId,
           isDeleted: false,
         },
         {
           $set: {
             shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
           },
         },
       );

      res.apiSuccess(
        {
          subscriptionId: (subscription._id as mongoose.Types.ObjectId).toString(),
          shippingAddressId: shippingAddressId,
        },
        "Subscription shipping address updated successfully",
      );
    },
  );

  /**
   * Get products that are part of a subscription
   * @route GET /api/subscriptions/:subscriptionId/products
   * @access Private
   */
  getSubscriptionProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const userId = new mongoose.Types.ObjectId(req.user._id);

      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      }).lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      const productIds = (subscription.items || []).map(
        (item: any) => item.productId,
      );

      const rawProducts = productIds.length
        ? await Products.find({
            _id: { $in: productIds },
            isDeleted: false,
            status: true,
          }).lean()
        : [];

      // Translate products using common multi-language service
      const translatedProducts = await translateProductsForUser(rawProducts, req);

      const productMap = new Map(
        translatedProducts.map((p: any) => [p._id.toString(), p]),
      );

      const items = (subscription.items || []).map((item: any) => {
        const key = item.productId?.toString?.() || String(item.productId);
        const product = productMap.get(key) || null;

        return {
          productId: item.productId,
          name: item.name,
          variantType: item.variantType,
          planDays: item.planDays,
          capsuleCount: item.capsuleCount,
          amount: item.amount,
          discountedPrice: item.discountedPrice,
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          savingsPercentage: item.savingsPercentage,
          features: item.features || [],
          product,
        };
      });

      res.status(200).json({
        success: true,
        message: "Subscription products retrieved successfully",
        data: {
          subscriptionId: subscription._id,
          items,
        },
      });
    },
  );

  /**
   * Get products with status flags relative to a subscription and the user's cart
   * @route GET /api/subscriptions/:subscriptionId/products/status
   * @access Private
   * @query inSubscription (optional, "true" | "false")
   * @query inCart (optional, "true" | "false")
   */
  getSubscriptionProductsWithStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { inSubscription, inCart } = req.query as any;

      const userId = new mongoose.Types.ObjectId(req.user._id);

      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
      })
        .select("items")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      const subscriptionProductIds = new Set(
        (subscription.items || []).map((item: any) =>
          item.productId?.toString?.() || String(item.productId),
        ),
      );

      const cartProductIds = await cartService.getCartProductIds(userId.toString());

      const toBool = (val: any): boolean | undefined => {
        if (val === undefined) return undefined;
        if (typeof val === "boolean") return val;
        if (typeof val === "string") {
          if (val.toLowerCase() === "true") return true;
          if (val.toLowerCase() === "false") return false;
        }
        return undefined;
      };
      const filterInSubscription = toBool(inSubscription);
      const filterInCart = toBool(inCart);

      const rawProducts = await Products.find({
        isDeleted: false,
        status: true,
      }).lean();

      // Translate products using common multi-language service
      const translatedProducts = await translateProductsForUser(rawProducts, req);

      const cycleDaysNumber = Number((subscription as any).cycleDays) || 0;
      const planKey = getSachetsPlanKey(cycleDaysNumber);

      const filteredItems = translatedProducts
        .map((product: any) => {
          const id = product._id?.toString?.() || String(product._id);
          const isInSubscription = subscriptionProductIds.has(id);
          const isInCart = cartProductIds.has(id);

          // Derive subscription plan price for this product based on subscription cycleDays
          let subscriptionPrice: any = null;
          if (planKey && product.sachetPrices && product.sachetPrices[planKey]) {
            const plan = product.sachetPrices[planKey];
            const amount =
              plan.discountedPrice ||
              plan.amount ||
              plan.totalAmount ||
              0;
            subscriptionPrice = {
              currency: plan.currency || "USD",
              amount,
              taxRate: plan.taxRate || 0,
              totalAmount: amount + (plan.taxRate || 0),
              planDays: cycleDaysNumber,
            };
          }

          return {
            ...product,
            isInSubscription,
            isInCart,
            subscriptionPrice,
          };
        })
        .filter((item: any) => {
          if (
            filterInSubscription !== undefined &&
            item.isInSubscription !== filterInSubscription
          ) {
            return false;
          }
          if (filterInCart !== undefined && item.isInCart !== filterInCart) {
            return false;
          }
          return true;
        });

      const options = getPaginationOptions(req);
      const total = filteredItems.length;
      const paged = filteredItems.slice(options.skip, options.skip + options.limit);

      res.status(200).json({
        success: true,
        message: "Products retrieved successfully",
        data: paged,
        pagination: getPaginationMeta(options.page, options.limit, total),
      });
    },
  );

  /**
   * Prepare cart for subscription change:
   * - Only allowed if subscription is ACTIVE
   * - Only allowed within 10 days before subscriptionEndDate
   * - Adds given products to user's cart as SACHETS variant
   *
   * @route POST /api/subscriptions/:subscriptionId/plan-change/cart
   * @access Private
   * @body productIds: string[]
   */
  prepareSubscriptionChangeCart = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { subscriptionId } = req.params;
      const { productIds } = req.body as { productIds?: string[] };
      const userId = new mongoose.Types.ObjectId(req.user._id);

      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        throw new AppError("Invalid subscription ID format", 400);
      }

      // Basic body validation
      if (!Array.isArray(productIds) || productIds.length === 0) {
        throw new AppError("productIds array is required", 400);
      }

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      }).lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE) {
        throw new AppError(
          "Subscription must be active to prepare cart for plan change",
          400,
        );
      }

      if (!subscription.subscriptionEndDate) {
        throw new AppError(
          "Subscription end date is not configured for this subscription",
          400,
        );
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(subscription.subscriptionEndDate);
      endDate.setHours(0, 0, 0, 0);

      const diffMs = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Allow only if subscription ends in 0–10 days (inclusive)
      if (diffDays > 10 || diffDays < 0) {
        throw new AppError(
          "Subscription plan change cart can only be prepared within 10 days before the end date",
          400,
        );
      }

      // Add each product to cart as SACHETS, marked as subscription-change items
      let lastCart: any = null;
      for (const pid of productIds) {
        if (!mongoose.Types.ObjectId.isValid(pid)) {
          throw new AppError(`Invalid product ID: ${pid}`, 400);
        }

        const result = await cartService.addItem(userId.toString(), {
          productId: pid,
          variantType: ProductVariant.SACHETS,
          isSubscriptionChange: true,
        });

        lastCart = result.cart;
      }

      res.status(200).json({
        success: true,
        message:
          "Subscription change cart prepared successfully. Products added as SACHETS.",
        data: {
          cart: lastCart,
        },
      });
    },
  );
}

export const subscriptionController = new SubscriptionController();
