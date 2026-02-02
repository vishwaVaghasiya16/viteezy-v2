/**
 * OneSignal Push Notification Provider
 * 
 * Handles push notifications for mobile app (iOS & Android) using OneSignal
 * Current Scope: Mobile app push notifications
 */

import { logger } from "@/utils/logger";
import {
  IPushProvider,
  DevicePlatform,
  PushProvider,
  PushNotificationResult,
  PushNotificationPayload,
} from "./IPushProvider";

interface OneSignalNotification {
  headings: { en: string };
  contents: { en: string };
  include_player_ids?: string[];
  data?: Record<string, any>;
  ios_badgeType?: string;
  ios_badgeCount?: number;
  android_sound?: string;
  ios_sound?: string;
  priority?: number;
  small_icon?: string;
  large_icon?: string;
  big_picture?: string;
  buttons?: Array<{
    id: string;
    text: string;
    url?: string;
  }>;
}

interface OneSignalResponse {
  id: string;
  recipients: number;
  errors?: {
    invalid_player_ids?: string[];
  };
}

/**
 * OneSignal Provider for Mobile App Push Notifications
 */
export class OneSignalProvider implements IPushProvider {
  private appId: string;
  private apiKey: string;
  private baseUrl: string = "https://onesignal.com/api/v1";
  private initialized: boolean = false;

  constructor() {
    this.appId = process.env.ONESIGNAL_APP_ID || "";
    this.apiKey = process.env.ONESIGNAL_REST_API_KEY || "";
    this.initialize();
  }

  /**
   * Initialize OneSignal provider
   */
  private initialize(): void {
    if (!this.appId || !this.apiKey) {
      logger.warn(
        "OneSignal credentials not found. Mobile push notifications will not work. " +
        "Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY in environment variables."
      );
      this.initialized = false;
      return;
    }

    this.initialized = true;
    logger.info("OneSignal provider initialized successfully for mobile app");
  }

  /**
   * Get provider name
   */
  getName(): PushProvider {
    return PushProvider.ONESIGNAL;
  }

  /**
   * Get supported platform
   */
  getSupportedPlatform(): DevicePlatform {
    return DevicePlatform.MOBILE;
  }

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Send push notification via OneSignal
   * @param deviceTokens - Array of OneSignal player IDs
   * @param payload - Notification payload
   * @returns Result with success status and error information
   */
  async sendPushNotification(
    deviceTokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult> {
    if (!this.initialized) {
      return {
        success: false,
        error: "OneSignal provider not initialized",
      };
    }

    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: false,
        error: "No device tokens available",
      };
    }

    try {
      // Build OneSignal notification payload
      const notification: OneSignalNotification = {
        headings: { en: payload.title },
        contents: { en: payload.body },
        include_player_ids: deviceTokens,
        data: payload.data || {},
        priority: payload.priority === "high" ? 10 : 5,
      };

      // Add iOS badge
      if (payload.badge !== undefined) {
        notification.ios_badgeType = "Increase";
        notification.ios_badgeCount = payload.badge;
      }

      // Add sound
      if (payload.sound) {
        notification.android_sound = payload.sound;
        notification.ios_sound = payload.sound;
      }

      // Add images
      if (payload.imageUrl) {
        notification.big_picture = payload.imageUrl;
        notification.large_icon = payload.imageUrl;
      }

      // Add action button if clickAction is provided
      if (payload.clickAction) {
        notification.buttons = [
          {
            id: "action",
            text: "View",
            url: payload.clickAction,
          },
        ];
      }

      // Send notification via OneSignal REST API
      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${this.apiKey}`,
        },
        body: JSON.stringify({
          app_id: this.appId,
          ...notification,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OneSignal API error: ${response.status} - ${errorText}`);
        return {
          success: false,
          error: `OneSignal API error: ${response.status} - ${errorText}`,
        };
      }

      const result = (await response.json()) as OneSignalResponse;

      // Track invalid tokens
      const invalidTokens: string[] = [];
      if (result.errors?.invalid_player_ids) {
        invalidTokens.push(...result.errors.invalid_player_ids);
        logger.warn(
          `OneSignal: ${invalidTokens.length} invalid player IDs detected`
        );
      }

      const successCount = result.recipients || 0;
      const failureCount = deviceTokens.length - successCount;

      // Log results
      if (failureCount > 0) {
        logger.warn(
          `OneSignal push notification partially failed: ${failureCount}/${deviceTokens.length} failures, ${successCount} successes`
        );
      }

      if (successCount > 0) {
        logger.info(
          `OneSignal push notification sent successfully: ${successCount}/${deviceTokens.length} devices`
        );
      }

      // If all failed, return error
      if (successCount === 0) {
        return {
          success: false,
          error: "All notifications failed to send",
          invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
          successCount: 0,
          failureCount,
        };
      }

      // Return success with invalid tokens for cleanup
      return {
        success: true,
        invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
        successCount,
        failureCount,
      };
    } catch (error: any) {
      logger.error(`Error sending OneSignal push notification: ${error.message}`, error);
      return {
        success: false,
        error: error.message || "Failed to send push notification via OneSignal",
      };
    }
  }
}

