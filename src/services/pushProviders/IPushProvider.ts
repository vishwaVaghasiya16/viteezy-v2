/**
 * Push Notification Provider Interface
 * 
 * Abstract interface for push notification providers
 * Supports multiple providers: OneSignal (mobile), Firebase (web)
 */

export enum DevicePlatform {
  MOBILE = "mobile",
  WEB = "web",
}

export enum PushProvider {
  ONESIGNAL = "onesignal",
  FIREBASE = "firebase",
}

export interface PushNotificationResult {
  success: boolean;
  error?: string;
  invalidTokens?: string[];
  successCount?: number;
  failureCount?: number;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  sound?: string;
  badge?: number;
  clickAction?: string;
  priority?: "normal" | "high";
  ttl?: number;
}

/**
 * Push Notification Provider Interface
 */
export interface IPushProvider {
  /**
   * Get provider name
   */
  getName(): PushProvider;

  /**
   * Get supported platform
   */
  getSupportedPlatform(): DevicePlatform;

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean;

  /**
   * Send push notification to multiple device tokens
   * @param deviceTokens - Array of device tokens
   * @param payload - Notification payload
   * @returns Result with success status and error information
   */
  sendPushNotification(
    deviceTokens: string[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult>;
}

