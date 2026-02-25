import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import {
  Orders,
  Payments,
  Products,
  Subscriptions,
  Carts,
} from "@/models/commerce";
import { User, Addresses } from "@/models/core";
import {
  OrderStatus,
  PaymentStatus,
  OrderPlanType,
  ProductVariant,
} from "@/models/enums";
import { emailService } from "@/services/emailService";
import { cartService } from "@/services/cartService";
import { orderService } from "@/services/orderService";
import { getTranslatedString } from "@/utils/translationUtils";
import { getUserLanguageCode } from "@/utils/translationUtils";
import { DEFAULT_LANGUAGE, SupportedLanguage } from "@/models/common.model";
import { getStandUpPouchPlanKey } from "../config/planConfig";

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
        1,
      );
      const endOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      // Last month
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
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
        last: number,
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
                totalOrdersLast,
              ),
            },
            delivered: {
              count: deliveredCurrent,
              lastMonth: deliveredLast,
              changePercentage: calculatePercentageChange(
                deliveredCurrent,
                deliveredLast,
              ),
            },
            processing: {
              count: processingCurrent,
              lastMonth: processingLast,
              changePercentage: calculatePercentageChange(
                processingCurrent,
                processingLast,
              ),
            },
            shipped: {
              count: shippedCurrent,
              lastMonth: shippedLast,
              changePercentage: calculatePercentageChange(
                shippedCurrent,
                shippedLast,
              ),
            },
            cancelled: {
              count: cancelledCurrent,
              lastMonth: cancelledLast,
              changePercentage: calculatePercentageChange(
                cancelledCurrent,
                cancelledLast,
              ),
            },
            pending: {
              count: pendingCurrent,
              lastMonth: pendingLast,
              changePercentage: calculatePercentageChange(
                pendingCurrent,
                pendingLast,
              ),
            },
          },
        },
        "Order statistics retrieved successfully",
      );
    },
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

        // 🔥 NEW
        date,
        minTotal,
        maxTotal,
        productName,
      } = req.query as {
        search?: string;
        status?: OrderStatus;
        paymentStatus?: PaymentStatus;
        planType?: OrderPlanType;
        startDate?: string;
        endDate?: string;
        customerId?: string;

        date?: string;
        minTotal?: string;
        maxTotal?: string;
        productName?: string;
      };

      const filter: Record<string, any> = {
        isDeleted: { $ne: true },
      };

      // Filter by status
      if (status) {
        filter.status = status;
      }

      if (date) {
        const from = new Date(date);
        from.setHours(0, 0, 0, 0);

        const to = new Date(date);
        to.setHours(23, 59, 59, 999);

        filter.createdAt = { $gte: from, $lte: to };
      }

      if (minTotal || maxTotal) {
        filter.grandTotal = {};

        if (minTotal) {
          filter.grandTotal.$gte = Number(minTotal);
        }

        if (maxTotal) {
          filter.grandTotal.$lte = Number(maxTotal);
        }
      }

      if (productName) {
        const productRegex = { $regex: productName, $options: "i" };

        const matchingProducts = await Products.find({
          title: productRegex,
        })
          .select("_id")
          .lean();

        const productIds = matchingProducts.map((p) => p._id);

        if (productIds.length > 0) {
          filter["items.productId"] = { $in: productIds };
        } else {
          // No matching product → return empty result
          filter["items.productId"] = null;
        }
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
        })
          .select("_id")
          .lean();

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
          "orderNumber planType isOneTime variantType status items subTotal discountedPrice couponDiscountAmount membershipDiscountAmount subscriptionPlanDiscountAmount taxAmount grandTotal currency paymentMethod paymentStatus couponCode metadata couponMetadata membershipMetadata trackingNumber shippedAt deliveredAt createdAt userId",
        )
        .populate("userId", "firstName lastName email")
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage",
        )
        .populate(
          "shippingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city",
        )
        .populate(
          "billingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city",
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Get user languages for all orders (for feature translation)
      const userIds = orders
        .map((order: any) => order.userId?._id || order.userId)
        .filter((id: any) => id);
      const users = await User.find({ _id: { $in: userIds } })
        .select("_id language")
        .lean();
      const userLanguageMap = new Map<string, SupportedLanguage>();
      users.forEach((user: any) => {
        const lang = user.language
          ? getUserLanguageCode(user.language)
          : DEFAULT_LANGUAGE;
        userLanguageMap.set(user._id.toString(), lang);
      });

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => {
        // Type guard for populated user
        const user = order.userId as any;
        const isPopulatedUser =
          user && typeof user === "object" && user.firstName !== undefined;

        // Get user language for feature translation
        const userId = user?._id?.toString() || order.userId?.toString();
        const userLang = userId
          ? userLanguageMap.get(userId) || DEFAULT_LANGUAGE
          : DEFAULT_LANGUAGE;

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
            features: Array.isArray(item.features)
              ? item.features.map((feature: any) =>
                  getTranslatedString(feature, userLang),
                )
              : item.features,
          })),
          pricing: order.pricing,
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

      res.apiPaginated(
        transformedOrders,
        pagination,
        "Orders retrieved successfully",
      );
    },
  );

  /**
   * Get order by ID
   * @route GET /api/v1/admin/orders/:id
   * @access Admin
   */
  getOrderById = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      // Fetch the order with populated references
      const order = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email phone")
        .populate(
          "items.productId",
          "title slug description media categories tags status galleryImages productImage",
        )
        .populate(
          "shippingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city",
        )
        .populate(
          "billingAddressId",
          "firstName lastName streetName houseNumber houseNumberAddition postalCode address phone country city",
        )
        .lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Safely get user
      const user = order.userId ? (order.userId as any) : null;

      // Fetch payment info
      const payment = await Payments.findOne({
        orderId: order._id,
        isDeleted: { $ne: true },
      })
        .select("paymentMethod status gatewayTransactionId")
        .lean();

      // Get user language for feature translation
      let userLang: SupportedLanguage = DEFAULT_LANGUAGE;
      if (user?._id) {
        try {
          const userData = await User.findById(user._id)
            .select("language")
            .lean();
          if (userData?.language) {
            userLang = getUserLanguageCode(userData.language);
          }
        } catch (error) {
          // Use default language if fetch fails
        }
      }

      const totalOrders = await Orders.countDocuments({
        userId: order.userId,
        isDeleted: { $ne: true },
      });

      const subscription = await Subscriptions.findOne({
        orderId: order._id,
        isDeleted: { $ne: true },
      })
        .select("subscriptionNumber createdAt nextBillingDate cycleDays status")
        .lean();

      const transformedOrder = {
        id: order._id,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        totalOrders: totalOrders ? totalOrders : 0,
        subscription: subscription
          ? {
              id: subscription._id,
              subscriptionNumber: subscription.subscriptionNumber,
              createdAt: subscription.createdAt,
              nextBillingDate: subscription.nextBillingDate,
              cycleDays: subscription.cycleDays,
              status: subscription.status,
            }
          : null,
        customer: user
          ? {
              id: user._id || null,
              firstName: user.firstName ? user.firstName : null,
              lastName: user.lastName ? user.lastName : null,
              email: user.email ? user.email : null,
              phone: user.phone ? user.phone : null,
            }
          : null,
        planType: order.planType || null,
        status: order.status || null,
        paymentStatus: order.paymentStatus || null,
        items: Array.isArray(order.items)
          ? order.items.map((item: any) => ({
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
              features: Array.isArray(item.features)
                ? item.features.map((feature: any) =>
                    getTranslatedString(feature, userLang),
                  )
                : item.features,
            }))
          : [],
        pricing: order.pricing,
        paymentMethod: order.paymentMethod,
        payment: payment
          ? {
              paymentMethod: payment.paymentMethod,
              status: payment.status,
              gatewayTransactionId: payment.gatewayTransactionId,
            }
          : null,
        couponCode: order.couponCode,
        couponMetadata: order.couponMetadata,
        membershipMetadata: order.membershipMetadata,
        shippingAddress: order.shippingAddressId || null,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        notes: order.notes,
        metadata: order.metadata,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      res.apiSuccess(
        { order: transformedOrder },
        "Order retrieved successfully",
      );
    },
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
        const { orderNotifications } =
          await import("@/utils/notificationHelpers");

        if (status !== previousStatus) {
          switch (status) {
            case OrderStatus.SHIPPED:
              await orderNotifications.orderShipped(
                order.userId,
                String(order._id),
                order.orderNumber,
                order.trackingNumber,
                requesterId,
              );
              break;
            case OrderStatus.DELIVERED:
              await orderNotifications.orderDelivered(
                order.userId,
                String(order._id),
                order.orderNumber,
                requesterId,
              );
              break;
            case OrderStatus.CANCELLED:
              await orderNotifications.orderCancelled(
                order.userId,
                String(order._id),
                order.orderNumber,
                undefined,
                requesterId,
              );
              break;
            case OrderStatus.PROCESSING:
              // Order packed notification
              await orderNotifications.orderPacked(
                order.userId,
                String(order._id),
                order.orderNumber,
                requesterId,
              );
              break;
          }
        }
      } catch (error: any) {
        logger.error(
          `Failed to send order status notification: ${error.message}`,
        );
        // Don't fail status update if notification fails
      }

      res.apiSuccess({ order }, "Order status updated successfully");
    },
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

      if (
        !paymentStatus ||
        !Object.values(PaymentStatus).includes(paymentStatus)
      ) {
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
    },
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
    },
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
    },
  );

  /**
   * Create manual order (Admin Panel)
   * @route POST /api/v1/admin/orders/manual
   * @access Admin
   */
  createManualOrder = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        userId,
        orderType,
        items,
        shippingAddressId,
        billingAddressId,
        subTotal,
        discountedPrice,
        couponDiscountAmount,
        membershipDiscountAmount,
        subscriptionPlanDiscountAmount,
        taxAmount,
        grandTotal,
        currency,
        couponCode,
        paymentMethod,
        notes,
        planType,
        isOneTime,
        variantType,
        selectedPlanDays,
      } = req.body;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError("User not found", 404);
      }

      // Validate addresses exist
      const shippingAddress = await Addresses.findById(shippingAddressId);
      if (!shippingAddress) {
        throw new AppError("Shipping address not found", 404);
      }

      let billingAddress = null;
      if (billingAddressId) {
        billingAddress = await Addresses.findById(billingAddressId);
        if (!billingAddress) {
          throw new AppError("Billing address not found", 404);
        }
      }

      // Fetch products and build order items
      const productIds = items.map((item: any) => item.productId);
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: false,
        status: true,
      }).lean();

      if (products.length !== productIds.length) {
        throw new AppError("One or more products not found", 404);
      }

      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p]),
      );

      // Build order items with product details
      const orderItems = items.map((item: any) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new AppError(`Product ${item.productId} not found`, 404);
        }

        const productTitle =
          typeof product.title === "string"
            ? product.title
            : product.title?.en ||
              product.title?.nl ||
              product.slug ||
              "Product";

        // Calculate pricing based on variant type
        let amount = 0;
        let discountedPricePerUnit = 0;
        let taxRate = 0;

        if (
          item.variantType === ProductVariant.SACHETS &&
          product.sachetPrices
        ) {
          const planKey = item.planDays
            ? this.getPlanKeyFromDays(item.planDays)
            : "thirtyDays";
          const planData = (product.sachetPrices as any)[planKey];
          if (planData) {
            amount = planData.amount || planData.totalAmount || 0;
            discountedPricePerUnit =
              planData.discountedPrice ||
              planData.amount ||
              planData.totalAmount ||
              0;
            taxRate = planData.taxRate || 0;
          }
        } else if (
          item.variantType === ProductVariant.STAND_UP_POUCH &&
          product.standupPouchPrice
        ) {
          const standupPrice = product.standupPouchPrice as any;
          // Get the correct count key from capsuleCount (60 -> count60, 120 -> count120)
          const countKey = getStandUpPouchPlanKey(item.capsuleCount || 60);
          const countData = countKey ? standupPrice[countKey] : null;
          if (countData) {
            amount = countData.amount || 0;
            discountedPricePerUnit =
              countData.discountedPrice || countData.amount || 0;
            taxRate = countData.taxRate || 0;
          } else if (standupPrice.amount) {
            amount = standupPrice.amount || 0;
            discountedPricePerUnit =
              standupPrice.discountedPrice || standupPrice.amount || 0;
            taxRate = standupPrice.taxRate || 0;
          }
        }

        const quantity = item.quantity || 1;
        const totalAmount = discountedPricePerUnit * quantity;

        return {
          productId: new mongoose.Types.ObjectId(item.productId),
          name: productTitle,
          variantType: item.variantType,
          quantity: quantity,
          planDays: item.planDays || null,
          capsuleCount: item.capsuleCount || null,
          amount: amount,
          discountedPrice: discountedPricePerUnit,
          taxRate: taxRate,
          totalAmount: totalAmount,
        };
      });

      // Generate order number
      const generateOrderNumber = (): string => {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9000) + 1000;
        return `ORD-${timestamp}-${random}`;
      };

      // Determine payment status based on order type
      const paymentStatus =
        orderType === "already_paid"
          ? PaymentStatus.COMPLETED
          : PaymentStatus.PENDING;

      // Calculate pricing breakdown by variant type
      const calculatePricingBreakdown = () => {
        // Helper function to round amounts
        const roundAmount = (amount: number): number => {
          return Math.round(amount * 100) / 100;
        };

        // Calculate SACHETS pricing
        const sachetOrderItems = orderItems.filter(
          (item: any) => item.variantType === ProductVariant.SACHETS
        );
        const sachetSubTotal = sachetOrderItems.reduce(
          (sum: number, item: any) => sum + (item.amount * (item.quantity || 1)),
          0
        );
        const sachetDiscountedPrice = sachetOrderItems.reduce(
          (sum: number, item: any) => sum + (item.discountedPrice * (item.quantity || 1)),
          0
        );
        const sachetTaxAmount = sachetOrderItems.reduce(
          (sum: number, item: any) => {
            const itemTotal = item.discountedPrice * (item.quantity || 1);
            return sum + (itemTotal * (item.taxRate || 0));
          },
          0
        );
        // Calculate membership discount for sachets (proportional to sachets subtotal)
        const sachetMembershipDiscountAmount = sachetSubTotal > 0 && subTotal > 0
          ? roundAmount((membershipDiscountAmount * sachetSubTotal) / subTotal)
          : 0;
        // Subscription plan discount only applies to sachets
        const sachetSubscriptionPlanDiscountAmount = subscriptionPlanDiscountAmount || 0;
        const sachetTotal = roundAmount(
          sachetDiscountedPrice - sachetMembershipDiscountAmount - sachetSubscriptionPlanDiscountAmount + sachetTaxAmount
        );

        // Calculate STAND_UP_POUCH pricing
        const standUpPouchOrderItems = orderItems.filter(
          (item: any) => item.variantType === ProductVariant.STAND_UP_POUCH
        );
        const standUpPouchSubTotal = standUpPouchOrderItems.reduce(
          (sum: number, item: any) => sum + (item.amount * (item.quantity || 1)),
          0
        );
        const standUpPouchDiscountedPrice = standUpPouchOrderItems.reduce(
          (sum: number, item: any) => sum + (item.discountedPrice * (item.quantity || 1)),
          0
        );
        const standUpPouchTaxAmount = standUpPouchOrderItems.reduce(
          (sum: number, item: any) => {
            const itemTotal = item.discountedPrice * (item.quantity || 1);
            return sum + (itemTotal * (item.taxRate || 0));
          },
          0
        );
        // Calculate membership discount for standUpPouch (proportional to standUpPouch subtotal)
        const standUpPouchMembershipDiscountAmount = standUpPouchSubTotal > 0 && subTotal > 0
          ? roundAmount((membershipDiscountAmount * standUpPouchSubTotal) / subTotal)
          : 0;
        const standUpPouchTotal = roundAmount(
          standUpPouchDiscountedPrice - standUpPouchMembershipDiscountAmount + standUpPouchTaxAmount
        );

        // Build pricing breakdown
        const pricingBreakdown: any = {
          overall: {
            subTotal: roundAmount(subTotal),
            discountedPrice: roundAmount(discountedPrice),
            couponDiscountAmount: roundAmount(couponDiscountAmount || 0),
            membershipDiscountAmount: roundAmount(membershipDiscountAmount || 0),
            subscriptionPlanDiscountAmount: roundAmount(subscriptionPlanDiscountAmount || 0),
            taxAmount: roundAmount(taxAmount || 0),
            grandTotal: roundAmount(grandTotal),
            currency: currency || "EUR",
          },
        };

        // Add sachets pricing if there are sachet items
        if (sachetOrderItems.length > 0) {
          pricingBreakdown.sachets = {
            subTotal: roundAmount(sachetSubTotal),
            discountedPrice: roundAmount(sachetDiscountedPrice),
            membershipDiscountAmount: roundAmount(sachetMembershipDiscountAmount),
            subscriptionPlanDiscountAmount: roundAmount(sachetSubscriptionPlanDiscountAmount),
            taxAmount: roundAmount(sachetTaxAmount),
            total: sachetTotal,
            currency: currency || "EUR",
          };
        }

        // Add standUpPouch pricing if there are standUpPouch items
        if (standUpPouchOrderItems.length > 0) {
          pricingBreakdown.standUpPouch = {
            subTotal: roundAmount(standUpPouchSubTotal),
            discountedPrice: roundAmount(standUpPouchDiscountedPrice),
            membershipDiscountAmount: roundAmount(standUpPouchMembershipDiscountAmount),
            taxAmount: roundAmount(standUpPouchTaxAmount),
            total: standUpPouchTotal,
            currency: currency || "EUR",
          };
        }

        return pricingBreakdown;
      };

      const pricingBreakdown = calculatePricingBreakdown();

      // Create order
      const order = await Orders.create({
        orderNumber: generateOrderNumber(),
        userId: new mongoose.Types.ObjectId(userId),
        status: OrderStatus.PENDING,
        planType: planType,
        items: orderItems,
        pricing: pricingBreakdown,
        shippingAddressId: new mongoose.Types.ObjectId(shippingAddressId),
        billingAddressId: billingAddressId
          ? new mongoose.Types.ObjectId(billingAddressId)
          : null,
        paymentMethod: paymentMethod || null,
        paymentStatus: paymentStatus,
        couponCode: couponCode || null,
        notes: notes || null,
        metadata: {
          isManualOrder: true,
          createdBy: req.user?._id || null,
          orderType: orderType,
        },
      });

      let paymentLink = null;
      let cartId = null;

      // If pending payment, create cart and generate payment link
      if (orderType === "pending_payment") {
        try {
          // Clear existing cart for user (if any)
          try {
            await cartService.clearCart(userId);
          } catch (error) {
            // Cart might not exist, continue
            logger.info(`No existing cart to clear for user ${userId}`);
          }

          // Add items to cart
          for (const item of items) {
            try {
              await cartService.addItem(userId, {
                productId: item.productId,
                variantType: item.variantType,
                quantity: item.quantity || 1,
              });
            } catch (error: any) {
              logger.error(
                `Failed to add item ${item.productId} to cart: ${error.message}`,
              );
              throw new AppError(
                `Failed to add item to cart: ${error.message}`,
                500,
              );
            }
          }

          // Apply coupon if provided
          if (couponCode) {
            try {
              await cartService.applyCoupon(userId, couponCode);
            } catch (error: any) {
              logger.warn(
                `Failed to apply coupon ${couponCode}: ${error.message}`,
              );
              // Continue even if coupon fails
            }
          }

          // Get updated cart
          const updatedCart = await Carts.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            isDeleted: false,
          }).lean();

          cartId = updatedCart?._id ? String(updatedCart._id) : null;
        } catch (error: any) {
          logger.error(
            `Failed to create cart for manual order: ${error.message}`,
          );
          // Continue even if cart creation fails - we'll still generate a payment link
        }

        // Always generate payment link (even if cart creation failed)
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
        if (cartId) {
          paymentLink = `${frontendUrl}/checkout?orderId=${order._id}&cartId=${cartId}`;
        } else {
          // Fallback: generate link with just orderId if cart creation failed
          paymentLink = `${frontendUrl}/checkout?orderId=${order._id}`;
        }

        logger.info(
          `Generated payment link for order ${order.orderNumber}: ${paymentLink}`,
        );

        // Send payment request email
        try {
          await this.sendPaymentRequestEmail(user, order, paymentLink);
          logger.info(
            `Payment request email sent to ${user.email} for order ${order.orderNumber}`,
          );
        } catch (error: any) {
          logger.error(
            `Failed to send payment request email: ${error.message}`,
          );
          // Don't fail order creation if email fails
        }
      }

      res.status(201).json({
        success: true,
        data: {
          order: {
            _id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            grandTotal: order.pricing?.overall?.grandTotal || 0,
            currency: order.pricing?.overall?.currency || "EUR",
            orderType: orderType,
            paymentLink: paymentLink,
            cartId: cartId,
          },
        },
        message:
          orderType === "already_paid"
            ? "Order created successfully (Already Paid)"
            : "Order created successfully. Payment request email sent to customer.",
      });
    },
  );

  /**
   * Helper method to get plan key from days
   */
  private getPlanKeyFromDays(days: number): string {
    switch (days) {
      case 30:
        return "thirtyDays";
      case 60:
        return "sixtyDays";
      case 90:
        return "ninetyDays";
      case 180:
        return "oneEightyDays";
      default:
        return "thirtyDays";
    }
  }

  /**
   * Send payment request email to customer
   */
  private async sendPaymentRequestEmail(
    user: any,
    order: any,
    paymentLink: string | null,
  ): Promise<void> {
    const userName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Customer";
    const orderNumber = order.orderNumber;
    const orderTotal = `${order.pricing?.overall?.currency || "EUR"} ${(
      order.pricing?.overall?.grandTotal || 0
    ).toFixed(2)}`;

    // Ensure paymentLink is always provided for pending payment orders
    if (!paymentLink) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
      paymentLink = `${frontendUrl}/checkout?orderId=${order._id}`;
      logger.warn(
        `Payment link was null, generated fallback link: ${paymentLink}`,
      );
    }

    const emailSubject = `Payment Request for Order ${orderNumber}`;

    // Escape HTML in user input to prevent XSS
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const safeUserName = escapeHtml(userName);
    const safeOrderNumber = escapeHtml(orderNumber);
    const safeOrderTotal = escapeHtml(orderTotal);
    const safePaymentLink = escapeHtml(paymentLink);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Request</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <h1 style="color: #2c3e50; margin-top: 0;">Payment Request</h1>
  </div>
  
  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0;">
    <p>Dear ${safeUserName},</p>
    
    <p>We have created an order for you and require payment to proceed with processing and shipping.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <h2 style="color: #2c3e50; margin-top: 0; font-size: 18px;">Order Details</h2>
      <p style="margin: 5px 0;"><strong>Order Number:</strong> ${safeOrderNumber}</p>
      <p style="margin: 5px 0;"><strong>Total Amount:</strong> ${safeOrderTotal}</p>
      <p style="margin: 5px 0;"><strong>Status:</strong> Pending Payment</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${paymentLink}" 
         style="background-color: #007bff; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Complete Payment
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; text-align: center;">
      Or copy and paste this link into your browser:<br>
      <a href="${paymentLink}" style="color: #007bff; word-break: break-all; text-decoration: underline;">${safePaymentLink}</a>
    </p>
    
    <p style="margin-top: 30px;">If you have any questions or concerns, please don't hesitate to contact our support team.</p>
    
    <p>Thank you for your business!</p>
    
    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>The Viteezy Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</body>
