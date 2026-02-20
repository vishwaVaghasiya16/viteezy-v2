/**
 * Firebase Push Notification Provider
 * 
 * Handles push notifications for web using Firebase Cloud Messaging (FCM)
 * Future Scope: Web push notifications
 */

import admin from "firebase-admin";
import { logger } from "@/utils/logger";
import {
  IPushProvider,
  DevicePlatform,
  PushProvider,
  PushNotificationResult,
  PushNotificationPayload,
} from "./IPushProvider";

/**
 * Firebase Provider for Web Push Notifications
 * Future scope: Web push notifications via Firebase
 */
export class FirebaseProvider implements IPushProvider {
  private firebaseApp: admin.app.App | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Firebase Admin SDK for FCM
   */
  private initialize(): void {
    try {
      // Check if Firebase is already initialized (by firebaseService or elsewhere)
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.app();
        this.initialized = true;
        logger.info("Firebase Admin SDK initialized for web push notifications");
        return;
      }

      // Firebase should be initialized by firebaseService
      // If not, we'll log a warning but allow the service to work
      logger.warn(
        "Firebase Admin SDK not initialized. Web push notifications will not work. " +
        "Ensure firebaseService is initialized before using FirebaseProvider."
      );
      this.initialized = false;
    } catch (error: any) {
      logger.warn(
        "Firebase Admin SDK not initialized. Web push notifications will not work.",
        error
      );
      this.initialized = false;
    }
  }

  /**
   * Get provider name
   */
  getName(): PushProvider {
    return PushProvider.FIREBASE;
  }

  /**
   * Get supported platform
   */
  getSupportedPlatform(): DevicePlatform {
    return DevicePlatform.WEB;
  }

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.firebaseApp !== null;
  }

  /**
   * Send push notification via FCM
   * Supports web push notifications through Firebase Cloud Messaging
   * 
   * @param deviceTokens - Array of FCM device tokens (web push tokens)
   * @param payload - Notification payload
   * @returns Result with success status and error information
   */
  async sendPushNotification(
    deviceTokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult> {
    if (!this.firebaseApp || !this.initialized) {
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
      if (payload.data) {
        for (const [key, value] of Object.entries(payload.data)) {
          // Convert all values to strings for FCM
          dataPayload[key] = String(value !== null && value !== undefined ? value : "");
        }
      }

      // Build FCM message with web push configuration
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: dataPayload,
        // Web push configuration
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.imageUrl || "/icon-192x192.png",
            badge: "/badge-72x72.png",
            clickAction: payload.clickAction,
            requireInteraction: false,
          },
          fcmOptions: {
            link: payload.clickAction,
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
            logger.warn(`Invalid FCM device token detected: ${token.substring(0, 20)}...`);
          }

          errors.push(`Token ${token.substring(0, 20)}...: ${resp.error?.message || "Unknown error"}`);
        }
      });

      // Log results
      if (response.failureCount > 0) {
        logger.warn(
          `Firebase web push notification partially failed: ${response.failureCount}/${response.responses.length} failures, ${response.successCount} successes`,
          { errors, invalidTokensCount: invalidTokens.length }
        );
      }

      if (response.successCount > 0) {
        logger.info(
          `Firebase web push notification sent successfully: ${response.successCount}/${response.responses.length} devices`
        );
      }

      // If all failed, return error
      if (response.successCount === 0) {
        return {
          success: false,
          error: errors.join("; "),
          invalidTokens,
          successCount: 0,
          failureCount: response.failureCount,
        };
      }

      // Return success with invalid tokens for cleanup
      return {
        success: true,
        invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: any) {
      logger.error(`Error sending Firebase web push notification: ${error.message}`, error);
      return {
        success: false,
        error: error.message || "Failed to send push notification via Firebase",
      };
    }
  }
}

