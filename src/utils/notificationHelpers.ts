import mongoose from "mongoose";
import { notificationService, NotificationPayload } from "@/services/notificationService";
import {
  NotificationCategory,
  NotificationType,
} from "@/models/enums";
import { logger } from "./logger";

/**
 * Notification Helper Utilities
 * 
 * Provides typed functions for all notification events across the platform.
 * All notifications must go through these helpers to ensure consistency.
 * 
 * Rules:
 * - No redirection notification without query
 * - No query in normal notification
 * - Category must always be present
 * - Query keys must be consistent
 */

/**
 * Build redirect URL for web (website)
 */
function buildRedirectUrl(
  type: "order" | "product" | "subscription" | "membership" | "support" | "delivery" | "payment",
  query: Record<string, string>
): string {
  const baseUrl = process.env.FRONTEND_URL || "https://app.viteezy.com";
  
  switch (type) {
    case "order":
      return `${baseUrl}/orders/${query.orderId}`;
    case "product":
      return `${baseUrl}/products/${query.productId}`;
    case "subscription":
      return `${baseUrl}/subscriptions/${query.subscriptionId}`;
    case "membership":
      return `${baseUrl}/membership/${query.membershipId}`;
    case "support":
      return `${baseUrl}/support/tickets/${query.ticketId}`;
    case "delivery":
      return `${baseUrl}/orders/${query.orderId}`;
    case "payment":
      return `${baseUrl}/orders/${query.orderId}`;
    default:
      return baseUrl;
  }
}

/**
 * Build mobile app route and query based on notification type
 * Returns { appRoute, query } for mobile app navigation
 */
function buildMobileAppRoute(
  routeType: "dashboard" | "orderDetail" | "product-detail" | "subscription" | "membership" | "support" | "ai-chat",
  queryParams?: Record<string, string>
): { appRoute: string; query: Record<string, string> } {
  const routeMap: Record<string, string> = {
    dashboard: "/dashboard",
    "orderDetail": "/orderDetail",
    "product-detail": "/product-detail",
    subscription: "/subscription",
    membership: "/membership",
    support: "/support",
    "ai-chat": "/ai-chat",
  };

  const appRoute = routeMap[routeType] || "/dashboard";
  
  // For dashboard, query must be empty object
  if (appRoute === "/dashboard") {
    return { appRoute, query: {} };
  }

  // For other routes, query is required
  if (!queryParams || Object.keys(queryParams).length === 0) {
    throw new Error(`Query parameters are required for route: ${appRoute}`);
  }

  return { appRoute, query: queryParams };
}

/**
 * Validate notification payload according to rules
 */
function validateNotificationPayload(
  type: NotificationType,
  category: NotificationCategory,
  query?: Record<string, string>
): void {
  // Rule: No redirection notification without query
  if (type === NotificationType.REDIRECTION && (!query || Object.keys(query).length === 0)) {
    throw new Error("Redirection notifications must include query parameters");
  }

  // Rule: No query in normal notification
  if (type === NotificationType.NORMAL && query && Object.keys(query).length > 0) {
    throw new Error("Normal notifications should not include query parameters");
  }

  // Rule: Category must always be present
  if (!category) {
    throw new Error("Notification category is required");
  }
}

// ============================================================================
// A. PROMOTIONAL NOTIFICATIONS
// ============================================================================

export const promotionalNotifications = {
  /**
   * General offer / discount
   * Route: /dashboard, Query: {}
   */
  async generalOffer(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },

  /**
   * Coupon available
   * Route: /dashboard, Query: {}
   */
  async couponAvailable(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },

  /**
   * Product-specific offer
   * Route: /product-detail, Query: { productId }
   */
  async productOffer(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PROMOTIONAL, { productId });
    const { appRoute, query } = buildMobileAppRoute("product-detail", { productId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.REDIRECTION,
      title,
      message,
      redirectUrl: buildRedirectUrl("product", { productId }),
      appRoute,
      query,
      data: { productId },
      createdBy,
    });
  },

  /**
   * New product launch
   * Route: /product-detail, Query: { productId }
   */
  async newProductLaunch(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PROMOTIONAL, { productId });
    const { appRoute, query } = buildMobileAppRoute("product-detail", { productId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.REDIRECTION,
      title,
      message,
      redirectUrl: buildRedirectUrl("product", { productId }),
      appRoute,
      query,
      data: { productId },
      createdBy,
    });
  },

  /**
   * Product back in stock
   * Route: /product-detail, Query: { productId }
   */
  async productBackInStock(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PROMOTIONAL, { productId });
    const { appRoute, query } = buildMobileAppRoute("product-detail", { productId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.REDIRECTION,
      title,
      message,
      redirectUrl: buildRedirectUrl("product", { productId }),
      appRoute,
      query,
      data: { productId },
      createdBy,
    });
  },

  /**
   * Festival greeting
   * Route: /dashboard, Query: {}
   */
  async festivalGreeting(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },

  /**
   * Festival sale
   * Route: /dashboard, Query: {}
   */
  async festivalSale(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PROMOTIONAL,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },
};

