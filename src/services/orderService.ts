import mongoose from "mongoose";
import { Orders, Subscriptions, Payments } from "@/models/commerce";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import { PaymentStatus, OrderStatus, SubscriptionStatus, OrderPlanType } from "@/models/enums";
import { paymentService } from "./payment/PaymentService";

interface PartialRefundRequest {
  orderId: string;
  productIds: string[];
  refundAmount?: number;
  refundMethod: "manual" | "gateway";
  reason?: string;
  metadata?: Record<string, any>;
  adminId?: string;
}

interface RefundedItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  amount: number;
  taxRate: number;
  totalAmount: number;
}

interface PartialRefundResult {
  success: boolean;
  refundedItems: RefundedItem[];
  refundAmount: number;
  orderUpdated: boolean;
  subscriptionUpdated: boolean;
  refundProcessed: boolean;
  message: string;
}

class OrderService {
  /**
   * Round amount to 2 decimal places
   */
  private roundAmount(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Process partial refund for specific products in an order
   * Removes products from order and associated subscription (if applicable)
   */
  async processPartialRefund(
    request: PartialRefundRequest
  ): Promise<PartialRefundResult> {
    const { orderId, productIds, refundAmount, refundMethod, reason, metadata, adminId } = request;

    // 1. Fetch and validate order
    const order = await Orders.findOne({
      _id: orderId,
      isDeleted: { $ne: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      throw new AppError("Cannot refund products from a cancelled or fully refunded order", 400);
    }

    // 2. Validate product IDs exist in order
    const productObjectIds = productIds.map((id) => new mongoose.Types.ObjectId(id));
    const orderProductIds = order.items.map((item) => item.productId.toString());
    
    const invalidProductIds = productIds.filter(
      (id) => !orderProductIds.includes(id)
    );

    if (invalidProductIds.length > 0) {
      throw new AppError(
        `Products not found in order: ${invalidProductIds.join(", ")}`,
        400
      );
    }

    // 3. Get items to refund
    const itemsToRefund = order.items.filter((item) =>
      productObjectIds.some((pid) => pid.equals(item.productId))
    );

    if (itemsToRefund.length === 0) {
      throw new AppError("No valid products found to refund", 400);
    }

    // 4. Calculate refund amount
    let calculatedRefundAmount = refundAmount;
    if (!calculatedRefundAmount) {
      // Calculate based on totalAmount of refunded items
      calculatedRefundAmount = this.roundAmount(
        itemsToRefund.reduce((sum, item) => sum + item.totalAmount, 0)
      );
    } else {
      calculatedRefundAmount = this.roundAmount(calculatedRefundAmount);
    }

    const overallPricing = (order as any).pricing?.overall || {
      subTotal: 0,
      discountedPrice: 0,
      couponDiscountAmount: 0,
      membershipDiscountAmount: 0,
      subscriptionPlanDiscountAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      currency: "EUR",
    };

    // Validate refund amount doesn't exceed order total
    if (calculatedRefundAmount > overallPricing.grandTotal) {
      throw new AppError(
        "Refund amount cannot exceed order grand total",
        400
      );
    }

    // 5. Remove products from order
    const remainingItems = order.items.filter(
      (item) => !productObjectIds.some((pid) => pid.equals(item.productId))
    );

    if (remainingItems.length === 0) {
      throw new AppError(
        "Cannot refund all products. Please cancel the entire order instead.",
        400
      );
    }

    // Recalculate order totals
    const newSubTotal = this.roundAmount(
      remainingItems.reduce((sum, item) => sum + item.amount, 0)
    );
    const newDiscountedPrice = this.roundAmount(
      remainingItems.reduce((sum, item) => sum + item.discountedPrice, 0)
    );
    
    // Calculate tax amount from remaining items
    // taxRate in order items is stored as an amount (not percentage)
    // So we sum taxRate values directly
    const newTaxAmount = this.roundAmount(
      remainingItems.reduce((sum, item) => sum + (item.taxRate || 0), 0)
    );

    // Recalculate grand total
    // Formula: (discountedPrice - all discounts) + taxAmount
    // This matches the order creation formula in checkoutService
    const subtotalAfterAllDiscounts = this.roundAmount(
      Math.max(
        0,
        newDiscountedPrice -
          (overallPricing.membershipDiscountAmount || 0) -
          (overallPricing.subscriptionPlanDiscountAmount || 0) -
          (overallPricing.couponDiscountAmount || 0)
      )
    );
    const newGrandTotal = this.roundAmount(subtotalAfterAllDiscounts + newTaxAmount);

    // Update order
    order.items = remainingItems;
    (order as any).pricing = {
      ...((order as any).pricing || {}),
      overall: {
        ...overallPricing,
        subTotal: newSubTotal,
        discountedPrice: newDiscountedPrice,
        taxAmount: newTaxAmount,
        grandTotal: Math.max(0, newGrandTotal), // Ensure non-negative
      },
    };

    // Track refunded items in metadata
    if (!order.metadata) {
      order.metadata = {};
    }
    if (!order.metadata.refundedItems) {
      order.metadata.refundedItems = [];
    }
    
    const refundedItemsData = itemsToRefund.map((item) => ({
      productId: item.productId.toString(),
      name: item.name,
      amount: item.amount,
      taxRate: item.taxRate,
      totalAmount: item.totalAmount,
      refundedAt: new Date(),
      refundedBy: adminId,
      refundAmount: item.totalAmount,
      reason: reason || "Partial refund",
    }));

    order.metadata.refundedItems = [
      ...(order.metadata.refundedItems as any[]),
      ...refundedItemsData,
    ];

    // If all items refunded, mark order as refunded
    if (order.items.length === 0) {
      order.status = OrderStatus.REFUNDED;
      order.paymentStatus = PaymentStatus.REFUNDED;
    }

    await order.save();

    // 6. Update subscription if applicable
    let subscriptionUpdated = false;
    if (order.planType === OrderPlanType.SUBSCRIPTION && order.paymentId) {
      const subscription = await Subscriptions.findOne({
        orderId: order._id,
        isDeleted: { $ne: true },
      });

      if (subscription) {
        // Remove refunded products from subscription items
        const remainingSubscriptionItems = subscription.items.filter(
          (item) => !productObjectIds.some((pid) => pid.equals(item.productId))
        );

        if (remainingSubscriptionItems.length > 0) {
          subscription.items = remainingSubscriptionItems;
          
          // Update subscription metadata
          if (!subscription.metadata) {
            subscription.metadata = {};
          }
          subscription.metadata.partialRefund = {
            refundedAt: new Date(),
            refundedBy: adminId,
            refundedProductIds: productIds,
            refundAmount: calculatedRefundAmount,
            reason: reason || "Partial refund",
          };

          await subscription.save();
          subscriptionUpdated = true;
        } else {
          // If all items removed, cancel subscription
          subscription.status = SubscriptionStatus.CANCELLED;
          subscription.cancelledAt = new Date();
          if (adminId) {
            subscription.cancelledBy = new mongoose.Types.ObjectId(adminId);
          }
          subscription.cancellationReason = "All products refunded";
          await subscription.save();
          subscriptionUpdated = true;
        }
      }
    }

    // 7. Process refund payment
    let refundProcessed = false;
    if (refundMethod === "gateway" && order.paymentId) {
      try {
        const payment = await Payments.findById(order.paymentId);
        if (payment && payment.status === PaymentStatus.COMPLETED) {
          await paymentService.refundPayment({
            paymentId: order.paymentId,
            amount: calculatedRefundAmount,
            reason: reason || `Partial refund for products: ${itemsToRefund.map((i) => i.name).join(", ")}`,
            metadata: {
              orderId: orderId,
              productIds: productIds.join(","),
              refundMethod: "partial",
              ...metadata,
            },
          });
          refundProcessed = true;
        }
      } catch (error: any) {
        logger.error(`Failed to process gateway refund: ${error.message}`);
        // Continue even if gateway refund fails - admin can process manually
      }
    }

    // For manual refunds, just mark in metadata
    if (refundMethod === "manual") {
      if (!order.metadata) {
        order.metadata = {};
      }
      order.metadata.manualRefund = {
        amount: calculatedRefundAmount,
        processedAt: new Date(),
        processedBy: adminId,
        reason: reason || "Manual partial refund",
      };
      await order.save();
    }

    logger.info(
      `Partial refund processed for order ${order.orderNumber}: ${calculatedRefundAmount} ${overallPricing.currency}`
    );

    return {
      success: true,
      refundedItems: itemsToRefund.map((item) => ({
        productId: item.productId,
        name: item.name,
        amount: item.amount,
        taxRate: item.taxRate,
        totalAmount: item.totalAmount,
      })),
      refundAmount: calculatedRefundAmount,
      orderUpdated: true,
      subscriptionUpdated,
      refundProcessed: refundMethod === "gateway" ? refundProcessed : true, // Manual refunds are considered processed
      message: refundMethod === "manual"
        ? "Refund marked for manual processing"
        : refundProcessed
        ? "Refund processed successfully"
        : "Refund calculation completed but gateway refund failed. Please process manually.",
    };
  }
}

export const orderService = new OrderService();
