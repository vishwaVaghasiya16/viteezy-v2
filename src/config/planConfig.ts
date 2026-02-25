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
 * These are the available capsule counts and plan days for one-time purchases
 * Note: STAND_UP_POUCH only supports one-time plans (no subscription)
 * Note: capsuleCount and planDays are the same for STAND_UP_POUCH
 */
export const STAND_UP_POUCH_PLANS = [60, 120] as const;
export type StandUpPouchPlanDays = typeof STAND_UP_POUCH_PLANS[number];

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

// NOTE:
// - Product pricing uses keys `count60` and `count120` directly
// - Business plans for STAND_UP_POUCH are 60-count and 120-count
// - Direct mapping: 60 -> count60, 120 -> count120
export const STAND_UP_POUCH_PLAN_KEYS: Record<StandUpPouchPlanDays, string> = {
  60: "count60",
  120: "count120",
} as const;

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

export const STAND_UP_POUCH_PLAN_LABELS: Record<StandUpPouchPlanDays, string> = {
  60: "60 Count",
  120: "120 Count",
} as const;

/**
 * Helper Functions
 */
export function getSachetsPlanKey(days: number): string | null {
  return SACHETS_PLAN_KEYS[days as SachetsSubscriptionPlanDays] || null;
}

export function getStandUpPouchPlanKey(count: number): string | null {
  return STAND_UP_POUCH_PLAN_KEYS[count as StandUpPouchPlanDays] || null;
}

export function getSachetsPlanLabel(days: number): string {
  return SACHETS_PLAN_LABELS[days as SachetsSubscriptionPlanDays] || `${days} Day Plan`;
}

export function getStandUpPouchPlanLabel(count: number): string {
  return STAND_UP_POUCH_PLAN_LABELS[count as StandUpPouchPlanDays] || `${count} Count`;
}

export function isValidSachetsPlan(days: number): boolean {
  return SACHETS_SUBSCRIPTION_PLANS.includes(days as SachetsSubscriptionPlanDays);
}

export function isValidStandUpPouchPlan(count: number): boolean {
  return STAND_UP_POUCH_PLANS.includes(count as StandUpPouchPlanDays);
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

export const STAND_UP_POUCH_PLANS_CONFIG = STAND_UP_POUCH_PLANS.map((count) => ({
  key: STAND_UP_POUCH_PLAN_KEYS[count],
  label: STAND_UP_POUCH_PLAN_LABELS[count],
  count,
}));

