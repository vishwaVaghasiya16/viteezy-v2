/**
 * Push Provider Manager
 * 
 * Manages multiple push notification providers
 * Routes notifications to appropriate provider based on device platform
 */

import { logger } from "@/utils/logger";
import { OneSignalProvider } from "./OneSignalProvider";
import { FirebaseProvider } from "./FirebaseProvider";
import {
  IPushProvider,
  DevicePlatform,
  PushProvider,
  PushNotificationResult,
  PushNotificationPayload,
} from "./IPushProvider";

/**
 * Device Token with Metadata
 */
export interface DeviceTokenInfo {
  token: string;
  platform: DevicePlatform;
  provider: PushProvider;
}

/**
 * Push Provider Manager
 * Manages and routes push notifications to appropriate providers
 */
export class PushProviderManager {
  private providers: Map<PushProvider, IPushProvider>;
  private oneSignalProvider: OneSignalProvider;
  private firebaseProvider: FirebaseProvider;

  constructor() {
    // Initialize providers
    this.oneSignalProvider = new OneSignalProvider();
    this.firebaseProvider = new FirebaseProvider();

    // Register providers
    this.providers = new Map();
    this.providers.set(PushProvider.ONESIGNAL, this.oneSignalProvider);
    this.providers.set(PushProvider.FIREBASE, this.firebaseProvider);

    logger.info("Push Provider Manager initialized");
  }

  /**
   * Get provider by name
   */
  getProvider(provider: PushProvider): IPushProvider | null {
    return this.providers.get(provider) || null;
  }

  /**
   * Get provider for platform
   */
  getProviderForPlatform(platform: DevicePlatform): IPushProvider | null {
    switch (platform) {
      case DevicePlatform.MOBILE:
        return this.oneSignalProvider;
      case DevicePlatform.WEB:
        return this.firebaseProvider;
      default:
        return null;
    }
  }

  /**
   * Send push notification to device tokens grouped by provider
   * @param deviceTokens - Array of device tokens with metadata
   * @param payload - Notification payload
   * @returns Combined result from all providers
   */
  async sendPushNotification(
    deviceTokens: DeviceTokenInfo[],
    payload: PushNotificationPayload
  ): Promise<PushNotificationResult> {
    if (!deviceTokens || deviceTokens.length === 0) {
      return {
        success: false,
        error: "No device tokens available",
      };
    }

    // Group tokens by provider
    const tokensByProvider = new Map<PushProvider, string[]>();
    
    for (const tokenInfo of deviceTokens) {
      const provider = tokenInfo.provider;
      if (!tokensByProvider.has(provider)) {
        tokensByProvider.set(provider, []);
      }
      tokensByProvider.get(provider)!.push(tokenInfo.token);
    }

    // Send notifications via each provider
    const results: PushNotificationResult[] = [];
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    const allInvalidTokens: string[] = [];
    const errors: string[] = [];

    for (const [provider, tokens] of tokensByProvider.entries()) {
      const providerInstance = this.getProvider(provider);
      
      if (!providerInstance) {
        logger.warn(`Provider ${provider} not found`);
        errors.push(`Provider ${provider} not found`);
        totalFailureCount += tokens.length;
        continue;
      }

      if (!providerInstance.isInitialized()) {
        logger.warn(`Provider ${provider} not initialized`);
        errors.push(`Provider ${provider} not initialized`);
        totalFailureCount += tokens.length;
        continue;
      }

      try {
        const result = await providerInstance.sendPushNotification(tokens, payload);
        results.push(result);

        if (result.success) {
          totalSuccessCount += result.successCount || tokens.length;
          totalFailureCount += result.failureCount || 0;
        } else {
          totalFailureCount += tokens.length;
          if (result.error) {
            errors.push(`${provider}: ${result.error}`);
          }
        }

        if (result.invalidTokens) {
          allInvalidTokens.push(...result.invalidTokens);
        }
      } catch (error: any) {
        logger.error(`Error sending push via ${provider}: ${error.message}`, error);
        errors.push(`${provider}: ${error.message}`);
        totalFailureCount += tokens.length;
      }
    }

    // Determine overall success
    const overallSuccess = totalSuccessCount > 0;
    const errorMessage = errors.length > 0 ? errors.join("; ") : undefined;

    return {
      success: overallSuccess,
      error: errorMessage,
      invalidTokens: allInvalidTokens.length > 0 ? allInvalidTokens : undefined,
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
    };
  }

  /**
   * Check if provider is available for platform
   */
  isProviderAvailable(platform: DevicePlatform): boolean {
    const provider = this.getProviderForPlatform(platform);
    return provider !== null && provider.isInitialized();
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): PushProvider[] {
    const available: PushProvider[] = [];
    for (const [provider, instance] of this.providers.entries()) {
      if (instance.isInitialized()) {
        available.push(provider);
      }
    }
    return available;
  }
}

// Export singleton instance
export const pushProviderManager = new PushProviderManager();

