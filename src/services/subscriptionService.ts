import { SubscriptionCycle } from "@/models/enums";

/**
 * Calculate next delivery date based on cycle days
 */
export const calculateNextDeliveryDate = (
  currentDate: Date,
  cycleDays: SubscriptionCycle
): Date => {
  const nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + cycleDays);
  return nextDate;
};

/**
 * Calculate next billing date based on cycle days
 * (Currently same logic as delivery; adjust if business rules change)
 */
export const calculateNextBillingDate = (
  currentDate: Date,
  cycleDays: SubscriptionCycle
): Date => {
  return calculateNextDeliveryDate(currentDate, cycleDays);
};

const getDaysDifference = (
  futureDate?: Date | string | null
): number | null => {
  if (!futureDate) {
    return null;
  }
  const date = new Date(futureDate);
  if (isNaN(date.getTime())) {
    return null;
  }
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

export const computeSubscriptionMetrics = (subscription: {
  initialDeliveryDate?: Date;
  nextDeliveryDate?: Date;
  nextBillingDate?: Date;
  lastDeliveredDate?: Date;
  cycleDays: number;
}) => {
  const daysUntilNextDelivery = getDaysDifference(
    subscription.nextDeliveryDate
  );
  const daysUntilNextBilling = getDaysDifference(subscription.nextBillingDate);

  let cycleCount = 0;
  if (
    subscription.initialDeliveryDate &&
    subscription.lastDeliveredDate &&
    subscription.cycleDays
  ) {
    const diff =
      subscription.lastDeliveredDate.getTime() -
      subscription.initialDeliveryDate.getTime();
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (subscription.cycleDays > 0) {
      cycleCount = Math.floor(daysDiff / subscription.cycleDays);
    }
  }

  return {
    daysUntilNextDelivery,
    daysUntilNextBilling,
    cycleCount,
  };
};
