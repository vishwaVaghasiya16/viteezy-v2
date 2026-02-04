import mongoose from "mongoose";
import { AppError } from "@/utils/AppError";
import { logger } from "@/utils/logger";
import {
  Notification,
  INotification,
} from "@/models/core/notifications.model";
import { User } from "@/models/core/users.model";
import {
  NotificationCategory,
  NotificationType,
} from "@/models/enums";
import { pushProviderManager, DeviceTokenInfo } from "./pushProviders/PushProviderManager";
import { DevicePlatform, PushProvider } from "./pushProviders/IPushProvider";

/**
 * Notification Payload Interface
 */
export interface NotificationPayload {
  userId: string | mongoose.Types.ObjectId;
  category: NotificationCategory;
  type?: NotificationType; // Legacy: NORMAL/REDIRECTION
  title: string;
  message: string;
  data?: Record<string, any>;
  redirectUrl?: string; // For web redirects
  // Mobile app navigation
  appRoute?: string; // Mobile app route (e.g., "/dashboard", "/orderDetail")
  query?: Record<string, string>; // Query parameters for mobile app (e.g., { orderId: "123" })
  createdBy?: string | mongoose.Types.ObjectId;
}

/**
 * Push Notification Options
 */
interface PushNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  clickAction?: string; // For web notifications
  priority?: "normal" | "high"; // For Android
  ttl?: number; // Time to live in seconds
}

/**
 * Central Notification Service
 * 
 * This service is the single source of truth for all notifications across the platform.
 * It handles:
 * - Validating notification payloads
 * - Storing notifications in DB
 * - Triggering push notifications via multiple providers (OneSignal for mobile, Firebase for web)
 * - Ensuring DB save happens even if push delivery fails
 * 
 * Current Scope: OneSignal for mobile app
 * Future Scope: Firebase for web push notifications
 */
class NotificationService {
  constructor() {
    logger.info("Notification Service initialized with push provider manager");
  }

  /**
   * Validate notification payload
   */
  private validatePayload(payload: NotificationPayload): void {
    if (!payload.userId) {
      throw new AppError("User ID is required", 400);
    }

    if (!payload.category) {
      throw new AppError("Notification category is required", 400);
    }

    if (!Object.values(NotificationCategory).includes(payload.category)) {
      throw new AppError("Invalid notification category", 400);
    }

    if (!payload.title || payload.title.trim().length === 0) {
      throw new AppError("Notification title is required", 400);
    }

    if (payload.title.length > 200) {
      throw new AppError("Notification title cannot exceed 200 characters", 400);
    }

    if (!payload.message || payload.message.trim().length === 0) {
      throw new AppError("Notification message is required", 400);
    }

    if (payload.message.length > 1000) {
      throw new AppError(
        "Notification message cannot exceed 1000 characters",
        400
      );
    }

    // Validate redirectUrl for REDIRECTION type
    if (payload.type === NotificationType.REDIRECTION) {
      if (!payload.redirectUrl || payload.redirectUrl.trim().length === 0) {
        throw new AppError(
          "Redirect URL is required for redirection type notifications",
          400
        );
      }

      // Basic URL validation
      try {
        new URL(payload.redirectUrl);
      } catch {
        throw new AppError("Invalid redirect URL format", 400);
      }
    }
  }

