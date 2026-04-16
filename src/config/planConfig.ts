/**
 * Plan Configuration
 * 
 * This file contains all plan-related constants that can be easily updated
 * without modifying code throughout the application.
 * 
 * To change plans:
 * 1. Update the values in this file
 * 2. All validation, services, and controllers will automatically use the new values
 */

/**
 * SACHETS Subscription Plan Configuration
 * These are the available subscription plan durations in days
 * Note: One-time plans are NOT supported for SACHETS (only subscription)
 */
export const SACHETS_SUBSCRIPTION_PLANS = [180, 90, 60, 30] as const;
export type SachetsSubscriptionPlanDays = typeof SACHETS_SUBSCRIPTION_PLANS[number];

/**
 * STAND_UP_POUCH Plan Configuration
 * These are the available capsule counts for one-time purchases
 * Note: STAND_UP_POUCH only supports one-time plans (no subscription)
 * Note: This is now dynamic - any capsule count is supported
 * The actual counts are determined by the product's standupPouchPrice configuration
 */
export const STAND_UP_POUCH_PLANS = [] as const; // Empty array = dynamic, no restrictions
export type StandUpPouchPlanDays = number; // Any number is allowed

/**
 * Plan Key Mappings
 * Maps plan days to their corresponding keys in product pricing objects
 */
export const SACHETS_PLAN_KEYS: Record<SachetsSubscriptionPlanDays, string> = {
  30: "thirtyDays",
  60: "sixtyDays",
  90: "ninetyDays",
  180: "oneEightyDays",
} as const;

// Product pricing uses dynamic keys based on actual capsule counts
// The keys are determined by the product's standupPouchPrice configuration
export const STAND_UP_POUCH_PLAN_KEYS: Record<number, string> = {}; // Dynamic keys

/**
 * Plan Labels
 * Human-readable labels for each plan
 */
export const SACHETS_PLAN_LABELS: Record<SachetsSubscriptionPlanDays, string> = {
  30: "30 Day Plan",
  60: "60 Day Plan",
  90: "90 Day Plan",
  180: "180 Day Plan",
} as const;

export const STAND_UP_POUCH_PLAN_LABELS: Record<number, string> = {}; // Dynamic labels

/**
 * Helper Functions
 */
export function getSachetsPlanKey(days: number): string | null {
  return SACHETS_PLAN_KEYS[days as SachetsSubscriptionPlanDays] || null;
}

export function getStandUpPouchPlanKey(count: number): string | null {
  // This should be completely dynamic - don't use static values
  // The actual key mapping should be determined at the product level
  // based on the standupPouchPrice structure
  return null; // Let the order controller handle dynamic lookup
}

/** Normalize standupPouchPrice so it always has count_0/count_1 (maps old count60/count120 from DB). */
export function getNormalizedStandupPouchPrice(sp: any): any {
  if (!sp || typeof sp !== "object") return sp;
  if (sp.count_0 || sp.count_1) return sp;
  // Backward compat: map old count60/count120 to count_0/count_1
  if (sp.count60 || sp.count120)
    return { count_0: sp.count60, count_1: sp.count120 };
  return sp;
}

export function getSachetsPlanLabel(days: number): string {
  return SACHETS_PLAN_LABELS[days as SachetsSubscriptionPlanDays] || `${days} Day Plan`;
}

export function getStandUpPouchPlanLabel(count: number): string {
  return `${count} Count`; // Dynamic label based on actual count
}

export function isValidSachetsPlan(days: number): boolean {
  return SACHETS_SUBSCRIPTION_PLANS.includes(days as SachetsSubscriptionPlanDays);
}

export function isValidStandUpPouchPlan(count: number): boolean {
  // All counts are now valid for stand-up pouch - validation happens at product level
  return count > 0; // Only validate that it's a positive number
}

/**
 * Default Plan Values
 */
export const DEFAULT_SACHETS_PLAN = 180; // Default to 180 days
export const DEFAULT_STAND_UP_POUCH_PLAN = 60; // Default to 60 count

/**
 * Plan Configuration for Checkout Service
 */
export const SACHETS_PLANS_CONFIG = SACHETS_SUBSCRIPTION_PLANS.map((days) => ({
  key: SACHETS_PLAN_KEYS[days],
  label: SACHETS_PLAN_LABELS[days],
  days,
  isSubscription: true,
}));

export const STAND_UP_POUCH_PLANS_CONFIG = []; // Empty = dynamic configuration

