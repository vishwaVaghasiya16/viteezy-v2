import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler, getPaginationOptions, getPaginationMeta } from "@/utils";
import { AppError } from "@/utils/AppError";
import { notificationService } from "@/services/notificationService";
import { NotificationCategory } from "@/models/enums";

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
        data: {
          notifications: result.notifications,
          pagination: getPaginationMeta(
            paginationOptions.page,
            paginationOptions.limit,
            result.total
          ),
        },
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
}

export const notificationController = new NotificationController();

