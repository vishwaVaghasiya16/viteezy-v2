# Subscription Auto-Creation Implementation

## Overview

This document describes the automatic subscription creation logic that triggers after successful payment completion for subscription orders.

## Architecture

### Main Components

1. **`createSubscriptionFromOrder()`** - Reusable subscription creation function
2. **Webhook Handlers** - Stripe and Mollie webhook processing
3. **Payment Verification** - Frontend callback verification
4. **Transaction Management** - Database transaction support

---

## Subscription Creation Logic

### Entry Point: `createSubscriptionFromOrder(order, payment)`

Location: `src/services/payment/PaymentService.ts`

This is the main reusable function that handles subscription creation from an order.

### Flow Diagram

```
Payment Completed (Webhook/Verification)
    ↓
Update Order Status (paymentStatus = "completed", status = "confirmed")
    ↓
Check Subscription Eligibility
    ↓
Create Subscription (if eligible)
    ↓
Return Subscription or null
```

---

## Implementation Details

### Step 1: Validate Order Eligibility

The order must meet ALL of the following conditions:

#### Condition 1: Order Type

- `order.isOneTime === false` **OR** `order.planType === "SUBSCRIPTION"`
- If order is a one-time purchase, skip subscription creation

#### Condition 2: Variant Type

- `order.variantType === "SACHETS"`
- Subscriptions are only available for SACHETS variant
- STAND_UP_POUCH orders are not eligible

#### Condition 3: Plan Duration

- `order.selectedPlanDays` must be one of: `30`, `60`, `90`, or `180`
- Invalid plan days will skip subscription creation

### Step 2: Check for Duplicate Subscription

```typescript
const existingSubscription = await Subscriptions.findOne({
  orderId: order._id,
  isDeleted: false,
});

if (existingSubscription) {
  // Skip creation - subscription already exists
  return null;
}
```

**Safety Feature**: Prevents duplicate subscriptions for the same order.

### Step 3: Calculate Subscription Dates

#### Auto-Generated Fields

| Field                   | Calculation                            | Example (if payment on Jan 1, 2025, cycleDays = 30) |
| ----------------------- | -------------------------------------- | --------------------------------------------------- |
| `subscriptionStartDate` | Current date (payment completion date) | Jan 1, 2025                                         |
| `subscriptionEndDate`   | `undefined` (ongoing subscription)     | `undefined`                                         |
| `lastBilledDate`        | Current date (payment just completed)  | Jan 1, 2025                                         |
| `initialDeliveryDate`   | `subscriptionStartDate + 1 day`        | Jan 2, 2025                                         |
| `nextDeliveryDate`      | `subscriptionStartDate + cycleDays`    | Jan 31, 2025                                        |
| `nextBillingDate`       | `subscriptionStartDate + cycleDays`    | Jan 31, 2025                                        |
| `status`                | `"active"`                             | `"active"`                                          |

### Step 4: Map Order Items to Subscription Items

```typescript
const subscriptionItems = order.items.map((item) => ({
  productId: new mongoose.Types.ObjectId(item.productId),
  name: item.name,
  planDays: item.planDays,
  capsuleCount: item.capsuleCount,
  amount: item.amount,
  discountedPrice: item.discountedPrice,
  taxRate: item.taxRate,
  totalAmount: item.totalAmount,
  durationDays: item.durationDays,
  savingsPercentage: item.savingsPercentage,
  features: item.features || [],
}));
```

### Step 5: Create Subscription with Transaction

```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  const subscription = await Subscriptions.create(
    [
      {
        userId: order.userId,
        orderId: order._id,
        planType: OrderPlanType.SUBSCRIPTION,
        cycleDays: cycleDays as SubscriptionCycle,
        subscriptionStartDate,
        subscriptionEndDate,
        items: subscriptionItems,
        initialDeliveryDate,
        nextDeliveryDate,
        nextBillingDate,
        lastBilledDate,
        status: SubscriptionStatus.ACTIVE,
        metadata: {
          autoCreated: true,
          createdFromPayment: payment._id.toString(),
          orderNumber: order.orderNumber,
          createdAt: new Date().toISOString(),
        },
      },
    ],
    { session }
  );

  await session.commitTransaction();
  return subscription[0];
} catch (error) {
  await session.abortTransaction();
  return null;
} finally {
  session.endSession();
}
```

