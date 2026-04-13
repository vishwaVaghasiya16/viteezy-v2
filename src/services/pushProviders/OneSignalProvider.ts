/**
 * OneSignal Push Notification Provider
 * 
 * Handles push notifications for mobile app (iOS & Android) using OneSignal
 * Current Scope: Mobile app push notifications
 */

import { logger } from "@/utils/logger";
import { config } from "@/config";
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
    [key: string]: any; // Allow other error types
  };
  // Additional fields that OneSignal may return
  external_id?: string;
  warnings?: any;
}

interface OneSignalPlayer {
  id: string;
  app_id: string;
  device_type: number;
  subscribed: boolean;
  invalid_identifier?: boolean;
  last_active?: string;
  [key: string]: any;
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
    this.appId = config.push.oneSignalAppId;
    this.apiKey = config.push.oneSignalRestApiKey;
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
    logger.info("OneSignal provider initialized successfully for mobile app", {
      appIdConfigured: !!this.appId,
      apiKeyConfigured: !!this.apiKey,
    });
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
   * Validate if a token is a valid OneSignal player ID (UUID format)
   * OneSignal player IDs are UUIDs: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   */
  private isValidOneSignalPlayerId(token: string): boolean {
    // UUID v4 format: 8-4-4-4-12 hexadecimal characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(token);
  }

