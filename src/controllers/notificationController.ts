import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { notificationService } from "@/services/notificationService";
import { NotificationCategory, NotificationType } from "@/models/enums";

interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    id?: string;
  };
  userId?: string;
}

class NotificationController {
  /**
   * Get user notifications (paginated)
   * @route GET /api/notifications
   * @access Private
   * @query page, limit, category, isRead
   */
  getNotifications = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const paginationOptions = getPaginationOptions(req);
      const { category, isRead } = req.query;

      // Validate category if provided
      let notificationCategory: NotificationCategory | undefined;
      if (category) {
        if (!Object.values(NotificationCategory).includes(category as NotificationCategory)) {
          throw new AppError("Invalid notification category", 400);
        }
        notificationCategory = category as NotificationCategory;
      }

      // Validate isRead if provided
      let readStatus: boolean | undefined;
      if (isRead !== undefined) {
        if (isRead === "true" || isRead === "1") {
          readStatus = true;
        } else if (isRead === "false" || isRead === "0") {
          readStatus = false;
        } else {
          throw new AppError("Invalid isRead value. Must be 'true', 'false', '1', or '0'", 400);
        }
      }

      const result = await notificationService.getUserNotifications(
        userId,
        {
          limit: paginationOptions.limit,
          skip: (paginationOptions.page - 1) * paginationOptions.limit,
          category: notificationCategory,
          isRead: readStatus,
        }
      );

      res.status(200).json({
        success: true,
        message: "Notifications retrieved successfully",
        data:  result.notifications,
        pagination: getPaginationMeta(
          paginationOptions.page,
          paginationOptions.limit,
          result.total
        ),
      });
    }
  );

  /**
   * Get unread notification count
   * @route GET /api/notifications/unread-count
   * @access Private
   */
  getUnreadCount = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const count = await notificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        message: "Unread count retrieved successfully",
        data: {
          unreadCount: count,
        },
      });
    }
  );

  /**
   * Mark single notification as read
   * @route PATCH /api/notifications/:notificationId/read
   * @access Private
   */
  markAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { notificationId } = req.params;

      if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new AppError("Valid notification ID is required", 400);
      }

      const notification = await notificationService.markAsRead(notificationId, userId);

      res.status(200).json({
        success: true,
        message: "Notification marked as read",
        data: {
          notification,
        },
      });
    }
  );

  /**
   * Mark all notifications as read
   * @route PATCH /api/notifications/read-all
   * @access Private
   */
  markAllAsRead = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const result = await notificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: "All notifications marked as read",
        data: {
          markedCount: result.count,
        },
      });
    }
  );

  /**
   * Delete notification (soft delete)
   * @route DELETE /api/notifications/:notificationId
   * @access Private
   */
  deleteNotification = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?._id || req.user?.id || req.userId;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const { notificationId } = req.params;

      if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId)) {
        throw new AppError("Valid notification ID is required", 400);
      }

      await notificationService.deleteNotification(notificationId, userId);

      res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    }
  );

  /**
   * Create mock notification (for testing)
   * @route POST /api/test/notifications
   * @access Private (or public for testing)
   * @body userId, category, title, message, and optional fields
   */
  createMockNotification = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const {
        userId,
        category,
        type,
        title,
        message,
        data,
        redirectUrl,
        appRoute,
        query,
        skipPush = false,
      } = req.body;

      // Create notification payload
      const payload = {
        userId,
        category,
        type: (type as NotificationType) || NotificationType.NORMAL,
        title,
        message,
        data: data || {},
        redirectUrl,
        appRoute,
        query: query || {},
      };

      // If skipPush is true, create notification without sending push
      // Otherwise, use the real notification service
      let notification;
      if (skipPush) {
        // Mock response - simulate notification creation without DB or push
        notification = {
          _id: new mongoose.Types.ObjectId(),
          userId: new mongoose.Types.ObjectId(userId),
          category,
          type: (type as NotificationType) || NotificationType.NORMAL,
          title,
          message,
          data: data || {},
          redirectUrl,
          appRoute,
          query: query || {},
          isRead: false,
          pushSent: false,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      } else {
        // Use real notification service
        notification = await notificationService.createNotification(payload);
      }

      res.status(201).json({
        success: true,
        message: skipPush
          ? "Mock notification created successfully (push skipped)"
          : "Notification created and sent successfully",
        data: {
          notification,
          mock: skipPush,
        },
      });
    }
  );
}

export const notificationController = new NotificationController();

