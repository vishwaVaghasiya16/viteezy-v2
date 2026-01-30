import { Router } from "express";
import { authenticate } from "@/middleware/auth";
import {
  validateQuery,
  validateParams,
} from "@/middleware/joiValidation";
import {
  getNotificationsQuerySchema,
  notificationIdParamsSchema,
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

export default router;

