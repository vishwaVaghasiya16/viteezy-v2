import admin from "firebase-admin";
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
 * - Triggering push notifications (FCM/APNs)
 * - Ensuring DB save happens even if push delivery fails
 */
class NotificationService {
  private firebaseApp: admin.app.App | null = null;

  constructor() {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK for FCM
   */
  private initializeFirebase(): void {
    try {
      // Check if Firebase is already initialized (by firebaseService or elsewhere)
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.app();
        logger.info("Firebase Admin SDK already initialized for notifications");
        return;
      }

      // Firebase should be initialized by firebaseService
      // If not, we'll log a warning but allow the service to work
      logger.warn(
        "Firebase Admin SDK not initialized. Push notifications will not work. " +
        "Ensure firebaseService is initialized before using notificationService."
      );
    } catch (error: any) {
      logger.warn(
        "Firebase Admin SDK not initialized. Push notifications will not work.",
        error
      );
      // Don't throw error - allow service to work without push notifications
    }
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
   * Get user device tokens for push notifications
   */
  private async getUserDeviceTokens(
    userId: string | mongoose.Types.ObjectId
  ): Promise<string[]> {
    try {
      const user = await User.findById(userId).select("deviceTokens").lean();

      if (!user) {
        logger.warn(`User not found: ${userId}`);
        return [];
      }

      // Check if user has deviceTokens field
      // If not, we'll add it to the user model
      const deviceTokens = (user as any).deviceTokens || [];
      return Array.isArray(deviceTokens) ? deviceTokens : [];
    } catch (error: any) {
      logger.error(`Error fetching user device tokens: ${error.message}`);
      return [];
    }
  }

  /**
   * Send push notification via FCM
   * Supports both Android (FCM) and iOS (APNs) through Firebase Cloud Messaging
   * 
   * @param deviceTokens - Array of FCM device tokens
   * @param options - Push notification options
   * @returns Result with success status and error information
   */
  private async sendPushNotification(
    deviceTokens: string[],
    options: PushNotificationOptions
  ): Promise<{ success: boolean; error?: string; invalidTokens?: string[] }> {
    if (!this.firebaseApp) {
      return {
        success: false,
        error: "Firebase Admin SDK not initialized",
      };
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: false,
        error: "No device tokens available",
      };
    }

    try {
      // Build data payload - ensure all values are strings (FCM requirement)
      const dataPayload: Record<string, string> = {};
      if (options.data) {
        for (const [key, value] of Object.entries(options.data)) {
          // Convert all values to strings for FCM
          dataPayload[key] = String(value !== null && value !== undefined ? value : "");
        }
      }

      // Build FCM message with platform-specific configurations
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: options.title,
          body: options.body,
          imageUrl: options.imageUrl,
        },
        data: dataPayload,
        // iOS (APNs) specific configuration
        apns: {
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              sound: options.sound || "default",
              badge: options.badge,
              // Enable content-available for background notifications
              "content-available": 1,
            },
          },
          headers: {
            "apns-priority": "10", // High priority for immediate delivery
          },
        },
        // Android (FCM) specific configuration
        android: {
          priority: (options.priority || "high") as "normal" | "high",
          notification: {
            title: options.title,
            body: options.body,
            sound: options.sound || "default",
            channelId: "default", // Android notification channel
            imageUrl: options.imageUrl,
            clickAction: options.clickAction,
            // Enable notification priority for Android
            priority: "high" as const,
          },
          ttl: options.ttl ? options.ttl * 1000 : 86400000, // Default 24 hours in milliseconds
        },
        // Web push configuration
        webpush: {
          notification: {
            title: options.title,
            body: options.body,
            icon: options.imageUrl || "/icon-192x192.png",
            badge: "/badge-72x72.png",
            clickAction: options.clickAction,
            requireInteraction: false,
          },
          fcmOptions: {
            link: options.clickAction,
          },
        },
        tokens: deviceTokens,
      };

      // Send multicast message to all device tokens
      const response = await admin.messaging().sendEachForMulticast(message);

      // Track invalid tokens to remove them
      const invalidTokens: string[] = [];
      const errors: string[] = [];

      // Process responses and identify invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const token = deviceTokens[idx];
          const errorCode = resp.error?.code;

          // Check for invalid token errors that should be removed
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument"
          ) {
            invalidTokens.push(token);
            logger.warn(`Invalid device token detected: ${token.substring(0, 20)}...`);
          }

          errors.push(`Token ${token.substring(0, 20)}...: ${resp.error?.message || "Unknown error"}`);
        }
      });

      // Log results
      if (response.failureCount > 0) {
        logger.warn(
          `Push notification partially failed: ${response.failureCount}/${response.responses.length} failures, ${response.successCount} successes`,
          { errors, invalidTokensCount: invalidTokens.length }
        );
      }

      if (response.successCount > 0) {
        logger.info(
          `Push notification sent successfully: ${response.successCount}/${response.responses.length} devices`
        );
      }

      // If all failed, return error
      if (response.successCount === 0) {
        return {
          success: false,
          error: errors.join("; "),
          invalidTokens,
        };
      }

      // Return success with invalid tokens for cleanup
      return {
        success: true,
        invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
      };
    } catch (error: any) {
      logger.error(`Error sending push notification: ${error.message}`, error);
      return {
        success: false,
        error: error.message || "Failed to send push notification",
      };
    }
  }

  /**
   * Remove invalid device tokens from user
   * Called automatically when invalid tokens are detected
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
            ...(payload.appRoute && { type: payload.appRoute }), // Override type with appRoute for mobile
            ...(payload.query && { query: JSON.stringify(payload.query) }), // Stringify query for FCM
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
        ...(notification.appRoute && { type: notification.appRoute }), // Override type with appRoute for mobile
        ...(notification.query && { query: JSON.stringify(notification.query) }), // Stringify query for FCM
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

