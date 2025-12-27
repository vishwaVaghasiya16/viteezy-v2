# Subscription Auto-Creation - Test Scenarios

## Test Environment Setup

### Prerequisites

1. MongoDB running
2. Server running on `http://localhost:8080`
3. Valid user authentication token
4. Stripe/Mollie test credentials configured

---

## Test Scenario 1: Successful Subscription Creation

### Setup

```json
{
  "orderData": {
    "isOneTime": false,
    "planType": "SUBSCRIPTION",
    "variantType": "SACHETS",
    "selectedPlanDays": 60,
    "items": [
      {
        "productId": "product_id_here",
        "name": "Test Product",
        "planDays": 60,
        "capsuleCount": 30,
        "amount": 49.99,
        "discountedPrice": 39.99,
        "taxRate": 0.21,
        "totalAmount": 48.39
      }
    ]
  }
}
```

### Expected Result

✅ **Subscription Created**

```json
{
  "subscriptionNumber": "SUB-1234567890-5678",
  "status": "active",
  "cycleDays": 60,
  "subscriptionStartDate": "2025-12-27T00:00:00.000Z",
  "nextBillingDate": "2026-02-25T00:00:00.000Z",
  "nextDeliveryDate": "2026-02-25T00:00:00.000Z"
}
```

### Verification

```bash
# Check subscription in database
db.subscriptions.find({ orderId: ObjectId("order_id") })

# Check logs
grep "Subscription.*created" logs/combined.log
```

---

## Test Scenario 2: One-Time Purchase (No Subscription)

### Setup

```json
{
  "orderData": {
    "isOneTime": true,
    "planType": "ONE_TIME",
    "variantType": "SACHETS",
    "selectedPlanDays": null,
    "items": [...]
  }
}
```

### Expected Result

ℹ️ **Subscription NOT Created**

Log message:

```
ℹ️ [SUBSCRIPTION] Order ORD-xxx is one-time purchase, skipping subscription creation
```

### Verification

```bash
# Check no subscription created
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()
# Expected: 0
```

---

## Test Scenario 3: Wrong Variant Type

### Setup

```json
{
  "orderData": {
    "isOneTime": false,
    "planType": "SUBSCRIPTION",
    "variantType": "STAND_UP_POUCH",
    "selectedPlanDays": 60,
    "items": [...]
  }
}
```

### Expected Result

ℹ️ **Subscription NOT Created**

Log message:

```
ℹ️ [SUBSCRIPTION] Order ORD-xxx variantType is STAND_UP_POUCH, subscription only available for SACHETS
```

### Verification

```bash
# Check no subscription created
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()
# Expected: 0
```

---

## Test Scenario 4: Invalid Plan Days

### Setup

```json
{
  "orderData": {
    "isOneTime": false,
    "planType": "SUBSCRIPTION",
    "variantType": "SACHETS",
    "selectedPlanDays": 45,  // Invalid (not 30, 60, 90, or 180)
    "items": [...]
  }
}
```

### Expected Result

⚠️ **Subscription NOT Created**

Log message:

```
⚠️ [SUBSCRIPTION] Order ORD-xxx has invalid cycleDays: 45, skipping subscription creation
```

### Verification

```bash
# Check no subscription created
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()
# Expected: 0
```

---

## Test Scenario 5: Duplicate Prevention

### Setup

1. Create order and complete payment (subscription created)
2. Trigger webhook again (simulate duplicate webhook)

### Expected Result

⚠️ **Duplicate Prevented**

Log messages:

```
# First webhook
✅ [SUBSCRIPTION] Subscription SUB-xxx created for order ORD-xxx

# Second webhook
⚠️ [SUBSCRIPTION] Subscription already exists for order ORD-xxx, skipping creation
```

### Verification

```bash
# Check only ONE subscription exists
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()
# Expected: 1
```

---

## Test Scenario 6: Stripe Webhook Integration

### Setup

1. Create order via API
2. Create payment intent via Stripe
3. Complete payment in Stripe test mode
4. Stripe sends webhook to server

### Steps