// ============================================================================
// B. ORDER NOTIFICATIONS
// ============================================================================

export const orderNotifications = {
  /**
   * Order placed
   * Route: /orderDetail, Query: { orderId }
   */
  async orderPlaced(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Placed",
      message: `Your order ${orderNumber} has been placed successfully.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },

  /**
   * Order confirmed
   * Route: /orderDetail, Query: { orderId }
   */
  async orderConfirmed(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Confirmed",
      message: `Your order ${orderNumber} has been confirmed.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },

  /**
   * Order packed
   * Route: /orderDetail, Query: { orderId }
   */
  async orderPacked(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Packed",
      message: `Your order ${orderNumber} has been packed and is ready for shipment.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },

  /**
   * Order shipped
   * Route: /orderDetail, Query: { orderId }
   */
  async orderShipped(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    trackingNumber?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    const message = trackingNumber
      ? `Your order ${orderNumber} has been shipped. Track it with ${trackingNumber}.`
      : `Your order ${orderNumber} has been shipped.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Shipped",
      message,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, trackingNumber },
      createdBy,
    });
  },

  /**
   * Out for delivery
   * Route: /orderDetail, Query: { orderId }
   */
  async outForDelivery(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Out for Delivery",
      message: `Your order ${orderNumber} is out for delivery and will arrive soon.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },

  /**
   * Order delivered
   * Route: /orderDetail, Query: { orderId }
   */
  async orderDelivered(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Delivered",
      message: `Your order ${orderNumber} has been delivered successfully.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },

  /**
   * Order cancelled
   * Route: /orderDetail, Query: { orderId }
   */
  async orderCancelled(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    reason?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.ORDER, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    const message = reason
      ? `Your order ${orderNumber} has been cancelled. Reason: ${reason}`
      : `Your order ${orderNumber} has been cancelled.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.ORDER,
      type: NotificationType.REDIRECTION,
      title: "Order Cancelled",
      message,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, reason },
      createdBy,
    });
  },
};

// ============================================================================
// C. DELIVERY NOTIFICATIONS
// ============================================================================

export const deliveryNotifications = {
  /**
   * Delivery scheduled
   * Route: /dashboard, Query: {}
   */
  async deliveryScheduled(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.DELIVERY,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },

  /**
   * Delivery delayed
   * Route: /dashboard, Query: {}
   */
  async deliveryDelayed(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.DELIVERY,
      type: NotificationType.NORMAL,
      title,
      message,
      appRoute,
      query,
      createdBy,
    });
  },

  /**
   * Address issue
   * Route: /orderDetail, Query: { orderId }
   */
  async addressIssue(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    issue: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.DELIVERY, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.DELIVERY,
      type: NotificationType.REDIRECTION,
      title: "Address Issue",
      message: `There's an issue with the delivery address for order ${orderNumber}. ${issue}`,
      redirectUrl: buildRedirectUrl("delivery", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, issue },
      createdBy,
    });
  },

  /**
   * Delivery postponement approved
   * Route: /orderDetail, Query: { orderId }
   */
  async postponementApproved(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    newDate?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.DELIVERY, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    const message = newDate
      ? `Your delivery postponement request for order ${orderNumber} has been approved. New delivery date: ${newDate}.`
      : `Your delivery postponement request for order ${orderNumber} has been approved.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.DELIVERY,
      type: NotificationType.REDIRECTION,
      title: "Delivery Postponed",
      message,
      redirectUrl: buildRedirectUrl("delivery", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, newDate },
      createdBy,
    });
  },

  /**
   * Delivery postponement rejected
   * Route: /orderDetail, Query: { orderId }
   */
  async postponementRejected(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    reason?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.DELIVERY, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    const message = reason
      ? `Your delivery postponement request for order ${orderNumber} has been rejected. Reason: ${reason}`
      : `Your delivery postponement request for order ${orderNumber} has been rejected.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.DELIVERY,
      type: NotificationType.REDIRECTION,
      title: "Postponement Rejected",
      message,
      redirectUrl: buildRedirectUrl("delivery", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, reason },
      createdBy,
    });
  },
};

