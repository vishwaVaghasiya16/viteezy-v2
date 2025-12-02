import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "@/utils";
import { AppError } from "@/utils/AppError";
import { Subscriptions } from "@/models/commerce/subscriptions.model";
import { Orders } from "@/models/commerce/orders.model";
import { Products } from "@/models/commerce/products.model";
import { User } from "@/models/core/users.model";
import { SubscriptionStatus, OrderStatus } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
  };
  userId?: string;
}

class DashboardController {
  /**
   * Get dashboard stats for current user
   * @route GET /api/v1/dashboard/stats
   * @access Private
   */
  getStats = asyncHandler(

    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      const [user, activeSubscriptionsCount, totalOrdersCount] =
        await Promise.all([
          User.findById(userObjectId)
            .select("memberId isMember membershipStatus membershipExpiresAt")
            .lean(),
          Subscriptions.countDocuments({
            userId: userObjectId,
            status: SubscriptionStatus.ACTIVE,
            isDeleted: { $ne: true },
          }),
          Orders.countDocuments({
            userId: userObjectId,
            isDeleted: { $ne: true },
          }),
        ]);

      if (!user) {
        throw new AppError("User not found", 404);
      }

      res.status(200).json({
        success: true,
        message: "Dashboard stats retrieved successfully",
        data: {
          member: {
            memberId: user.memberId,
            isMember: user.isMember,
            membershipStatus: user.membershipStatus,
            membershipExpiresAt: user.membershipExpiresAt,
          },
          counts: {
            activeSubscriptions: activeSubscriptionsCount,
            totalOrders: totalOrdersCount,
          },
        },
      });
    }
  );

  /**
   * Get order overview widget data
   * @route GET /api/v1/dashboard/order-overview
   * @access Private
   */
  getOrderOverview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const userObjectId = new mongoose.Types.ObjectId(userId);

      const [lastOrder, totalOrdersCount] = await Promise.all([
        Orders.findOne({
          userId: userObjectId,
          isDeleted: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .lean(),
        Orders.countDocuments({
          userId: userObjectId,
          isDeleted: { $ne: true },
        }),
      ]);

      if (!lastOrder) {
        res.status(200).json({
          success: true,
          message: "No orders found for user",
          data: {
            totalOrders: 0,
            lastOrder: null,
          },
        });
        return;
      }

      const productIds = Array.from(
        new Set(
          (lastOrder.items || [])
            .map((item: any) => item.productId?.toString())
            .filter(Boolean)
        )
      );

      const products = productIds.length
        ? await Products.find({
            _id: { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("_id productImage title slug")
            .lean()
        : [];

      const productImageMap = new Map(
        products.map((product) => [product._id.toString(), product])
      );

      const orderItems = (lastOrder.items || []).map((item: any) => {
        const productData = productImageMap.get(item.productId?.toString() || "");
        return {
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          productImage: productData?.productImage || null,
          productTitle: productData?.title || item.name || "",
          productSlug: productData?.slug,
        };
      });

      res.status(200).json({
        success: true,
        message: "Order overview retrieved successfully",
        data: {
          totalOrders: totalOrdersCount,
          lastOrder: {
            id: lastOrder._id,
            orderNumber: lastOrder.orderNumber,
            status: lastOrder.status as OrderStatus,
            paymentStatus: lastOrder.paymentStatus,
            createdAt: lastOrder.createdAt,
            items: orderItems,
            totals: {
              subtotal: lastOrder.subtotal,
              tax: lastOrder.tax,
              shipping: lastOrder.shipping,
              discount: lastOrder.discount,
              total: lastOrder.total,
            },
            tracking: {
              trackingNumber: lastOrder.trackingNumber || null,
              shippedAt: lastOrder.shippedAt || null,
              deliveredAt: lastOrder.deliveredAt || null,
            },
            cta: {
              orderDetailsUrl: `/orders/${lastOrder._id.toString()}`,
              orderHistoryUrl: `/orders`,
            },
          },
        },
      });
    }
  );
}

export const dashboardController = new DashboardController();