```bash
# 1. Create order
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "isOneTime": false,
    "variantType": "SACHETS",
    "selectedPlanDays": 60,
    "items": [...]
  }'

# 2. Create payment intent
curl -X POST http://localhost:8080/api/v1/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order_id",
    "paymentMethod": "stripe"
  }'

# 3. Complete payment in Stripe (use test card)
# Stripe will send webhook automatically

# 4. Check subscription created
curl -X GET http://localhost:8080/api/v1/subscriptions \
  -H "Authorization: Bearer <token>"
```

### Expected Result

✅ **Subscription Created via Webhook**

```json
{
  "success": true,
  "data": [
    {
      "subscriptionNumber": "SUB-xxx",
      "status": "active",
      "orderId": "order_id",
      "metadata": {
        "autoCreated": true,
        "createdFromPayment": "payment_id"
      }
    }
  ]
}
```

---

## Test Scenario 7: Mollie Webhook Integration

### Setup

1. Create order via API
2. Create payment intent via Mollie
3. Complete payment in Mollie test mode
4. Mollie sends webhook to server

### Steps

```bash
# 1. Create order
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "isOneTime": false,
    "variantType": "SACHETS",
    "selectedPlanDays": 90,
    "items": [...]
  }'

# 2. Create payment intent
curl -X POST http://localhost:8080/api/v1/payments/create-intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "orderId": "order_id",
    "paymentMethod": "mollie"
  }'

# 3. Complete payment in Mollie (use test payment)
# Mollie will send webhook automatically

# 4. Check subscription created
curl -X GET http://localhost:8080/api/v1/subscriptions \
  -H "Authorization: Bearer <token>"
```

### Expected Result

✅ **Subscription Created via Webhook**

```json
{
  "success": true,
  "data": [
    {
      "subscriptionNumber": "SUB-xxx",
      "status": "active",
      "orderId": "order_id",
      "cycleDays": 90,
      "metadata": {
        "autoCreated": true,
        "createdFromPayment": "payment_id"
      }
    }
  ]
}
```

---

## Test Scenario 8: Transaction Rollback on Error

### Setup

1. Create order with valid data
2. Simulate database error during subscription creation
3. Verify transaction rollback

### Mock Error

```typescript
// In PaymentService.ts (for testing only)
if (order.orderNumber === "TEST_ERROR") {
  throw new Error("Simulated database error");
}
```

### Expected Result

❌ **Error Logged, Transaction Rolled Back**

Log messages:

```
❌ [SUBSCRIPTION] Failed to create subscription for order ORD-xxx: Simulated database error
```

### Verification

```bash
# Check no subscription created (rolled back)
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()
# Expected: 0

# Check payment still completed (not affected)
db.payments.findOne({ orderId: ObjectId("order_id") })
# Expected: { status: "completed" }

# Check order still confirmed (not affected)
db.orders.findOne({ _id: ObjectId("order_id") })
# Expected: { status: "confirmed", paymentStatus: "completed" }
```

---

## Test Scenario 9: Multiple Items in Order

### Setup

```json
{
  "orderData": {
    "isOneTime": false,
    "variantType": "SACHETS",
    "selectedPlanDays": 180,
    "items": [
      {
        "productId": "product_1",
        "name": "Product 1",
        "planDays": 180,
        "capsuleCount": 30,
        "amount": 49.99
      },
      {
        "productId": "product_2",
        "name": "Product 2",
        "planDays": 180,
        "capsuleCount": 60,
        "amount": 89.99
      }
    ]
  }
}
```

### Expected Result

✅ **Subscription Created with Multiple Items**

```json
{
  "subscriptionNumber": "SUB-xxx",
  "items": [
    {
      "productId": "product_1",
      "name": "Product 1",
      "capsuleCount": 30
    },
    {
      "productId": "product_2",
      "name": "Product 2",
      "capsuleCount": 60
    }
  ]
}
```

---

## Test Scenario 10: Payment Verification (Frontend Callback)

### Setup

1. Create order and payment
2. User completes payment in Stripe/Mollie
3. Frontend calls verification endpoint
4. Subscription created during verification

### Steps

```bash
# 1. Create order and payment (as before)

# 2. User completes payment (in Stripe/Mollie UI)

# 3. Frontend calls verification endpoint
curl -X POST http://localhost:8080/api/v1/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "paymentId": "payment_id",
    "gatewayTransactionId": "stripe_or_mollie_transaction_id"
  }'

# 4. Check subscription created
curl -X GET http://localhost:8080/api/v1/subscriptions \
  -H "Authorization: Bearer <token>"
```