// ============================================================================
// D. PAYMENT & TRANSACTION NOTIFICATIONS
// ============================================================================

export const paymentNotifications = {
  /**
   * Payment successful
   * Route: /orderDetail, Query: { orderId }
   */
  async paymentSuccessful(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    amount: number,
    currency: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PAYMENT, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PAYMENT,
      type: NotificationType.REDIRECTION,
      title: "Payment Successful",
      message: `Your payment of ${amount} ${currency} for order ${orderNumber} was successful.`,
      redirectUrl: buildRedirectUrl("payment", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, amount, currency },
      createdBy,
    });
  },

  /**
   * Payment failed
   * Route: /orderDetail, Query: { orderId }
   */
  async paymentFailed(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    reason?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PAYMENT, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    const message = reason
      ? `Payment for order ${orderNumber} failed. ${reason}`
      : `Payment for order ${orderNumber} failed. Please try again.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PAYMENT,
      type: NotificationType.REDIRECTION,
      title: "Payment Failed",
      message,
      redirectUrl: buildRedirectUrl("payment", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, reason },
      createdBy,
    });
  },

  /**
   * Refund initiated
   * Route: /orderDetail, Query: { orderId }
   */
  async refundInitiated(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    amount: number,
    currency: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PAYMENT, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PAYMENT,
      type: NotificationType.REDIRECTION,
      title: "Refund Initiated",
      message: `A refund of ${amount} ${currency} for order ${orderNumber} has been initiated.`,
      redirectUrl: buildRedirectUrl("payment", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, amount, currency },
      createdBy,
    });
  },

  /**
   * Refund completed
   * Route: /orderDetail, Query: { orderId }
   */
  async refundCompleted(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    amount: number,
    currency: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PAYMENT, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PAYMENT,
      type: NotificationType.REDIRECTION,
      title: "Refund Completed",
      message: `Your refund of ${amount} ${currency} for order ${orderNumber} has been processed.`,
      redirectUrl: buildRedirectUrl("payment", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, amount, currency },
      createdBy,
    });
  },

  /**
   * Chargeback raised
   * Route: /orderDetail, Query: { orderId }
   */
  async chargebackRaised(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.PAYMENT, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.PAYMENT,
      type: NotificationType.REDIRECTION,
      title: "Chargeback Raised",
      message: `A chargeback has been raised for order ${orderNumber}. Please contact support.`,
      redirectUrl: buildRedirectUrl("payment", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber },
      createdBy,
    });
  },
};

// ============================================================================
// E. SUBSCRIPTION & MEMBERSHIP NOTIFICATIONS
// ============================================================================

export const subscriptionNotifications = {
  /**
   * Subscription activated (after payment success)
   * Route: /subscription, Query: { subscriptionId }
   * This notification is sent when payment is successful and subscription is created/activated
   */
  async subscriptionActivated(
    userId: string | mongoose.Types.ObjectId,
    subscriptionId: string,
    subscriptionNumber?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.MEMBERSHIP, { subscriptionId });
    const { appRoute, query } = buildMobileAppRoute("subscription", { subscriptionId });
    
    const message = subscriptionNumber
      ? `Your subscription ${subscriptionNumber} has been activated successfully.`
      : "Your subscription has been activated successfully.";
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.REDIRECTION,
      title: "Subscription Activated",
      message,
      redirectUrl: buildRedirectUrl("subscription", { subscriptionId }),
      appRoute,
      query,
      data: { subscriptionId, subscriptionNumber },
      createdBy,
    });
  },

  /**
   * Upcoming subscription delivery
   * Route: /dashboard, Query: {}
   */
  async upcomingDelivery(
    userId: string | mongoose.Types.ObjectId,
    deliveryDate: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.NORMAL,
      title: "Upcoming Delivery",
      message: `Your next subscription delivery is scheduled for ${deliveryDate}.`,
      appRoute,
      query,
      data: { deliveryDate },
      createdBy,
    });
  },

  /**
   * Subscription payment failed
   * Route: /subscription, Query: { subscriptionId }
   */
  async subscriptionPaymentFailed(
    userId: string | mongoose.Types.ObjectId,
    subscriptionId: string,
    reason?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.MEMBERSHIP, { subscriptionId });
    const { appRoute, query } = buildMobileAppRoute("subscription", { subscriptionId });
    
    const message = reason
      ? `Your subscription payment failed. ${reason}`
      : `Your subscription payment failed. Please update your payment method.`;
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.REDIRECTION,
      title: "Payment Failed",
      message,
      redirectUrl: buildRedirectUrl("subscription", { subscriptionId }),
      appRoute,
      query,
      data: { subscriptionId, reason },
      createdBy,
    });
  },

  /**
   * Membership purchased
   * Route: /dashboard, Query: {}
   */
  async membershipPurchased(
    userId: string | mongoose.Types.ObjectId,
    membershipPlan: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.NORMAL,
      title: "Membership Purchased",
      message: `Congratulations! You've successfully purchased ${membershipPlan} membership.`,
      appRoute,
      query,
      data: { membershipPlan },
      createdBy,
    });
  },

  /**
   * Membership expiring soon
   * Route: /membership, Query: { membershipId }
   */
  async membershipExpiringSoon(
    userId: string | mongoose.Types.ObjectId,
    membershipId: string,
    expiryDate: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.MEMBERSHIP, { membershipId });
    const { appRoute, query } = buildMobileAppRoute("membership", { membershipId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.REDIRECTION,
      title: "Membership Expiring Soon",
      message: `Your membership is expiring on ${expiryDate}. Renew now to continue enjoying benefits.`,
      redirectUrl: buildRedirectUrl("membership", { membershipId }),
      appRoute,
      query,
      data: { membershipId, expiryDate },
      createdBy,
    });
  },

  /**
   * Membership expired
   * Route: /membership, Query: { membershipId }
   */
  async membershipExpired(
    userId: string | mongoose.Types.ObjectId,
    membershipId: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.MEMBERSHIP, { membershipId });
    const { appRoute, query } = buildMobileAppRoute("membership", { membershipId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.MEMBERSHIP,
      type: NotificationType.REDIRECTION,
      title: "Membership Expired",
      message: "Your membership has expired. Renew now to continue enjoying benefits.",
      redirectUrl: buildRedirectUrl("membership", { membershipId }),
      appRoute,
      query,
      data: { membershipId },
      createdBy,
    });
  },
};

