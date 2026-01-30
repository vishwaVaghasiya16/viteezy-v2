import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { Orders } from "@/models/commerce";
import { User, Addresses } from "@/models/core";
import {
  OrderStatus,
  PaymentStatus,
  OrderPlanType,
} from "@/models/enums";

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

class AdminOrderController {
  /**
   * Get order statistics with comparison to last month
   * @route GET /api/v1/admin/orders/stats
   * @access Admin
   */
  getOrderStats = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const now = new Date();
      
      // Current month
      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      );
      const endOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      // Last month
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999
      );

      // Get all stats in parallel
      const [
        totalOrdersCurrent,
        totalOrdersLast,
        deliveredCurrent,
        deliveredLast,
        processingCurrent,
        processingLast,
        shippedCurrent,
        shippedLast,
        cancelledCurrent,
        cancelledLast,
        pendingCurrent,
        pendingLast,
      ] = await Promise.all([
        // Total Orders - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Total Orders - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        // Delivered - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.DELIVERED,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Delivered - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.DELIVERED,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        // Processing - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.PROCESSING,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Processing - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.PROCESSING,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        // Shipped - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.SHIPPED,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Shipped - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.SHIPPED,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        // Cancelled - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.CANCELLED,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Cancelled - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.CANCELLED,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
        // Pending - Current Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.PENDING,
          createdAt: { $gte: startOfCurrentMonth, $lte: endOfCurrentMonth },
        }),
        // Pending - Last Month
        Orders.countDocuments({
          isDeleted: { $ne: true },
          status: OrderStatus.PENDING,
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        }),
      ]);

      // Calculate percentage changes
      const calculatePercentageChange = (
        current: number,
        last: number
      ): number => {
        if (last === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - last) / last) * 100 * 10) / 10;
      };

      // Get total orders count (all time, not just current month)
      const totalOrdersAllTime = await Orders.countDocuments({
        isDeleted: { $ne: true },
      });

      res.apiSuccess(
        {
          stats: {
            totalOrders: {
              count: totalOrdersAllTime,
              currentMonth: totalOrdersCurrent,
              lastMonth: totalOrdersLast,
              changePercentage: calculatePercentageChange(
                totalOrdersCurrent,
                totalOrdersLast
              ),
            },
            delivered: {
              count: deliveredCurrent,
              lastMonth: deliveredLast,
              changePercentage: calculatePercentageChange(
                deliveredCurrent,
                deliveredLast
              ),
            },
            processing: {
              count: processingCurrent,
              lastMonth: processingLast,
              changePercentage: calculatePercentageChange(
                processingCurrent,
                processingLast
              ),
            },
            shipped: {
              count: shippedCurrent,
              lastMonth: shippedLast,
              changePercentage: calculatePercentageChange(
                shippedCurrent,
                shippedLast
              ),
            },
            cancelled: {
              count: cancelledCurrent,
              lastMonth: cancelledLast,
              changePercentage: calculatePercentageChange(
                cancelledCurrent,
                cancelledLast
              ),
            },
            pending: {
              count: pendingCurrent,
              lastMonth: pendingLast,
              changePercentage: calculatePercentageChange(
                pendingCurrent,
                pendingLast
              ),
            },
          },
        },
        "Order statistics retrieved successfully"
      );
    }
  );

  /**
   * Get all orders with pagination and filters
   * @route GET /api/v1/admin/orders
   * @access Admin
   * @query {Number} [page] - Page number (default: 1)
   * @query {Number} [limit] - Items per page (default: 10)
   * @query {String} [search] - Search by order number, customer name, or email
   * @query {String} [status] - Filter by order status
   * @query {String} [paymentStatus] - Filter by payment status
   * @query {String} [planType] - Filter by plan type (One-Time or Subscription)
   * @query {String} [startDate] - Filter orders from date (ISO date string)
   * @query {String} [endDate] - Filter orders to date (ISO date string)
   * @query {String} [customerId] - Filter by customer ID
   */
  getAllOrders = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { page, limit, skip, sort } = getPaginationOptions(req);
      const {
        search,
        status,
        paymentStatus,
        planType,
        startDate,
        endDate,
        customerId,
      } = req.query as {
        search?: string;
        status?: OrderStatus;
        paymentStatus?: PaymentStatus;
        planType?: OrderPlanType;
        startDate?: string;
        endDate?: string;
        customerId?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: { $ne: true },
      };

      // Filter by status
      if (status) {
        filter.status = status;
      }

      // Filter by payment status
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Filter by plan type
      if (planType) {
        filter.planType = planType;
      }

      // Filter by customer ID
      if (customerId) {
        filter.userId = ensureObjectId(customerId, "customer ID");
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

      // Search filter - search by order number, customer name, or email
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        
        // First, find user IDs matching the search
        const matchingUsers = await User.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
          ],
        }).select("_id").lean();

        const userIds = matchingUsers.map((u) => u._id);

        filter.$or = [
          { orderNumber: searchRegex },
          ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
        ];
      }

      const sortOptions: Record<string, 1 | -1> = {
        createdAt: -1,
        ...((sort as Record<string, 1 | -1>) || {}),
      };

      // Get total count
      const total = await Orders.countDocuments(filter);

      // Get orders with pagination
      const orders = await Orders.find(filter)
        .select(
          "orderNumber planType isOneTime variantType status items subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency paymentMethod paymentStatus couponCode metadata couponMetadata membershipMetadata trackingNumber shippedAt deliveredAt createdAt userId"
        )
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "title slug description media categories tags status galleryImages productImage")
        .populate("shippingAddressId", "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city")
        .populate("billingAddressId", "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city")
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => {
        // Type guard for populated user
        const user = order.userId as any;
        const isPopulatedUser = user && typeof user === 'object' && user.firstName !== undefined;

        return {
          id: order._id,
          orderNumber: order.orderNumber,
          orderDate: order.createdAt,
          customer: isPopulatedUser
            ? {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                fullName: `${user.firstName} ${user.lastName}`.trim(),
              }
            : null,
        planType: order.planType,
        isOneTime: order.isOneTime,
        variantType: order.variantType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
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
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          capsuleCount: item.capsuleCount,
          savingsPercentage: item.savingsPercentage,
          features: item.features,
        })),
        pricing: {
          subTotal: order.subTotal,
          discountedPrice: order.discountedPrice,
          couponDiscountAmount: order.couponDiscountAmount,
          membershipDiscountAmount: order.membershipDiscountAmount,
          subscriptionPlanDiscountAmount: order.subscriptionPlanDiscountAmount,
          taxAmount: order.taxAmount,
          grandTotal: order.grandTotal,
          currency: order.currency,
        },
        paymentMethod: order.paymentMethod,
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        shippingAddress: order.shippingAddressId,
        billingAddress: order.billingAddressId,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        };
      });

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(transformedOrders, pagination, "Orders retrieved successfully");
    }
  );

  /**
   * Get order by ID
   * @route GET /api/v1/admin/orders/:id
   * @access Admin
   */
  getOrderById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone")
        .populate("items.productId", "title slug description media categories tags status galleryImages productImage")
        .populate("shippingAddressId", "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city")
        .populate("billingAddressId", "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city")
        .lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Type guard for populated user
      const user = order.userId as any;
      const isPopulatedUser = user && typeof user === 'object' && user.firstName !== undefined;

      const transformedOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        customer: isPopulatedUser
          ? {
              id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone,
              fullName: `${user.firstName} ${user.lastName}`.trim(),
            }
          : null,
        planType: order.planType,
        isOneTime: order.isOneTime,
        variantType: order.variantType,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          productId: item.productId?._id || item.productId,
          product: item.productId
            ? {
                id: item.productId._id,
                title: item.productId.title,
                slug: item.productId.slug,
                description: item.productId.description,
                media: item.productId.media,
                categories: item.productId.categories,
                tags: item.productId.tags,
                status: item.productId.status,
                galleryImages: item.productId.galleryImages,
                productImage: item.productId.productImage,
              }
            : null,
          name: item.name,
          amount: item.amount,
          discountedPrice: item.discountedPrice,
          taxRate: item.taxRate,
          totalAmount: item.totalAmount,
          durationDays: item.durationDays,
          capsuleCount: item.capsuleCount,
          savingsPercentage: item.savingsPercentage,
          features: item.features,
        })),
        pricing: {
          subTotal: order.subTotal,
          discountedPrice: order.discountedPrice,
          couponDiscountAmount: order.couponDiscountAmount,
          membershipDiscountAmount: order.membershipDiscountAmount,
          subscriptionPlanDiscountAmount: order.subscriptionPlanDiscountAmount,
          taxAmount: order.taxAmount,
          grandTotal: order.grandTotal,
          currency: order.currency,
        },
        paymentMethod: order.paymentMethod,
        paymentId: order.paymentId,
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        shippingAddress: order.shippingAddressId,
        billingAddress: order.billingAddressId,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      res.apiSuccess({ order: transformedOrder }, "Order retrieved successfully");
    }
  );

  /**
   * Update order status
   * @route PATCH /api/v1/admin/orders/:id/status
   * @access Admin
   */
  updateOrderStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !Object.values(OrderStatus).includes(status)) {
        throw new AppError("Valid order status is required", 400);
      }

      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      // Update status
      const previousStatus = order.status;
      order.status = status;

      // Auto-update timestamps based on status
      if (status === OrderStatus.SHIPPED && !order.shippedAt) {
        order.shippedAt = new Date();
      }
      if (status === OrderStatus.DELIVERED && !order.deliveredAt) {
        order.deliveredAt = new Date();
      }

      if (requesterId) {
        (order as any).updatedBy = requesterId;
      }

      await order.save();

      // Send notifications based on status change
      try {
        const { orderNotifications } = await import("@/utils/notificationHelpers");
        
        if (status !== previousStatus) {
          switch (status) {
            case OrderStatus.SHIPPED:
              await orderNotifications.orderShipped(
                order.userId,
                String(order._id),
                order.orderNumber,
                order.trackingNumber,
                requesterId
              );
              break;
            case OrderStatus.DELIVERED:
              await orderNotifications.orderDelivered(
                order.userId,
                String(order._id),
                order.orderNumber,
                requesterId
              );
              break;
            case OrderStatus.CANCELLED:
              await orderNotifications.orderCancelled(
                order.userId,
                String(order._id),
                order.orderNumber,
                undefined,
                requesterId
              );
              break;
            case OrderStatus.PROCESSING:
              // Order packed notification
              await orderNotifications.orderPacked(
                order.userId,
                String(order._id),
                order.orderNumber,
                requesterId
              );
              break;
          }
        }
      } catch (error: any) {
        logger.error(`Failed to send order status notification: ${error.message}`);
        // Don't fail status update if notification fails
      }

      res.apiSuccess({ order }, "Order status updated successfully");
    }
  );

  /**
   * Update payment status
   * @route PATCH /api/v1/admin/orders/:id/payment-status
   * @access Admin
   */
  updatePaymentStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { paymentStatus } = req.body;

      if (!paymentStatus || !Object.values(PaymentStatus).includes(paymentStatus)) {
        throw new AppError("Valid payment status is required", 400);
      }

      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      order.paymentStatus = paymentStatus;

      if (requesterId) {
        (order as any).updatedBy = requesterId;
      }

      await order.save();

      res.apiSuccess({ order }, "Payment status updated successfully");
    }
  );

  /**
   * Update tracking number
   * @route PATCH /api/v1/admin/orders/:id/tracking
   * @access Admin
   */
  updateTrackingNumber = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const { trackingNumber } = req.body;

      if (!trackingNumber || trackingNumber.trim() === "") {
        throw new AppError("Tracking number is required", 400);
      }

      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      const requesterId = req.user?._id
        ? new mongoose.Types.ObjectId(req.user._id)
        : undefined;

      order.trackingNumber = trackingNumber.trim();

      // If order is not shipped yet, update status to shipped
      if (order.status !== OrderStatus.SHIPPED && !order.shippedAt) {
        order.status = OrderStatus.SHIPPED;
        order.shippedAt = new Date();
      }

      if (requesterId) {
        (order as any).updatedBy = requesterId;
      }

      await order.save();

      res.apiSuccess({ order }, "Tracking number updated successfully");
    }
  );

  /**
   * Delete order (soft delete)
   * @route DELETE /api/v1/admin/orders/:id
   * @access Admin
   */
  deleteOrder = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      });

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      (order as any).isDeleted = true;
      (order as any).deletedAt = new Date();
      await order.save();

      res.apiSuccess(null, "Order deleted successfully");
    }
  );
}

export const adminOrderController = new AdminOrderController();