</html>
    `;

    const emailText = `
Payment Request

Dear ${userName},

We have created an order for you and require payment to proceed with processing and shipping.

Order Details:
- Order Number: ${orderNumber}
- Total Amount: ${orderTotal}
- Status: Pending Payment

Complete your payment by visiting: ${paymentLink}

If you have any questions or concerns, please don't hesitate to contact our support team.

Thank you for your business!

Best regards,
The Viteezy Team

---
This is an automated email. Please do not reply to this message.
    `;

    logger.info(
      `Sending payment request email to ${user.email} with payment link: ${paymentLink}`,
    );

    await emailService.sendCustomEmail(
      user.email,
      emailSubject,
      emailHtml,
      emailText,
    );
  }

  /*
   * Process partial refund for specific products in an order
   * @route POST /api/v1/admin/orders/:id/partial-refund
   * @access Admin
   *
   * This endpoint allows admin to:
   * - Refund specific products from an order
   * - Remove refunded products from the order
   * - Remove refunded products from associated subscription (if applicable)
   * - Process refund via gateway or mark for manual processing
   */
  processPartialRefund = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const {
        productIds,
        refundAmount,
        refundMethod = "gateway",
        reason,
        metadata,
      } = req.body;

      if (
        !productIds ||
        !Array.isArray(productIds) ||
        productIds.length === 0
      ) {
        throw new AppError("At least one product ID is required", 400);
      }

      const adminId = req.user?._id;

      const result = await orderService.processPartialRefund({
        orderId: id,
        productIds,
        refundAmount,
        refundMethod,
        reason,
        metadata,
        adminId: adminId ? String(adminId) : undefined,
      });

      // Fetch updated order
      const updatedOrder = await Orders.findOne({
        _id: id,
        isDeleted: { $ne: true },
      })
        .populate("userId", "firstName lastName email")
        .populate("items.productId", "title slug")
        .lean();

      res.apiSuccess(
        {
          refund: {
            refundedItems: result.refundedItems,
            refundAmount: result.refundAmount,
            refundMethod,
            orderUpdated: result.orderUpdated,
            subscriptionUpdated: result.subscriptionUpdated,
            refundProcessed: result.refundProcessed,
          },
          order: updatedOrder,
        },
        result.message,
      );
    },
  );
}

export const adminOrderController = new AdminOrderController();