### Expected Result

✅ **Subscription Created via Verification**

```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "payment": {
      "status": "completed"
    },
    "order": {
      "status": "confirmed"
    }
  }
}
```

---

## Automated Test Suite

### Jest Test Example

```typescript
describe("Subscription Auto-Creation", () => {
  it("should create subscription for valid subscription order", async () => {
    // Arrange
    const order = await createTestOrder({
      isOneTime: false,
      variantType: "SACHETS",
      selectedPlanDays: 60,
    });
    const payment = await createTestPayment({ orderId: order._id });

    // Act
    const subscription = await paymentService.createSubscriptionFromOrder(
      order,
      payment
    );

    // Assert
    expect(subscription).not.toBeNull();
    expect(subscription.status).toBe("active");
    expect(subscription.cycleDays).toBe(60);
  });

  it("should NOT create subscription for one-time order", async () => {
    // Arrange
    const order = await createTestOrder({
      isOneTime: true,
      variantType: "SACHETS",
    });
    const payment = await createTestPayment({ orderId: order._id });

    // Act
    const subscription = await paymentService.createSubscriptionFromOrder(
      order,
      payment
    );

    // Assert
    expect(subscription).toBeNull();
  });

  it("should prevent duplicate subscriptions", async () => {
    // Arrange
    const order = await createTestOrder({
      isOneTime: false,
      variantType: "SACHETS",
      selectedPlanDays: 60,
    });
    const payment = await createTestPayment({ orderId: order._id });

    // Act
    const subscription1 = await paymentService.createSubscriptionFromOrder(
      order,
      payment
    );
    const subscription2 = await paymentService.createSubscriptionFromOrder(
      order,
      payment
    );

    // Assert
    expect(subscription1).not.toBeNull();
    expect(subscription2).toBeNull(); // Duplicate prevented
  });
});
```

---

## Performance Testing

### Load Test

```bash
# Test 100 concurrent subscription creations
ab -n 100 -c 10 -T application/json \
  -H "Authorization: Bearer <token>" \
  -p order_data.json \
  http://localhost:8080/api/v1/orders
```

### Expected Performance

- **Average Response Time**: < 500ms
- **Success Rate**: 100%
- **No Duplicate Subscriptions**: Verified

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Subscription Creation Rate**

   - Track: `subscriptions.created` count per hour
   - Alert: If rate drops below expected

2. **Subscription Creation Failures**

   - Track: `[SUBSCRIPTION].*ERROR` in logs
   - Alert: If failure rate > 1%

3. **Duplicate Prevention**

   - Track: `Subscription already exists` log count
   - Alert: If count is unusually high

4. **Transaction Rollbacks**
   - Track: Transaction abort count
   - Alert: If rollback rate > 5%

---

## Troubleshooting Guide

### Issue: Subscription not created

**Debug Steps**:

```bash
# 1. Check order data
db.orders.findOne({ _id: ObjectId("order_id") })

# 2. Check payment status
db.payments.findOne({ orderId: ObjectId("order_id") })

# 3. Check logs
grep "SUBSCRIPTION.*order_id" logs/combined.log

# 4. Check eligibility
# - isOneTime should be false
# - variantType should be SACHETS
# - selectedPlanDays should be 30, 60, 90, or 180
```

### Issue: Duplicate subscriptions

**Debug Steps**:

```bash
# 1. Check subscription count
db.subscriptions.find({ orderId: ObjectId("order_id") }).count()

# 2. Check transaction logs
grep "Transaction.*abort\|commit" logs/combined.log

# 3. Check database indexes
db.subscriptions.getIndexes()
```

---

## Summary Checklist

Before deploying to production, verify:

- ✅ All test scenarios pass
- ✅ Duplicate prevention works
- ✅ Transaction rollback works
- ✅ Stripe webhook integration works
- ✅ Mollie webhook integration works
- ✅ Logs are clear and informative
- ✅ Performance is acceptable
- ✅ Monitoring is set up
- ✅ Documentation is complete

---

**Last Updated**: December 27, 2025