  /**
   * Get user device tokens with metadata for push notifications
   * Supports both new metadata format and backward compatibility with old format
   */
  private async getUserDeviceTokens(
    userId: string | mongoose.Types.ObjectId
  ): Promise<DeviceTokenInfo[]> {
    try {
      const user = await User.findById(userId)
        .select("deviceTokens deviceTokenMetadata")
        .lean();

      if (!user) {
        logger.warn(`User not found: ${userId}`);
        return [];
      }

      const deviceTokenInfos: DeviceTokenInfo[] = [];

      // Use new metadata format if available
      if ((user as any).deviceTokenMetadata && Array.isArray((user as any).deviceTokenMetadata)) {
        for (const tokenMeta of (user as any).deviceTokenMetadata) {
          if (tokenMeta.token && tokenMeta.platform && tokenMeta.provider) {
            deviceTokenInfos.push({
              token: tokenMeta.token,
              platform: tokenMeta.platform as DevicePlatform,
              provider: tokenMeta.provider as PushProvider,
            });
          }
        }
      }

      // Backward compatibility: If no metadata but old deviceTokens exist, assume mobile/OneSignal
      if (deviceTokenInfos.length === 0 && (user as any).deviceTokens) {
        const oldTokens = (user as any).deviceTokens || [];
        for (const token of oldTokens) {
          if (token && typeof token === "string") {
            // Default to mobile/OneSignal for backward compatibility
            deviceTokenInfos.push({
              token: token,
              platform: DevicePlatform.MOBILE,
              provider: PushProvider.ONESIGNAL,
            });
          }
        }
      }

      return deviceTokenInfos;
    } catch (error: any) {
      logger.error(`Error fetching user device tokens: ${error.message}`);
      return [];
    }
  }