---

## Webhook Integration

### Stripe Webhook Flow

**Event**: `checkout.session.completed` OR `payment_intent.succeeded`

```typescript
// 1. Verify webhook signature
const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

// 2. Process payment status
const result = await gateway.processWebhook(payload, signature, rawBody);

// 3. Update payment in database
payment.status = result.status;
await payment.save();

// 4. Update order status
order.paymentStatus = PaymentStatus.COMPLETED;
order.status = OrderStatus.CONFIRMED;
await order.save();

// 5. Create subscription (if eligible)
const subscription = await paymentService.createSubscriptionFromOrder(
  order,
  payment
);
```

**Location**: `src/services/payment/PaymentService.ts` → `processWebhook()`

### Mollie Webhook Flow

**Event**: `payment.status === "paid"`

```typescript
// 1. Fetch payment from Mollie
const molliePayment = await mollieClient.payments.get(paymentId);

// 2. Check payment status
if (molliePayment.status === "paid") {
  // 3. Update payment in database
  payment.status = PaymentStatus.COMPLETED;
  await payment.save();

  // 4. Update order status
  order.paymentStatus = PaymentStatus.COMPLETED;
  order.status = OrderStatus.CONFIRMED;
  await order.save();

  // 5. Create subscription (if eligible)
  const subscription = await paymentService.createSubscriptionFromOrder(
    order,
    payment
  );
}
```

**Location**: `src/services/payment/PaymentService.ts` → `processWebhook()`

---

## Safety & Edge Cases

### 1. Duplicate Prevention

✅ **Implemented**: Check for existing subscription before creation

```typescript
const existingSubscription = await Subscriptions.findOne({
  orderId: order._id,
  isDeleted: false,
});

if (existingSubscription) {
  return null; // Skip creation
}
```

### 2. Transaction Support

✅ **Implemented**: All database operations wrapped in transaction

```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Create subscription
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
} finally {
  session.endSession();
}
```

### 3. Error Handling

✅ **Implemented**: Errors logged but don't break payment flow

```typescript
try {
  await this.createSubscriptionFromOrder(order, payment);
} catch (error) {
  logger.error("Subscription creation failed:", error);
  // Don't throw - payment should still succeed
}
```

### 4. Idempotency

✅ **Implemented**: Multiple webhook calls won't create duplicate subscriptions

- Check for existing subscription
- Transaction ensures atomicity
- Webhook status change tracking prevents re-processing

### 5. Order Status Protection

✅ **Implemented**: Prevent downgrading from COMPLETED to PENDING

```typescript
if (
  payment.status === PaymentStatus.COMPLETED &&
  result.status === PaymentStatus.PENDING
) {
  // Ignore PENDING status from webhook
  return payment;
}
```

---

## Testing

### Test Scenarios

#### 1. Successful Subscription Creation

```bash
# Order Details
- isOneTime: false
- variantType: "SACHETS"
- selectedPlanDays: 60
- paymentStatus: "completed"

# Expected Result
✅ Subscription created with:
- status: "active"
- cycleDays: 60
- nextBillingDate: current_date + 60 days
```

#### 2. One-Time Purchase (No Subscription)

```bash
# Order Details
- isOneTime: true
- variantType: "SACHETS"
- selectedPlanDays: null

# Expected Result
ℹ️ Subscription NOT created (one-time purchase)
```

#### 3. Wrong Variant Type

```bash
# Order Details
- isOneTime: false
- variantType: "STAND_UP_POUCH"
- selectedPlanDays: 60

# Expected Result
ℹ️ Subscription NOT created (wrong variant)
```

#### 4. Duplicate Prevention

```bash
# Scenario
1. First webhook: Creates subscription
2. Second webhook: Skips creation (duplicate detected)

# Expected Result
✅ Only ONE subscription exists
```

#### 5. Invalid Plan Days

```bash
# Order Details
- isOneTime: false
- variantType: "SACHETS"
- selectedPlanDays: 45 (invalid)

# Expected Result
⚠️ Subscription NOT created (invalid plan days)
```

---

## API Endpoints

### Webhook Endpoints

#### Stripe Webhook

```
POST /api/v1/payments/webhook/stripe
Content-Type: application/json
Stripe-Signature: <signature>
```

