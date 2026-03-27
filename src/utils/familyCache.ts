/**
 * @fileoverview Family Cache Utility
 * @description Simple in-memory caching for family management operations
 * @module utils/familyCache
 */

import { logger } from "./logger";

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheConfig {
  defaultTTL: number; // Default time-to-live in milliseconds
  maxSize: number; // Maximum number of cache entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

const CACHE_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000, // Maximum 1000 entries
  cleanupInterval: 60 * 1000, // Cleanup every minute
};

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

class FamilyCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.clearTimer(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional custom TTL
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Remove existing timer if any
    this.clearTimer(key);

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl || CACHE_CONFIG.defaultTTL,
    };

    this.cache.set(key, entry);

    // Set expiration timer
    const expirationTime = entry.timestamp + entry.ttl;
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, expirationTime - Date.now());

    this.timers.set(key, timer);
  }

  /**
   * Delete value from cache
   * @param key - Cache key
   */
  delete(key: string): boolean {
    this.clearTimer(key);
    return this.cache.delete(key);
  }

  /**
   * Clear cache entry timer
   * @param key - Cache key
   */
  private clearTimer(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    
    // Clear all cache entries
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: CACHE_CONFIG.maxSize,
    };
  }

  /**
   * Invalidate cache entries by pattern
   * @param pattern - Pattern to match keys
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    
    for (const [key] of this.cache.entries()) {
      if (regex.test(key)) {
        this.delete(key);
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const familyCache = new FamilyCache();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Cache key generators
 */
export const FAMILY_CACHE_KEYS = {
  familyDetails: (userId: string) => `family:details:${userId}`,
  subMembers: (mainMemberId: string) => `family:submembers:${mainMemberId}`,
  userRole: (userId: string) => `family:role:${userId}`,
  userAddresses: (userId: string) => `family:addresses:${userId}`,
  defaultAddress: (userId: string) => `family:default_address:${userId}`,
  commerceContext: (userId: string) => `family:commerce_context:${userId}`,
  recommendations: (key: string) => `family:recommendations:${key}`,
} as const;

/**
 * Get family details from cache
 */
export const getCachedFamilyDetails = (userId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.familyDetails(userId));
};

/**
 * Set family details in cache
 */
export const setCachedFamilyDetails = (userId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.familyDetails(userId), data, ttl);
};

/**
 * Get sub-members from cache
 */
export const getCachedSubMembers = (mainMemberId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.subMembers(mainMemberId));
};

/**
 * Set sub-members in cache
 */
export const setCachedSubMembers = (mainMemberId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.subMembers(mainMemberId), data, ttl);
};

/**
 * Get user role from cache
 */
export const getCachedUserRole = (userId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.userRole(userId));
};

/**
 * Set user role in cache
 */
export const setCachedUserRole = (userId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.userRole(userId), data, ttl);
};

/**
 * Get user addresses from cache
 */
export const getCachedUserAddresses = (userId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.userAddresses(userId));
};

/**
 * Set user addresses in cache
 */
export const setCachedUserAddresses = (userId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.userAddresses(userId), data, ttl);
};

/**
 * Get default address from cache
 */
export const getCachedDefaultAddress = (userId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.defaultAddress(userId));
};

/**
 * Set default address in cache
 */
export const setCachedDefaultAddress = (userId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.defaultAddress(userId), data, ttl);
};

/**
 * Invalidate user-related cache entries
 */
export const invalidateUserCache = (userId: string): void => {
  familyCache.invalidatePattern(`family:.*:${userId}`);
};

/**
 * Invalidate user address cache entries
 */
export const invalidateUserAddressCache = (userId: string): void => {
  familyCache.invalidatePattern(`family:(addresses|default_address):${userId}`);
};

/**
 * Get commerce context from cache
 */
export const getCachedCommerceContext = (userId: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.commerceContext(userId));
};

/**
 * Set commerce context in cache
 */
export const setCachedCommerceContext = (userId: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.commerceContext(userId), data, ttl);
};

/**
 * Invalidate user commerce context cache entries
 */
export const invalidateUserCommerceContext = (userId: string): void => {
  familyCache.invalidatePattern(`family:commerce_context:${userId}`);
};

/**
 * Get recommendations from cache
 */
export const getCachedRecommendations = (key: string): any => {
  return familyCache.get(FAMILY_CACHE_KEYS.recommendations(key));
};

/**
 * Set recommendations in cache
 */
export const setCachedRecommendations = (key: string, data: any, ttl?: number): void => {
  familyCache.set(FAMILY_CACHE_KEYS.recommendations(key), data, ttl);
};

/**
 * Invalidate profile recommendations cache entries
 */
export const invalidateProfileRecommendations = (profileId: string): void => {
  familyCache.invalidatePattern(`family:recommendations:*${profileId}*`);
};

/**
 * Invalidate family-related cache entries
 */
export const invalidateFamilyCache = (): void => {
  familyCache.invalidatePattern('family:.*');
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  const stats = familyCache.getStats();
  
  logger.info("Family cache statistics", {
    ...stats,
    timestamp: new Date().toISOString(),
  });
  
  return stats;
};