  /**
   * Check player subscription status via OneSignal API
   * This helps diagnose why a player might not receive notifications
   */
  async checkPlayerStatus(playerId: string): Promise<OneSignalPlayer | null> {
    if (!this.initialized) {
      logger.warn("OneSignal provider not initialized, cannot check player status");
      return null;
    }

    try {
      // OneSignal REST API requires Basic auth with base64 encoded API key
      const encodedApiKey = this.apiKey
      
      const response = await fetch(`${this.baseUrl}/players/${playerId}?app_id=${this.appId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedApiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Failed to check player status for ${playerId}: ${response.status} - ${errorText}`, {
          playerId,
          appId: this.appId,
          error: errorText,
          hint: response.status === 400 && errorText.includes("No player with this id found") 
            ? "⚠️ CRITICAL: Player ID exists but NOT in this app! Check if App ID matches the dashboard."
            : undefined,
        });
        return null;
      }

      const playerData = (await response.json()) as OneSignalPlayer;
      logger.debug(`Player status for ${playerId}:`, {
        playerId,
        subscribed: playerData.subscribed,
        invalid_identifier: playerData.invalid_identifier,
        app_id: playerData.app_id,
        device_type: playerData.device_type,
        last_active: playerData.last_active,
      });
      return playerData;
    } catch (error: any) {
      logger.error(`Error checking player status for ${playerId}: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Send push notification via OneSignal
   * @param deviceTokens - Array of OneSignal player IDs (must be UUIDs)
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

    // Filter and validate tokens - OneSignal only accepts UUID format player IDs
    const validTokens: string[] = [];
    const invalidTokens: string[] = [];

    for (const token of deviceTokens) {
      if (this.isValidOneSignalPlayerId(token)) {
        validTokens.push(token);
      } else {
        invalidTokens.push(token);
        logger.warn(
          `Invalid OneSignal player ID format (expected UUID, got FCM token or other format): ${token.substring(0, 50)}...`
        );
      }
    }

    // If all tokens are invalid, return error immediately
    if (validTokens.length === 0) {
      logger.error(
        `All ${deviceTokens.length} device tokens are invalid for OneSignal (not UUID format). ` +
        `This usually means FCM tokens were sent to OneSignal instead of OneSignal player IDs.`
      );
      return {
        success: false,
        error: `All device tokens are invalid. OneSignal requires UUID format player IDs, but received ${invalidTokens.length} invalid token(s).`,
        invalidTokens,
        successCount: 0,
        failureCount: deviceTokens.length,
      };
    }

    // Log warning if some tokens were filtered out
    if (invalidTokens.length > 0) {
      logger.warn(
        `Filtered out ${invalidTokens.length} invalid token(s) for OneSignal. ` +
        `Sending to ${validTokens.length} valid OneSignal player ID(s).`
      );
    }

    try {
      // Build OneSignal notification payload with only valid tokens
      const notification: OneSignalNotification = {
        headings: { en: payload.title },
        contents: { en: payload.body },
        include_player_ids: validTokens,
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
      // OneSignal REST API requires Basic auth with base64 encoded API key
      // Format: Basic base64(apiKey:) - API key is used as password, empty username
      const requestBody = {
        app_id: this.appId,
        ...notification,
      };

      // OneSignal REST API requires Basic auth with base64 encoded API key
      const encodedApiKey = this.apiKey

      logger.debug("Sending OneSignal notification", {
        appId: this.appId,
        validTokensCount: validTokens.length,
        notificationId: notification.include_player_ids?.length || 0,
        hasTitle: !!payload.title,
        hasBody: !!payload.body,
        playerIds: validTokens,
        requestBodyPreview: JSON.stringify(requestBody).substring(0, 200),
      });

      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${encodedApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`OneSignal API error: ${response.status} - ${errorText}`, {
          status: response.status,
          statusText: response.statusText,
          appId: this.appId,
          validTokensCount: validTokens.length,
          requestBody: JSON.stringify(requestBody).substring(0, 500), // Log first 500 chars
        });
        return {
          success: false,
          error: `OneSignal API error: ${response.status} - ${errorText}`,
          invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
          successCount: 0,
          failureCount: deviceTokens.length,
        };
      }

      const result = (await response.json()) as OneSignalResponse;

      // Log the full OneSignal response for debugging
      logger.info("OneSignal API Full Response:", {
        fullResponse: JSON.stringify(result),
        notificationId: result.id,
        recipients: result.recipients,
        errors: result.errors,
        warnings: result.warnings,
        appId: this.appId,
        playerIdsSent: validTokens,
      });

      // Track invalid tokens (combine pre-filtered invalid tokens with API-reported invalid tokens)
      const allInvalidTokens: string[] = [...invalidTokens];
      if (result.errors?.invalid_player_ids) {
        allInvalidTokens.push(...result.errors.invalid_player_ids);
        logger.warn(
          `OneSignal API reported ${result.errors.invalid_player_ids.length} additional invalid player IDs: ${result.errors.invalid_player_ids.join(", ")}`
        );
      }

      const successCount = result.recipients || 0;
      // Calculate failure count based on valid tokens sent, plus pre-filtered invalid tokens
      const failureCount = (validTokens.length - successCount) + invalidTokens.length;

      // Log detailed results
      logger.info(`OneSignal API Response:`, {
        notificationId: result.id,
        recipients: successCount,
        validTokensSent: validTokens.length,
        invalidTokensFiltered: invalidTokens.length,
        apiReportedInvalid: result.errors?.invalid_player_ids?.length || 0,
        totalTokensReceived: deviceTokens.length,
        playerIdsSent: validTokens,
        appId: this.appId,
        hasErrors: !!result.errors,
        hasWarnings: !!result.warnings,
      });

      // IMPORTANT: If API call was successful (200 OK), consider it a success even if recipients is 0
      // because the notification was successfully sent to OneSignal. The 0 recipients might be due to:
      // - Player not subscribed (user preference)
      // - Player disabled notifications
      // - But the notification WAS sent to OneSignal successfully
      // If response.ok is true (200-299 status), the API call was successful
      // result.id may or may not be present, but if response is OK, the notification was sent
      const apiCallSuccessful = response.ok;

      if (apiCallSuccessful) {
        if (successCount > 0) {
          logger.info(
            `OneSignal push notification sent successfully: ${successCount}/${validTokens.length} valid devices (${invalidTokens.length} invalid tokens filtered out)`
          );
        } else {
          // API call succeeded but 0 recipients - notification was sent to OneSignal
          // but player may not be subscribed or has disabled notifications
          logger.info(
            `OneSignal notification sent to API successfully (notification ID: ${result.id || 'N/A'}), but 0 recipients. ` +
            `This may indicate player is not subscribed or has disabled notifications. ` +
            `Player IDs: ${validTokens.join(", ")}. ` +
            `Note: This is still considered a successful API call - notification was sent to OneSignal.`
          );
        }
      }

      if (failureCount > 0 && successCount > 0) {
        logger.warn(
          `OneSignal push notification partially failed: ${failureCount}/${deviceTokens.length} failures, ${successCount} successes`
        );
      }

      // If API call was successful (200 OK with notification ID), return success
      // This means the notification was successfully sent to OneSignal
      // Even if recipients is 0, it's still a successful API call
      // Only return failure if there's an actual API error (non-200 response)
      if (apiCallSuccessful) {
        // API call successful - notification was sent to OneSignal
        // Return success even if recipients is 0 (player preference issue, not API failure)
        // The notification was successfully sent to OneSignal, even if player didn't receive it
        logger.info(
          `OneSignal API call successful. Notification ID: ${result.id}, Recipients: ${successCount}/${validTokens.length}`
        );
        return {
          success: true,
          invalidTokens: allInvalidTokens.length > 0 ? allInvalidTokens : undefined,
          successCount: successCount,
          failureCount: failureCount,
        };
      }

      // This code should never be reached if apiCallSuccessful is true
      // But if we reach here, it means apiCallSuccessful was false
      // This should not happen if notifications are being sent, but handle edge cases

      // If all failed due to invalid tokens (no valid tokens to send), return detailed error
      if (validTokens.length === 0) {
        let errorMessage = "All notifications failed to send";
        let shouldMarkAsInvalid = false;
        
        if (invalidTokens.length > 0 && validTokens.length === 0) {
          errorMessage = `All ${deviceTokens.length} device token(s) are invalid (not UUID format). OneSignal requires UUID format player IDs. Received invalid tokens (likely FCM tokens). Please ensure mobile app is sending OneSignal player IDs, not FCM tokens.`;
          shouldMarkAsInvalid = true;
        } else if (validTokens.length > 0 && successCount === 0) {
          // Valid player IDs but 0 recipients - player not subscribed or inactive
          // Check player status for the first player ID to get diagnostic info
          const firstPlayerId = validTokens[0];
          const playerStatus = await this.checkPlayerStatus(firstPlayerId);
          
          let diagnosticInfo = "";
          if (playerStatus) {
            diagnosticInfo = `Player Status Check: subscribed=${playerStatus.subscribed}, ` +
              `invalid_identifier=${playerStatus.invalid_identifier}, ` +
              `app_id=${playerStatus.app_id}, ` +
              `device_type=${playerStatus.device_type}. ` +
              (playerStatus.app_id !== this.appId 
                ? `⚠️ CRITICAL: Player belongs to different app (${playerStatus.app_id} vs ${this.appId})! ` 
                : "") +
              (!playerStatus.subscribed 
                ? `⚠️ Player is NOT subscribed to push notifications! ` 
                : "");
          } else {
            // Player status check failed - most likely App ID mismatch
            diagnosticInfo = `⚠️ CRITICAL ISSUE: Could not retrieve player status - Player ID exists in OneSignal but NOT in app "${this.appId}". ` +
              `This means the player belongs to a DIFFERENT OneSignal app. ` +
              `SOLUTION: Check OneSignal Dashboard → Settings → Keys & IDs → App ID. ` +
              `Update your .env file: ONESIGNAL_APP_ID=<correct_app_id_from_dashboard>. ` +
              `Current configured App ID: ${this.appId}. `;
          }

          errorMessage = `OneSignal API returned 0 recipients for ${validTokens.length} valid player ID(s). ` +
            `${diagnosticInfo}` +
            `Possible reasons: 1) Player ID belongs to a different OneSignal app (verify App ID: ${this.appId}), ` +
            `2) Player has not subscribed to push notifications, 3) Player has disabled notifications, ` +
            `4) Player ID is inactive/expired, 5) OneSignal app configuration issue (check iOS/Android platform settings). ` +
            `ACTION REQUIRED: Check OneSignal dashboard → Audience → All Users → Search for player ID: ${firstPlayerId} ` +
            `to verify: a) Player exists in this app, b) Subscription status is "Subscribed", c) Platform is configured correctly.`;
          
          // Mark these tokens for potential cleanup if they consistently fail
          // But don't mark as invalid immediately - might be temporary (user disabled notifications)
          logger.warn(
            `Valid OneSignal player IDs returned 0 recipients. ` +
            `Player IDs: ${validTokens.join(", ")}. ` +
            `App ID: ${this.appId}. ` +
            `${diagnosticInfo}` +
            `Check OneSignal dashboard → Audience → All Users → Search for player ID to verify subscription status.`
          );
          shouldMarkAsInvalid = false; // Don't mark as invalid - might be user preference
        } else if (allInvalidTokens.length > 0) {
          errorMessage = `All notifications failed. ${allInvalidTokens.length} invalid token(s) detected. Invalid tokens: ${allInvalidTokens.slice(0, 5).join(", ")}${allInvalidTokens.length > 5 ? "..." : ""}`;
          shouldMarkAsInvalid = true;
        }

        logger.error(errorMessage, {
          validTokensCount: validTokens.length,
          invalidTokensCount: invalidTokens.length,
          apiReportedInvalid: result.errors?.invalid_player_ids?.length || 0,
          notificationId: result.id,
          playerIds: validTokens.length > 0 ? validTokens : undefined,
        });

        return {
          success: false,
          error: errorMessage,
          // Only mark as invalid if tokens are actually invalid (format issue)
          // Don't mark valid but unsubscribed players as invalid
          invalidTokens: shouldMarkAsInvalid && allInvalidTokens.length > 0 ? allInvalidTokens : undefined,
          successCount: 0,
          failureCount,
        };
      }

      // Return success with invalid tokens for cleanup
      return {
        success: true,
        invalidTokens: allInvalidTokens.length > 0 ? allInvalidTokens : undefined,
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

