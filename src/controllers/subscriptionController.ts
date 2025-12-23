import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Subscriptions, Orders, Products } from "@/models/commerce";
import {
  SubscriptionStatus,
  SubscriptionCycle,
  OrderPlanType,
} from "@/models/enums";
import { logger } from "@/utils/logger";
import { computeSubscriptionMetrics } from "@/services/subscriptionService";
import { calculateRecurringBillingAmount } from "@/utils/productSubscriptionPrice";

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
        items,
        amount,
        paymentMethod,
        gatewaySubscriptionId,
        gatewayCustomerId,
        gatewayPaymentMethodId,
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
          400
        );
      }

      // Validate cycle days (only 60, 90, or 180 allowed)
      if (![60, 90, 180].includes(cycleDays)) {
        throw new AppError("Cycle days must be 60, 90, or 180 days", 400);
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

      // Check if gateway subscription ID already exists (if provided)
      if (gatewaySubscriptionId) {
        const existingGatewaySub = await Subscriptions.findOne({
          gatewaySubscriptionId,
          isDeleted: false,
        }).lean();

        if (existingGatewaySub) {
          throw new AppError("Gateway subscription ID already exists", 400);
        }
      }

      // Get subscription plan discount from order if it's a 90-day plan
      let subscriptionPlanDiscount = null;
      if (cycleDays === 90 && order.subscriptionPlanDiscount) {
        subscriptionPlanDiscount = order.subscriptionPlanDiscount;
      } else if (cycleDays === 90 && order.metadata?.subscriptionPlanDiscount) {
        // Fallback: calculate from order metadata if discount field not set
        const discountMetadata = order.metadata.subscriptionPlanDiscount;
        if (discountMetadata && discountMetadata.discountPercentage === 15) {
          // Calculate discount amount from order subtotal
          const discountAmount = (order.subtotal.amount * 15) / 100;
          subscriptionPlanDiscount = {
            currency: order.subtotal.currency,
            amount: Math.round((discountAmount + Number.EPSILON) * 100) / 100,
            taxRate: 0,
          };
        }
      }

      // If amount is not provided or needs recalculation, calculate from product's sachetPrices
      let recurringAmount = amount;
      if (!recurringAmount || recurringAmount.amount === 0) {
        try {
          // Fetch products to get sachetPrices
          const productIds = items.map(
            (item: any) => new mongoose.Types.ObjectId(item.productId)
          );
          const products = await Products.find({
            _id: { $in: productIds },
            isDeleted: false,
          })
            .select("sachetPrices price")
            .lean();

          const productMap = new Map(
            products.map((p: any) => [p._id.toString(), p])
          );

          // Calculate total recurring amount from all items
          let totalRecurringAmount = 0;
          let currency = "EUR";
          let taxRate = 0;

          for (const item of items) {
            const product = productMap.get(item.productId);
            if (product && product.sachetPrices) {
              const itemAmount = calculateRecurringBillingAmount(
                product,
                cycleDays as SubscriptionCycle,
                item.quantity
              );
              totalRecurringAmount += itemAmount.amount;
              currency = itemAmount.currency;
              taxRate = itemAmount.taxRate;
            } else if (product && product.price) {
              // Fallback to base price if sachetPrices not available
              totalRecurringAmount += product.price.amount * item.quantity;
              currency = product.price.currency || currency;
              taxRate = product.price.taxRate || taxRate;
            }
          }

          if (totalRecurringAmount > 0) {
            recurringAmount = {
              currency,
              amount:
                Math.round((totalRecurringAmount + Number.EPSILON) * 100) / 100,
              taxRate,
            };
          }
        } catch (error: any) {
          logger.warn(
            `Failed to calculate recurring amount from product prices: ${error.message}`
          );
          // Use provided amount or order total as fallback
          if (!recurringAmount) {
            recurringAmount = {
              currency: order.subtotal.currency,
              amount: order.subtotal.amount,
              taxRate: order.subtotal.taxRate,
            };
          }
        }
      }

      // Create subscription
      const subscription = await Subscriptions.create({
        userId,
        orderId: new mongoose.Types.ObjectId(orderId),
        cycleDays,
        items: items.map((item: any) => ({
          productId: new mongoose.Types.ObjectId(item.productId),
          variantId: item.variantId
            ? new mongoose.Types.ObjectId(item.variantId)
            : undefined,
          quantity: item.quantity,
          price: item.price,
          name: item.name,
          sku: item.sku,
        })),
        amount: recurringAmount,
        subscriptionPlanDiscount,
        paymentMethod,
        gatewaySubscriptionId: gatewaySubscriptionId?.trim(),
        gatewayCustomerId: gatewayCustomerId?.trim(),
        gatewayPaymentMethodId: gatewayPaymentMethodId?.trim(),
        initialDeliveryDate: initialDate,
        nextDeliveryDate: nextDelDate,
        nextBillingDate: nextBillDate,
        status: SubscriptionStatus.ACTIVE,
        metadata: {
          ...(metadata || {}),
          // Store discount info in metadata for reference
          ...(subscriptionPlanDiscount
            ? {
                has90DayDiscount: true,
                discountPercentage: 15,
                discountAppliedTo: "subtotal",
              }
            : {}),
        },
      });

      logger.info(
        `Subscription created: ${subscription.subscriptionNumber} for order: ${orderId}`
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
            cycleDays: subscription.cycleDays,
            amount: subscription.amount,
            paymentMethod: subscription.paymentMethod,
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

      const { status } = req.query;
      const userId = new mongoose.Types.ObjectId(req.user._id);

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
          .populate("orderId", "orderNumber status")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(paginationOptions.limit)
          .lean(),
        Subscriptions.countDocuments(query),
      ]);

      const paginationMeta = getPaginationMeta(
        paginationOptions.page,
        paginationOptions.limit,
        total
      );

      // Format response
      const formattedSubscriptions = subscriptions.map((sub: any) => {
        const now = new Date();
        const daysUntilDelivery = sub.nextDeliveryDate
          ? Math.ceil(
              (sub.nextDeliveryDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        const daysUntilBilling = sub.nextBillingDate
          ? Math.ceil(
              (sub.nextBillingDate.getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        return {
          id: sub._id,
          subscriptionNumber: sub.subscriptionNumber,
          orderId: sub.orderId,
          status: sub.status,
          cycleDays: sub.cycleDays,
          items: sub.items,
          amount: sub.amount,
          paymentMethod: sub.paymentMethod,
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
    }
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
      const userId = new mongoose.Types.ObjectId(req.user._id);

      const subscription = await Subscriptions.findOne({
        _id: new mongoose.Types.ObjectId(subscriptionId),
        userId,
        isDeleted: false,
      })
        .populate("orderId", "orderNumber status planType")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      const now = new Date();
      const daysUntilDelivery = subscription.nextDeliveryDate
        ? Math.ceil(
            (subscription.nextDeliveryDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;
      const daysUntilBilling = subscription.nextBillingDate
        ? Math.ceil(
            (subscription.nextBillingDate.getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      res.status(200).json({
        success: true,
        message: "Subscription details retrieved successfully",
        data: {
          subscription: {
            id: subscription._id,
            subscriptionNumber: subscription.subscriptionNumber,
            orderId: subscription.orderId,
            status: subscription.status,
            cycleDays: subscription.cycleDays,
            items: subscription.items,
            amount: subscription.amount,
            paymentMethod: subscription.paymentMethod,
            gatewaySubscriptionId: subscription.gatewaySubscriptionId,
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
    }
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
    }
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
      subscription.status = SubscriptionStatus.PAUSED;
      subscription.pausedAt = new Date();

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
    }
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
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      subscription.cancelledBy = userId;
      if (cancellationReason) {
        subscription.cancellationReason = cancellationReason.trim();
      }

      await subscription.save();

      logger.info(
        `Subscription cancelled: ${subscriptionId} by user: ${userId}`
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
    }
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
    }
  );
}

export const subscriptionController = new SubscriptionController();