// ============================================================================
// G. REVIEW & FEEDBACK NOTIFICATIONS
// ============================================================================

export const reviewNotifications = {
  /**
   * Review request
   * Route: /product-detail, Query: { productId }
   */
  async reviewRequest(
    userId: string | mongoose.Types.ObjectId,
    productId: string,
    productName: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.GENERAL, { productId });
    const { appRoute, query } = buildMobileAppRoute("product-detail", { productId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.GENERAL,
      type: NotificationType.REDIRECTION,
      title: "Review Request",
      message: `How was your experience with ${productName}? Share your review!`,
      redirectUrl: buildRedirectUrl("product", { productId }),
      appRoute,
      query,
      data: { productId, productName },
      createdBy,
    });
  },

  /**
   * Review submitted
   * Route: /dashboard, Query: {}
   */
  async reviewSubmitted(
    userId: string | mongoose.Types.ObjectId,
    productName: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.GENERAL,
      type: NotificationType.NORMAL,
      title: "Review Submitted",
      message: `Thank you for reviewing ${productName}. Your review is under moderation.`,
      appRoute,
      query,
      data: { productName },
      createdBy,
    });
  },

  /**
   * Review approved
   * Route: /dashboard, Query: {}
   */
  async reviewApproved(
    userId: string | mongoose.Types.ObjectId,
    productName: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.GENERAL,
      type: NotificationType.NORMAL,
      title: "Review Approved",
      message: `Your review for ${productName} has been approved and published.`,
      appRoute,
      query,
      data: { productName },
      createdBy,
    });
  },
};

// ============================================================================
// H. FAMILY ACCOUNT NOTIFICATIONS
// ============================================================================