  /**
   * Send push notification via appropriate provider
   * Routes to OneSignal for mobile, Firebase for web
   * 
   * @param deviceTokens - Array of device tokens with metadata
   * @param options - Push notification options
   * @returns Result with success status and error information
   */
  private async sendPushNotification(
    deviceTokens: DeviceTokenInfo[],
    options: PushNotificationOptions
  ): Promise<{ success: boolean; error?: string; invalidTokens?: string[] }> {
    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: false,
        error: "No device tokens available",
      };
    }

    // Build push notification payload
    const pushPayload = {
          title: options.title,
          body: options.body,
      data: options.data || {},
          imageUrl: options.imageUrl,
      sound: options.sound,
              badge: options.badge,
            clickAction: options.clickAction,
      priority: options.priority || "high",
      ttl: options.ttl,
      };

    // Send via push provider manager
    const result = await pushProviderManager.sendPushNotification(
      deviceTokens,
      pushPayload
    );

        return {
      success: result.success,
      error: result.error,
      invalidTokens: result.invalidTokens,
      };
  }

  /**
   * Remove invalid device tokens from user
   * Called automatically when invalid tokens are detected
   * Supports both new metadata format and old format
   */
  private async removeInvalidDeviceTokens(
    userId: string | mongoose.Types.ObjectId,
    invalidTokens: string[]
  ): Promise<void> {
    if (!invalidTokens || invalidTokens.length === 0) {
      return;
    }

    try {
      const user = await User.findById(userId);
      if (!user) {
        return;
      }

      // Remove from new metadata format
      if (user.deviceTokenMetadata && Array.isArray(user.deviceTokenMetadata)) {
        const originalLength = user.deviceTokenMetadata.length;
        user.deviceTokenMetadata = user.deviceTokenMetadata.filter(
          (tokenMeta: any) => !invalidTokens.includes(tokenMeta.token)
        );
        
        if (user.deviceTokenMetadata.length !== originalLength) {
          await user.save();
          logger.info(
            `Removed ${originalLength - user.deviceTokenMetadata.length} invalid device token(s) from metadata for user: ${userId}`
          );
        }
      }

      // Also remove from old format for backward compatibility
      const currentTokens = (user.deviceTokens || []) as string[];
      const validTokens = currentTokens.filter(
        (token) => !invalidTokens.includes(token)
      );

      if (validTokens.length !== currentTokens.length) {
        user.deviceTokens = validTokens;
        await user.save();
        logger.info(
          `Removed ${invalidTokens.length} invalid device token(s) for user: ${userId}`
        );
      }
    } catch (error: any) {
      logger.error(
        `Error removing invalid device tokens: ${error.message}`,
        error
      );
      // Don't throw - this is a cleanup operation
    }
  }

  /**
   * Create and send notification
   * 
   * This is the main method that:
   * 1. Validates the payload
   * 2. Saves notification to DB (always, even if push fails)
   * 3. Sends push notification via FCM
   * 4. Updates notification with push status
   * 
   * @param payload - Notification payload
   * @returns Created notification document
   */
  async createNotification(
    payload: NotificationPayload
  ): Promise<INotification> {
    // Step 1: Validate payload
    this.validatePayload(payload);

    // Step 2: Verify user exists
    const user = await User.findById(payload.userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    // Step 3: Create notification document (save to DB first)
    const notificationData: Partial<INotification> = {
      userId: new mongoose.Types.ObjectId(payload.userId),
      category: payload.category,
      type: payload.type || NotificationType.NORMAL,
      title: payload.title.trim(),
      message: payload.message.trim(),
      data: payload.data || {},
      redirectUrl: payload.redirectUrl,
      // Mobile app navigation fields
      appRoute: payload.appRoute,
      query: payload.query || {},
      pushSent: false,
      isRead: false,
      isDeleted: false,
    };

    if (payload.createdBy) {
      notificationData.createdBy = new mongoose.Types.ObjectId(
        payload.createdBy
      );
    }

    // Save to DB - this always happens, even if push fails
    let notification: INotification;
    try {
      notification = await Notification.create(notificationData);
      logger.info(
        `Notification created in DB: ${notification._id} for user: ${payload.userId}`
      );
    } catch (error: any) {
      logger.error(`Error creating notification in DB: ${error.message}`, error);
      throw new AppError("Failed to create notification", 500);
    }

    // Step 4: Send push notification (non-blocking)
    // We don't throw errors here - notification is already saved
    try {
      const deviceTokens = await this.getUserDeviceTokens(payload.userId);

      if (deviceTokens.length > 0) {
        // Build push notification payload that matches stored notification data exactly
        const pushOptions: PushNotificationOptions = {
          title: payload.title,
          body: payload.message,
          data: {
            // Core notification data - must match stored notification
            notificationId: String(notification._id),
            category: payload.category,
            type: payload.type || NotificationType.NORMAL,
            title: payload.title,
            message: payload.message,
            // Mobile app navigation (appRoute and query)
            ...(payload.appRoute && { appRoute: payload.appRoute }),
            ...(payload.query && { query: JSON.stringify(payload.query) }),
            // Include all additional data from payload (matches notification.data)
            ...(payload.data || {}),
            // Include redirect URL if available (for web - matches notification.redirectUrl)
            ...(payload.redirectUrl && { redirectUrl: payload.redirectUrl }),
            // Timestamp for tracking
            timestamp: new Date().toISOString(),
          },
          clickAction: payload.redirectUrl,
          priority: "high", // High priority for important notifications
          sound: "default",
        };

        const pushResult = await this.sendPushNotification(
          deviceTokens,
          pushOptions
        );

        // Remove invalid tokens if any were detected
        if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
          await this.removeInvalidDeviceTokens(
            payload.userId,
            pushResult.invalidTokens
          );
        }

        // Update notification with push status
        notification.pushSent = pushResult.success;
        notification.pushSentAt = new Date();
        if (!pushResult.success && pushResult.error) {
          notification.pushError = pushResult.error;
        } else {
          // Clear error if push succeeded
          notification.pushError = undefined;
        }

        await notification.save();

        if (pushResult.success) {
          logger.info(
            `Push notification sent successfully for notification: ${notification._id}`
          );
        } else {
          logger.warn(
            `Push notification failed for notification: ${notification._id}, error: ${pushResult.error}`
          );
        }
      } else {
        logger.info(
          `No device tokens found for user: ${payload.userId}, skipping push notification`
        );
        // Update notification to indicate no tokens available
        notification.pushSent = false;
        notification.pushError = "No device tokens available";
        await notification.save();
      }
    } catch (error: any) {
      // Log error but don't throw - notification is already saved
      logger.error(
        `Error sending push notification for notification: ${notification._id}`,
        error
      );

      // Update notification with error
      notification.pushSent = false;
      notification.pushError = error.message || "Unknown error";
      await notification.save();
    }

    return notification;
  }

  /**
   * Create multiple notifications (batch)
   */
  async createNotifications(
    payloads: NotificationPayload[]
  ): Promise<INotification[]> {
    const results: INotification[] = [];

    for (const payload of payloads) {
      try {
        const notification = await this.createNotification(payload);
        results.push(notification);
      } catch (error: any) {
        logger.error(
          `Error creating notification for user ${payload.userId}: ${error.message}`
        );
        // Continue with other notifications even if one fails
      }
    }

    return results;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string | mongoose.Types.ObjectId
  ): Promise<INotification | null> {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(
    userId: string | mongoose.Types.ObjectId
  ): Promise<{ count: number }> {
    const result = await Notification.updateMany(
      {
        userId: new mongoose.Types.ObjectId(userId),
        isRead: false,
        isDeleted: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    return { count: result.modifiedCount };
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string | mongoose.Types.ObjectId,
    options?: {
      limit?: number;
      skip?: number;
      category?: NotificationCategory;
      isRead?: boolean;
    }
  ): Promise<{ notifications: INotification[]; total: number }> {
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };

    if (options?.category) {
      query.category = options.category;
    }

    if (options?.isRead !== undefined) {
      query.isRead = options.isRead;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(options?.limit || 50)
        .skip(options?.skip || 0)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return {
      notifications: notifications as INotification[],
      total,
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    return Notification.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      isRead: false,
      isDeleted: false,
    });
  }

  /**
   * Delete notification (soft delete)
   */
  async deleteNotification(
    notificationId: string,
    userId: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    });

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    notification.isDeleted = true;
    notification.deletedAt = new Date();
    await notification.save();
  }

  /**
   * Retry failed push notifications
   * Useful for retrying notifications that failed to send
   */
  async retryFailedPushNotifications(
    notificationId: string
  ): Promise<INotification | null> {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.pushSent) {
      logger.info(
        `Notification ${notificationId} already has push sent, skipping retry`
      );
      return notification;
    }

    // Get user device tokens
    const deviceTokens = await this.getUserDeviceTokens(notification.userId);

    if (deviceTokens.length === 0) {
      notification.pushError = "No device tokens available";
      await notification.save();
      return notification;
    }

    // Send push notification with payload matching stored notification data
    const pushOptions: PushNotificationOptions = {
      title: notification.title,
      body: notification.message,
      data: {
        // Core notification data - matches stored notification
        notificationId: String(notification._id),
        category: notification.category,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        // Mobile app navigation (appRoute and query)
        ...(notification.appRoute && { appRoute: notification.appRoute }),
        ...(notification.query && { query: JSON.stringify(notification.query) }),
        // Include all stored notification data
        ...(notification.data || {}),
        // Include redirect URL if available (for web)
        ...(notification.redirectUrl && {
          redirectUrl: notification.redirectUrl,
        }),
        // Timestamp for tracking
        timestamp: new Date().toISOString(),
      },
      clickAction: notification.redirectUrl,
      priority: "high",
      sound: "default",
    };

    const pushResult = await this.sendPushNotification(deviceTokens, pushOptions);

    // Remove invalid tokens if any were detected
    if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
      await this.removeInvalidDeviceTokens(
        notification.userId,
        pushResult.invalidTokens
      );
    }

    // Update notification with push status
    notification.pushSent = pushResult.success;
    notification.pushSentAt = new Date();
    if (!pushResult.success && pushResult.error) {
      notification.pushError = pushResult.error;
    } else {
      notification.pushError = undefined;
    }

    await notification.save();

    return notification;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

