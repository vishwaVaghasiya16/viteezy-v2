import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateQuery,
  validateParams,
  validateJoi,
} from "@/middleware/joiValidation";
import {
  getNotificationsQuerySchema,
  notificationIdParamsSchema,
  createMockNotificationSchema,
} from "@/validation/notificationValidation";
import { notificationController } from "@/controllers/notificationController";

const router = Router();

/**
 * All notification routes require authentication
 */
router.use(authenticate);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications (paginated, latest first)
 * @access  Private
 * @query   page, limit, category, isRead
 */
router.get(
  "/",
  validateQuery(getNotificationsQuerySchema),
  notificationController.getNotifications
);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count (for badge display)
 * @access  Private
 */
router.get(
  "/unread-count",
  notificationController.getUnreadCount
);

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark single notification as read
 * @access  Private
 * @params  notificationId
 */
router.patch(
  "/:notificationId/read",
  validateParams(notificationIdParamsSchema),
  notificationController.markAsRead
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch(
  "/read-all",
  notificationController.markAllAsRead
);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete notification (soft delete)
 * @access  Private
 * @params  notificationId
 */
router.delete(
  "/:notificationId",
  validateParams(notificationIdParamsSchema),
  notificationController.deleteNotification
);

/**
 * @route   POST /api/notifications/test
 * @desc    Create a mock notification for testing
 * @access  Private
 * @body    {
 *            userId: string (ObjectId),
 *            category: string (NotificationCategory),
 *            type?: string (NotificationType, default: "Normal"),
 *            title: string (max 200 chars),
 *            message: string (max 1000 chars),
 *            data?: object,
 *            redirectUrl?: string (URI),
 *            appRoute?: string,
 *            query?: object,
 *            skipPush?: boolean (default: false)
 *          }
 * 
 * @example
 * POST /api/notifications/test
 * {
 *   "userId": "507f1f77bcf86cd799439011",
 *   "category": "Order",
 *   "title": "Order Confirmed",
 *   "message": "Your order #12345 has been confirmed",
 *   "data": { "orderId": "12345" },
 *   "appRoute": "/orderDetail",
 *   "query": { "orderId": "12345" },
 *   "skipPush": true
 * }
 */
router.post(
  "/test",
  validateJoi(createMockNotificationSchema),
  notificationController.createMockNotification
);

export default router;

