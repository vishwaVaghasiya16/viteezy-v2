import { OrderPlanType, SubscriptionCycle } from "@/models/enums";
import { PriceType } from "@/models/common.model";

/**
 * Calculate 15% discount for 90-day subscription plans
 * This discount applies to the base subtotal amount
 * @param subtotal - The base subtotal amount
 * @param planType - The order plan type
 * @param cycleDays - The subscription cycle days (60, 90, or 180)
 * @returns Discount amount and metadata
 */
export const calculate90DaySubscriptionDiscount = (
  subtotal: number,
  planType: OrderPlanType,
  cycleDays?: number
): { amount: number; metadata?: Record<string, any> } => {
  // Only apply discount for subscription plans with 90-day cycle
  if (
    planType !== OrderPlanType.SUBSCRIPTION ||
    cycleDays !== SubscriptionCycle.DAYS_90
  ) {
    return { amount: 0 };
  }

  // Apply 15% discount to subtotal
  const discountAmount = (subtotal * 15) / 100;
  const finalDiscountAmount = Math.min(discountAmount, subtotal);

  const roundAmount = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  return {
    amount: roundAmount(finalDiscountAmount),
    metadata: {
      discountType: "90-Day Subscription Discount",
      discountPercentage: 15,
      cycleDays: 90,
      appliedTo: "subtotal",
    },
  };
};

/**
 * Create a PriceType object for subscription plan discount
 * @param discountAmount - The discount amount
 * @param currency - The currency code
 * @returns PriceType object
 */
export const createSubscriptionPlanDiscountPrice = (
  discountAmount: number,
  currency: string = "EUR"
): PriceType => {
  const roundAmount = (value: number): number =>
    Math.round((value + Number.EPSILON) * 100) / 100;

  return {
    currency: currency.toUpperCase(),
    amount: roundAmount(discountAmount),
    taxRate: 0,
  };
};

/**
 * Apply 90-day subscription discount to an order's subtotal
 * This is used when creating recurring orders from subscriptions
 * @param subtotal - The base subtotal amount
 * @param subscriptionCycleDays - The subscription cycle days
 * @param currency - The currency code
 * @returns The discount price object
 */
export const apply90DaySubscriptionDiscountToOrder = (
  subtotal: number,
  subscriptionCycleDays: number,
  currency: string = "EUR"
): PriceType => {
  const discountResult = calculate90DaySubscriptionDiscount(
    subtotal,
    OrderPlanType.SUBSCRIPTION,
    subscriptionCycleDays
  );

  return createSubscriptionPlanDiscountPrice(discountResult.amount, currency);
};