#### Mollie Webhook

```
POST /api/v1/payments/webhook/mollie
Content-Type: application/json
```

### Manual Subscription Creation

If you need to manually create a subscription (e.g., for testing or admin purposes):

```typescript
import { paymentService } from "@/services/payment/PaymentService";

// Fetch order and payment
const order = await Orders.findById(orderId).lean();
const payment = await Payments.findById(paymentId).lean();

// Create subscription
const subscription = await paymentService.createSubscriptionFromOrder(
  order,
  payment
);

if (subscription) {
  console.log("Subscription created:", subscription.subscriptionNumber);
} else {
  console.log("Subscription not created (not eligible or already exists)");
}
```

---

## Logging

### Log Levels

- **INFO**: Subscription creation success/skip
- **WARN**: Invalid conditions (wrong variant, invalid plan days)
- **ERROR**: Database errors, transaction failures

### Log Examples

```typescript
// Success
✅ [SUBSCRIPTION] Subscription SUB-1234567890-5678 created for order ORD-123

// Skip (one-time)
ℹ️ [SUBSCRIPTION] Order ORD-123 is one-time purchase, skipping subscription creation

// Skip (duplicate)
⚠️ [SUBSCRIPTION] Subscription already exists for order ORD-123, skipping creation

// Error
❌ [SUBSCRIPTION] Failed to create subscription for order ORD-123: Database error
```

---

## Database Schema

### Subscriptions Collection

```typescript
{
  _id: ObjectId,
  subscriptionNumber: "SUB-1234567890-5678",
  userId: ObjectId,
  orderId: ObjectId,
  status: "active",
  planType: "SUBSCRIPTION",
  cycleDays: 60,
  subscriptionStartDate: Date,
  subscriptionEndDate: Date | undefined,
  items: [
    {
      productId: ObjectId,
      name: "Product Name",
      planDays: 60,
      capsuleCount: 30,
      amount: 49.99,
      discountedPrice: 39.99,
      taxRate: 0.21,
      totalAmount: 48.39,
      durationDays: 60,
      savingsPercentage: 20,
      features: ["Feature 1", "Feature 2"]
    }
  ],
  initialDeliveryDate: Date,
  nextDeliveryDate: Date,
  nextBillingDate: Date,
  lastBilledDate: Date,
  metadata: {
    autoCreated: true,
    createdFromPayment: "payment_id",
    orderNumber: "ORD-123",
    createdAt: "2025-01-01T00:00:00.000Z"
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## Future Enhancements

### Potential Improvements

1. **Email Notifications**

   - Send subscription confirmation email
   - Send reminder before next billing

2. **Subscription Management**

   - Allow users to pause/resume subscriptions
   - Allow users to change plan (upgrade/downgrade)
   - Allow users to skip next delivery

3. **Billing Automation**

   - Automatic billing on `nextBillingDate`
   - Retry failed payments
   - Send payment failure notifications

4. **Delivery Automation**

   - Create order automatically on `nextDeliveryDate`
   - Send tracking information
   - Update delivery status

5. **Analytics**
   - Track subscription churn rate
   - Track subscription revenue
   - Track subscription lifetime value

---

## Troubleshooting

### Issue: Subscription not created after payment

**Checklist**:

1. ✅ Check order.isOneTime is false
2. ✅ Check order.variantType is "SACHETS"
3. ✅ Check order.selectedPlanDays is valid (30, 60, 90, or 180)
4. ✅ Check payment.status is "completed"
5. ✅ Check order.paymentStatus is "completed"
6. ✅ Check no existing subscription for the order
7. ✅ Check logs for errors

### Issue: Duplicate subscriptions created

**Solution**: This should not happen due to duplicate prevention logic. If it does:

1. Check transaction support is working
2. Check database indexes on `orderId`
3. Check webhook idempotency

### Issue: Webhook not triggering subscription creation

**Solution**:

1. Check webhook is configured correctly (Stripe/Mollie dashboard)
2. Check webhook signature verification
3. Check payment status is "completed"
4. Check order status is "confirmed"
5. Check logs for webhook processing

---

## Contact

For questions or issues, please contact the development team or create an issue in the repository.

---

**Last Updated**: December 27, 2025
**Version**: 2.0
**Author**: Development Team