export const familyNotifications = {
  /**
   * Family member added
   * Route: /dashboard, Query: {}
   */
  async familyMemberAdded(
    userId: string | mongoose.Types.ObjectId,
    memberName: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.FAMILY,
      type: NotificationType.NORMAL,
      title: "Family Member Added",
      message: `${memberName} has been added to your family account.`,
      appRoute,
      query,
      data: { memberName },
      createdBy,
    });
  },

  /**
   * Order placed for family member
   * Route: /orderDetail, Query: { orderId }
   */
  async orderForFamilyMember(
    userId: string | mongoose.Types.ObjectId,
    orderId: string,
    orderNumber: string,
    memberName: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.FAMILY, { orderId });
    const { appRoute, query } = buildMobileAppRoute("orderDetail", { orderId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.FAMILY,
      type: NotificationType.REDIRECTION,
      title: "Order for Family Member",
      message: `An order ${orderNumber} has been placed for ${memberName}.`,
      redirectUrl: buildRedirectUrl("order", { orderId }),
      appRoute,
      query,
      data: { orderId, orderNumber, memberName },
      createdBy,
    });
  },

  /**
   * Family subscription updated
   * Route: /dashboard, Query: {}
   */
  async familySubscriptionUpdated(
    userId: string | mongoose.Types.ObjectId,
    changes: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.FAMILY,
      type: NotificationType.NORMAL,
      title: "Family Subscription Updated",
      message: `Your family subscription has been updated: ${changes}`,
      appRoute,
      query,
      data: { changes },
      createdBy,
    });
  },
};

// ============================================================================
// I. SUPPORT NOTIFICATIONS
// ============================================================================

export const supportNotifications = {
  /**
   * Support ticket created
   * Route: /dashboard, Query: {}
   */
  async ticketCreated(
    userId: string | mongoose.Types.ObjectId,
    ticketNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.SUPPORT,
      type: NotificationType.NORMAL,
      title: "Support Ticket Created",
      message: `Your support ticket #${ticketNumber} has been created. We'll get back to you soon.`,
      appRoute,
      query,
      data: { ticketNumber },
      createdBy,
    });
  },

  /**
   * Support agent replied
   * Route: /support, Query: { ticketId }
   */
  async agentReplied(
    userId: string | mongoose.Types.ObjectId,
    ticketId: string,
    ticketNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    validateNotificationPayload(NotificationType.REDIRECTION, NotificationCategory.SUPPORT, { ticketId });
    const { appRoute, query } = buildMobileAppRoute("support", { ticketId });
    
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.SUPPORT,
      type: NotificationType.REDIRECTION,
      title: "New Reply from Support",
      message: `You have a new reply on support ticket #${ticketNumber}.`,
      redirectUrl: buildRedirectUrl("support", { ticketId }),
      appRoute,
      query,
      data: { ticketId, ticketNumber },
      createdBy,
    });
  },

  /**
   * Ticket resolved
   * Route: /dashboard, Query: {}
   */
  async ticketResolved(
    userId: string | mongoose.Types.ObjectId,
    ticketNumber: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.SUPPORT,
      type: NotificationType.NORMAL,
      title: "Ticket Resolved",
      message: `Your support ticket #${ticketNumber} has been resolved.`,
      appRoute,
      query,
      data: { ticketNumber },
      createdBy,
    });
  },
};

// ============================================================================
// J. SYSTEM NOTIFICATIONS
// ============================================================================

export const systemNotifications = {
  /**
   * Maintenance notice
   * Route: /dashboard, Query: {}
   */
  async maintenanceNotice(
    userId: string | mongoose.Types.ObjectId,
    title: string,
    message: string,
    scheduledTime?: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.SYSTEM,
      type: NotificationType.NORMAL,
      appRoute,
      query,
      title,
      message,
      data: { scheduledTime },
      createdBy,
    });
  },

  /**
   * App update available
   * Route: /dashboard, Query: {}
   */
  async appUpdateAvailable(
    userId: string | mongoose.Types.ObjectId,
    version: string,
    createdBy?: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const { appRoute, query } = buildMobileAppRoute("dashboard");
    await notificationService.createNotification({
      userId,
      category: NotificationCategory.SYSTEM,
      type: NotificationType.NORMAL,
      title: "App Update Available",
      message: `A new version (${version}) of the app is available. Update now for the latest features.`,
      appRoute,
      query,
      data: { version },
      createdBy,
    });
  },
};

/**
 * Export all notification helpers
 */
export const notificationHelpers = {
  promotional: promotionalNotifications,
  order: orderNotifications,
  delivery: deliveryNotifications,
  payment: paymentNotifications,
  subscription: subscriptionNotifications,
  review: reviewNotifications,
  family: familyNotifications,
  support: supportNotifications,
  system: systemNotifications,
};

