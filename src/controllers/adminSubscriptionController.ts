import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Subscriptions, Orders, Payments, Products } from "@/models/commerce";
import { User } from "@/models/core";
import { SubscriptionStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
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
   * Get all subscriptions with pagination and search
   * @route GET /api/v1/admin/subscriptions
   * @access Admin
   * @query {Number} [page] - Page number (default: 1)
   * @query {Number} [limit] - Items per page (default: 10)
   * @query {String} [search] - Search by user firstName, lastName, or product name
   * @query {String} [status] - Filter by subscription status
   */
  getAllSubscriptions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { search, status } = req.query as {
        search?: string;
        status?: SubscriptionStatus;
      };

      const filter: Record<string, any> = {
        isDeleted: { $ne: true },
      };

      // Filter by status
      if (status) {
        filter.status = status;
      }

      // Search functionality - search by user firstName, lastName, or product name
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };

        // Find users matching firstName or lastName
        const matchingUsers = await User.find({
          $or: [{ firstName: searchRegex }, { lastName: searchRegex }],
          isDeleted: { $ne: true },
        })
          .select("_id")
          .lean();

        const userIds = matchingUsers.map((u) => u._id);

        // Find products matching name
        const matchingProducts = await Products.find({
          $or: [
            { "title.en": searchRegex },
            { "title.nl": searchRegex },
            { slug: searchRegex },
          ],
          isDeleted: { $ne: true },
        })
          .select("_id")
          .lean();

        const productIds = matchingProducts.map((p) => p._id);

        // Build search filter
        const searchConditions: any[] = [];

        // Search by subscription number
        searchConditions.push({ subscriptionNumber: searchRegex });

        // Search by user IDs
        if (userIds.length > 0) {
          searchConditions.push({ userId: { $in: userIds } });
        }

        // Search by product IDs in subscription items
        if (productIds.length > 0) {
          searchConditions.push({
            "items.productId": { $in: productIds },
          });
        }

        // Search by product name in subscription items (for items that have name stored)
        searchConditions.push({
          "items.name": searchRegex,
        });

        if (searchConditions.length > 0) {
          filter.$or = searchConditions;
        }
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      // Get total count
      const total = await Subscriptions.countDocuments(filter);

      // Get subscriptions with pagination
      const subscriptions = await Subscriptions.find(filter)
        .select(
          "subscriptionNumber userId orderId status planType cycleDays subscriptionStartDate subscriptionEndDate items initialDeliveryDate nextDeliveryDate nextBillingDate lastBilledDate lastDeliveredDate cancelledAt cancelledBy cancellationReason pausedAt pausedUntil createdAt updatedAt"
        )
        .populate("userId", "firstName lastName email")
        .populate(
          "orderId",
          "orderNumber status paymentStatus grandTotal currency"
        )
        .populate("items.productId", "title slug")
        .populate("cancelledBy", "firstName lastName email")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Format subscriptions for response
      const formattedSubscriptions = subscriptions.map((sub: any) => {
        const user = sub.userId || {};
        const order = sub.orderId || {};
        const items = (sub.items || []).map((item: any) => {
          const product = item.productId || {};
          return {
            productId: item.productId?._id || item.productId,
            productName:
              product.title?.en || product.title?.nl || item.name || "N/A",
            productSlug: product.slug || null,
            name: item.name || null,
            planDays: item.planDays || null,
            capsuleCount: item.capsuleCount || null,
            amount: item.amount || 0,
            discountedPrice: item.discountedPrice || 0,
            taxRate: item.taxRate || 0,
            totalAmount: item.totalAmount || 0,
            durationDays: item.durationDays || null,
            savingsPercentage: item.savingsPercentage || null,
            features: item.features || [],
          };
        });

        return {
          _id: sub._id,
          subscriptionNumber: sub.subscriptionNumber,
          user: {
            _id: user._id,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            email: user.email || null,
          },
          order: {
            _id: order._id,
            orderNumber: order.orderNumber || null,
            status: order.status || null,
            paymentStatus: order.paymentStatus || null,
            grandTotal: order.grandTotal || 0,
            currency: order.currency || null,
          },
          status: sub.status,
          planType: sub.planType,
          cycleDays: sub.cycleDays,
          subscriptionStartDate: sub.subscriptionStartDate,
          subscriptionEndDate: sub.subscriptionEndDate || null,
          items: items,
          initialDeliveryDate: sub.initialDeliveryDate,
          nextDeliveryDate: sub.nextDeliveryDate,
          nextBillingDate: sub.nextBillingDate,
          lastBilledDate: sub.lastBilledDate || null,
          lastDeliveredDate: sub.lastDeliveredDate || null,
          cancelledAt: sub.cancelledAt || null,
          cancelledBy: sub.cancelledBy
            ? {
                _id: sub.cancelledBy._id,
                firstName: sub.cancelledBy.firstName || null,
                lastName: sub.cancelledBy.lastName || null,
                email: sub.cancelledBy.email || null,
              }
            : null,
          cancellationReason: sub.cancellationReason || null,
          pausedAt: sub.pausedAt || null,
          pausedUntil: sub.pausedUntil || null,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        formattedSubscriptions,
        pagination,
        "Subscriptions retrieved successfully"
      );
    }
  );

  /**
   * Get subscription details with transaction logs, renewal history, and plan details
   * @route GET /api/v1/admin/subscriptions/:id
   * @access Admin
   * @param {String} id - Subscription ID (MongoDB ObjectId)
   */
  getSubscriptionById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new AppError("Invalid subscription ID", 400);
      }

      const subscriptionId = new mongoose.Types.ObjectId(id);

      // Get subscription with populated fields
      const subscription = await Subscriptions.findOne({
        _id: subscriptionId,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone memberId")
        .populate(
          "orderId",
          "orderNumber status paymentStatus grandTotal currency createdAt"
        )
        .populate("items.productId", "title slug description media")
        .populate("cancelledBy", "firstName lastName email")
        .lean();

      if (!subscription) {
        throw new AppError("Subscription not found", 404);
      }

      // Type guards for populated fields
      const user = subscription.userId as any;
      const isPopulatedUser =
        user && typeof user === "object" && user.firstName !== undefined;

      const order = subscription.orderId as any;
      const isPopulatedOrder =
        order && typeof order === "object" && order.orderNumber !== undefined;

      const cancelledBy = subscription.cancelledBy as any;
      const isPopulatedCancelledBy =
        cancelledBy &&
        typeof cancelledBy === "object" &&
        cancelledBy.firstName !== undefined;

      const userId = isPopulatedUser
        ? user._id
        : (subscription.userId as mongoose.Types.ObjectId);
      const orderId = isPopulatedOrder
        ? order._id
        : (subscription.orderId as mongoose.Types.ObjectId);

      // Get transaction logs - all payments related to this subscription
      // This includes the initial payment and any renewal payments
      const transactionLogs = await Payments.find({
        $or: [
          { orderId: orderId }, // Initial order payment
          { userId: userId }, // All payments by this user (for renewals)
        ],
        isDeleted: { $ne: true },
      })
        .populate(
          "orderId",
          "orderNumber planType isOneTime status paymentStatus"
        )
        .sort({ createdAt: -1 })
        .lean();

      // Format transaction logs
      const formattedTransactions = transactionLogs.map((payment: any) => {
        const paymentOrder = payment.orderId as any;
        const isPopulatedPaymentOrder =
          paymentOrder &&
          typeof paymentOrder === "object" &&
          paymentOrder.orderNumber !== undefined;
        return {
          _id: payment._id,
          orderId: isPopulatedPaymentOrder ? paymentOrder._id : payment.orderId,
          orderNumber: isPopulatedPaymentOrder
            ? paymentOrder.orderNumber
            : null,
          paymentMethod: payment.paymentMethod || null,
          status: payment.status || null,
          amount: payment.amount || null,
          currency: payment.currency || null,
          transactionId: payment.transactionId || null,
          gatewayTransactionId: payment.gatewayTransactionId || null,
          gatewaySessionId: payment.gatewaySessionId || null,
          failureReason: payment.failureReason || null,
          refundAmount: payment.refundAmount || null,
          refundReason: payment.refundReason || null,
          refundedAt: payment.refundedAt || null,
          processedAt: payment.processedAt || null,
          createdAt: payment.createdAt,
        };
      });

      // Get renewal history - find all subscription orders for this user
      // Renewals are typically orders with the same user and subscription plan type
      const renewalOrders = await Orders.find({
        userId: userId,
        $or: [{ isOneTime: false }, { planType: "SUBSCRIPTION" }],
        isDeleted: { $ne: true },
      })
        .select(
          "orderNumber status paymentStatus planType isOneTime selectedPlanDays items subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency paymentMethod createdAt"
        )
        .populate("items.productId", "title slug")
        .sort({ createdAt: -1 })
        .lean();

      // Format renewal history
      const renewalHistory = renewalOrders.map((order: any) => {
        const items = (order.items || []).map((item: any) => {
          const product = item.productId as any;
          const isPopulatedProduct =
            product &&
            typeof product === "object" &&
            product.title !== undefined;
          return {
            productId: isPopulatedProduct ? product._id : item.productId,
            productName: isPopulatedProduct
              ? product.title?.en || product.title?.nl
              : item.name || "N/A",
            productSlug: isPopulatedProduct ? product.slug : null,
            name: item.name || null,
            planDays: item.planDays || null,
            capsuleCount: item.capsuleCount || null,
            amount: item.amount || 0,
            discountedPrice: item.discountedPrice || 0,
            totalAmount: item.totalAmount || 0,
          };
        });

        return {
          _id: order._id,
          orderNumber: order.orderNumber || null,
          status: order.status || null,
          paymentStatus: order.paymentStatus || null,
          planType: order.planType || null,
          isOneTime: order.isOneTime || false,
          selectedPlanDays: order.selectedPlanDays || null,
          items: items,
          subTotal: order.subTotal || 0,
          discountedPrice: order.discountedPrice || 0,
          couponDiscountAmount: order.couponDiscountAmount || 0,
          membershipDiscountAmount: order.membershipDiscountAmount || 0,
          subscriptionPlanDiscountAmount:
            order.subscriptionPlanDiscountAmount || 0,
          taxAmount: order.taxAmount || 0,
          grandTotal: order.grandTotal || 0,
          currency: order.currency || null,
          paymentMethod: order.paymentMethod || null,
          createdAt: order.createdAt,
          isInitialOrder: order._id.toString() === orderId?.toString(),
        };
      });

      // Format plan details
      const items = (subscription.items || []).map((item: any) => {
        const product = item.productId as any;
        const isPopulatedProduct =
          product && typeof product === "object" && product.title !== undefined;
        return {
          productId: isPopulatedProduct ? product._id : item.productId,
          productName: isPopulatedProduct
            ? product.title?.en || product.title?.nl
            : item.name || "N/A",
          productSlug: isPopulatedProduct ? product.slug : null,
          productDescription: isPopulatedProduct
            ? product.description?.en || product.description?.nl
            : null,
          productMedia: isPopulatedProduct ? product.media : null,
          name: item.name || null,
          planDays: item.planDays || null,
          capsuleCount: item.capsuleCount || null,
          amount: item.amount || 0,
          discountedPrice: item.discountedPrice || 0,
          taxRate: item.taxRate || 0,
          totalAmount: item.totalAmount || 0,
          durationDays: item.durationDays || null,
          savingsPercentage: item.savingsPercentage || null,
          features: item.features || [],
        };
      });

      // Format subscription details
      const subscriptionDetails = {
        _id: subscription._id,
        subscriptionNumber: subscription.subscriptionNumber,
        user: {
          _id: isPopulatedUser
            ? user._id
            : (subscription.userId as mongoose.Types.ObjectId),
          firstName: isPopulatedUser ? user.firstName : null,
          lastName: isPopulatedUser ? user.lastName : null,
          email: isPopulatedUser ? user.email : null,
          phone: isPopulatedUser ? user.phone : null,
          memberId: isPopulatedUser ? user.memberId : null,
        },
        order: {
          _id: isPopulatedOrder
            ? order._id
            : (subscription.orderId as mongoose.Types.ObjectId),
          orderNumber: isPopulatedOrder ? order.orderNumber : null,
          status: isPopulatedOrder ? order.status : null,
          paymentStatus: isPopulatedOrder ? order.paymentStatus : null,
          grandTotal: isPopulatedOrder ? order.grandTotal : 0,
          currency: isPopulatedOrder ? order.currency : null,
          createdAt: isPopulatedOrder ? order.createdAt : null,
        },
        status: subscription.status,
        planType: subscription.planType,
        cycleDays: subscription.cycleDays,
        subscriptionStartDate: subscription.subscriptionStartDate,
        subscriptionEndDate: subscription.subscriptionEndDate || null,
        items: items,
        initialDeliveryDate: subscription.initialDeliveryDate,
        nextDeliveryDate: subscription.nextDeliveryDate,
        nextBillingDate: subscription.nextBillingDate,
        lastBilledDate: subscription.lastBilledDate || null,
        lastDeliveredDate: subscription.lastDeliveredDate || null,
        cancelledAt: subscription.cancelledAt || null,
        cancelledBy: isPopulatedCancelledBy
          ? {
              _id: cancelledBy._id,
              firstName: cancelledBy.firstName || null,
              lastName: cancelledBy.lastName || null,
              email: cancelledBy.email || null,
            }
          : null,
        cancellationReason: subscription.cancellationReason || null,
        pausedAt: subscription.pausedAt || null,
        pausedUntil: subscription.pausedUntil || null,
        metadata: subscription.metadata || {},
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      };

      res.apiSuccess(
        {
          subscription: subscriptionDetails,
          transactionLogs: formattedTransactions,
          renewalHistory: renewalHistory,
        },
        "Subscription details retrieved successfully"
      );
    }
  );
}

export const adminSubscriptionController = new AdminSubscriptionController();
