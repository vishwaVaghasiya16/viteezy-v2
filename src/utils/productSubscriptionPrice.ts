import { SubscriptionCycle } from "@/models/enums";
import { PriceType } from "@/models/common.model";
import {
  IProduct,
  SubscriptionPriceWithMetadata,
} from "@/models/commerce/products.model";
import { AppError } from "./AppError";

/**
 * Get subscription price from product's sachetPrices based on cycleDays
 * @param product - Product document with sachetPrices
 * @param cycleDays - Subscription cycle days (60, 90, or 180)
 * @returns PriceType object with the correct subscription price
 */
export const getSubscriptionPriceFromProduct = (
  product: IProduct | any,
  cycleDays: SubscriptionCycle
): PriceType => {
  // Check if product has sachetPrices
  if (!product.sachetPrices) {
    throw new AppError(
      `Product ${product._id} does not have subscription prices configured`,
      400
    );
  }

  const sachetPrices = product.sachetPrices;
  let subscriptionPrice: SubscriptionPriceWithMetadata | null = null;

  // Map cycleDays to sachetPrices field
  switch (cycleDays) {
    case SubscriptionCycle.DAYS_60:
      subscriptionPrice = sachetPrices.sixtyDays;
      break;
    case SubscriptionCycle.DAYS_90:
      subscriptionPrice = sachetPrices.ninetyDays;
      break;
    case SubscriptionCycle.DAYS_180:
      subscriptionPrice = sachetPrices.oneEightyDays;
      break;
    default:
      throw new AppError(
        `Invalid cycle days: ${cycleDays}. Only 60, 90, or 180 days are supported`,
        400
      );
  }

  if (!subscriptionPrice) {
    throw new AppError(
      `Product ${product._id} does not have price configured for ${cycleDays}-day subscription`,
      400
    );
  }

  // Use amount if available, otherwise calculate from totalAmount
  let amount = subscriptionPrice.amount;
  if (!amount && subscriptionPrice.totalAmount) {
    // Calculate per-cycle amount from totalAmount
    // For example, if totalAmount is for 90 days, divide by number of cycles
    // But typically, totalAmount is the price for the entire period
    // We'll use totalAmount as the amount for this billing cycle
    amount = subscriptionPrice.totalAmount;
  }

  if (!amount) {
    throw new AppError(
      `Product ${product._id} subscription price amount is not configured for ${cycleDays}-day cycle`,
      400
    );
  }

  return {
    currency: subscriptionPrice.currency || "EUR",
    amount: amount,
    taxRate: subscriptionPrice.taxRate || 0,
  };
};

/**
 * Get subscription price metadata (savings, features, etc.)
 * @param product - Product document with sachetPrices
 * @param cycleDays - Subscription cycle days (60, 90, or 180)
 * @returns SubscriptionPriceWithMetadata object
 */
export const getSubscriptionPriceMetadata = (
  product: IProduct | any,
  cycleDays: SubscriptionCycle
): SubscriptionPriceWithMetadata | null => {
  if (!product.sachetPrices) {
    return null;
  }

  const sachetPrices = product.sachetPrices;
  let subscriptionPrice: SubscriptionPriceWithMetadata | null = null;

  switch (cycleDays) {
    case SubscriptionCycle.DAYS_60:
      subscriptionPrice = sachetPrices.sixtyDays;
      break;
    case SubscriptionCycle.DAYS_90:
      subscriptionPrice = sachetPrices.ninetyDays;
      break;
    case SubscriptionCycle.DAYS_180:
      subscriptionPrice = sachetPrices.oneEightyDays;
      break;
    default:
      return null;
  }

  return subscriptionPrice || null;
};

/**
 * Calculate recurring billing amount for subscription
 * This is the amount that will be charged per billing cycle
 * @param product - Product document
 * @param cycleDays - Subscription cycle days
 * @param quantity - Product quantity
 * @returns PriceType for recurring billing amount
 */
export const calculateRecurringBillingAmount = (
  product: IProduct | any,
  cycleDays: SubscriptionCycle,
  quantity: number = 1
): PriceType => {
  const price = getSubscriptionPriceFromProduct(product, cycleDays);

  return {
    currency: price.currency,
    amount: price.amount * quantity,
    taxRate: price.taxRate,
  };
};

/**
 * Get the base subtotal amount for order calculation
 * This uses the product's subscription price based on cycleDays
 * @param product - Product document
 * @param cycleDays - Subscription cycle days
 * @param quantity - Product quantity
 * @returns Base subtotal amount (number)
 */
export const getBaseSubtotalForSubscription = (
  product: IProduct | any,
  cycleDays: SubscriptionCycle,
  quantity: number = 1
): number => {
  const price = getSubscriptionPriceFromProduct(product, cycleDays);
  return price.amount * quantity;
};
