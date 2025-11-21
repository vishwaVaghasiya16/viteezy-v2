import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Orders, Payments, Products } from "@/models/commerce";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
}

class OrderController {
  /**
   * Get order history for authenticated user (Paginated)
   * @route GET /api/orders
   * @access Private
   */
  getOrderHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { page, limit, skip, sort } = getPaginationOptions(req);
      const { status, paymentStatus, startDate, endDate } = req.query;

      // Build filter for user's orders
      const filter: any = {
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      };

      // Filter by order status
      if (status) {
        filter.status = status;
      }

      // Filter by payment status
      if (paymentStatus) {
        filter.paymentStatus = paymentStatus;
      }

      // Filter by date range
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
          filter.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          filter.createdAt.$lte = new Date(endDate as string);
        }
      }

      // Default sort by latest orders
      const sortOptions: any = { createdAt: -1 };
      if (sort && typeof sort === "object") {
        Object.assign(sortOptions, sort);
      }

      // Get total count
      const total = await Orders.countDocuments(filter);

      // Get orders with pagination
      const orders = await Orders.find(filter)
        .select(
          "orderNumber status items subtotal tax shipping discount total paymentMethod paymentStatus trackingNumber shippedAt deliveredAt createdAt"
        )
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();

      // Transform orders for response
      const transformedOrders = orders.map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items.map((item: any) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: item.name,
          sku: item.sku,
          price: item.price,
        })),
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount,
          total: order.total,
        },
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
      }));

      const pagination = getPaginationMeta(page, limit, total);

      res.apiPaginated(
        transformedOrders,
        pagination,
        "Order history retrieved successfully"
      );
    }
  );

  /**
   * Get order details by ID
   * Includes product details, payment data, and shipping address
   * @route GET /api/orders/:orderId
   * @access Private
   */
  getOrderDetails = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      if (!req.user?._id) {
        throw new AppError("User not authenticated", 401);
      }

      const { orderId } = req.params;

      // Validate orderId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new AppError("Invalid order ID", 400);
      }

      // Get order
      const order = await Orders.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      }).lean();

      if (!order) {
        throw new AppError("Order not found", 404);
      }

      // Get payment details for this order
      let paymentData = null;
      const payment = await Payments.findOne({
        orderId: new mongoose.Types.ObjectId(orderId),
        userId: new mongoose.Types.ObjectId(req.user._id),
        isDeleted: false,
      })
        .select(
          "paymentMethod status amount currency transactionId gatewayTransactionId gatewayResponse failureReason refundAmount refundReason refundedAt processedAt createdAt"
        )
        .lean();

      if (payment) {
        paymentData = {
          id: payment._id,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          transactionId: payment.transactionId,
          gatewayTransactionId: payment.gatewayTransactionId,
          failureReason: payment.failureReason,
          refundAmount: payment.refundAmount,
          refundReason: payment.refundReason,
          refundedAt: payment.refundedAt,
          processedAt: payment.processedAt,
          createdAt: payment.createdAt,
        };
      }

      // Get all product IDs from order items
      const productIds = order.items
        .map((item: any) => item.productId)
        .filter((id: any) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id: any) => new mongoose.Types.ObjectId(id));

      // Fetch all products in one query
      const products = await Products.find({
        _id: { $in: productIds },
        isDeleted: false,
      })
        .select("title slug description media categories tags status")
        .lean();

      // Create a map for quick lookup
      const productMap = new Map(
        products.map((p: any) => [p._id.toString(), p])
      );

      // Transform order items with product details
      const itemsWithProducts = order.items.map((item: any) => {
        const product = item.productId
          ? productMap.get(item.productId.toString())
          : null;

        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          name: item.name,
          sku: item.sku,
          price: item.price,
          product: product
            ? {
                id: product._id,
                title: product.title,
                slug: product.slug,
                description: product.description,
                media: product.media,
                categories: product.categories,
                tags: product.tags,
                status: product.status,
              }
            : null,
        };
      });

      // Build response
      const orderDetails = {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: itemsWithProducts,
        pricing: {
          subtotal: order.subtotal,
          tax: order.tax,
          shipping: order.shipping,
          discount: order.discount,
          total: order.total,
        },
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        paymentMethod: order.paymentMethod,
        payment: paymentData,
        couponCode: order.couponCode,
        notes: order.notes,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };

      res.apiSuccess(
        { order: orderDetails },
        "Order details retrieved successfully"
      );
    }
  );
}

export const orderController = new OrderController();
