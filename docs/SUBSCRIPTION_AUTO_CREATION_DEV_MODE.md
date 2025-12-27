# Subscription Auto-Creation - Development Mode

## Overview

By default, subscriptions are created via **webhook** after payment completion. This is the correct production flow:

```
Payment Created (PENDING) → User Pays → Webhook → Payment COMPLETED → Subscription Created
```

However, for **development and testing**, you can enable immediate subscription creation without waiting for webhooks.

---

## 🚨 Important Notes

### Production Behavior (Default):

- ✅ Subscriptions created via webhook after payment completion
- ✅ Payment must be COMPLETED before subscription is created
- ✅ Reliable and webhook-driven
- ✅ Works with both `/create` and `/intent` APIs

### Development Mode (Optional):

- ⚠️ Subscriptions created immediately on payment creation
- ⚠️ Payment is still PENDING (not completed yet)
- ⚠️ Only for testing convenience
- ⚠️ **NOT recommended for production**

---

## 🔧 Enable Development Mode

### Step 1: Update Environment Variables

Add to your `.env` file:

```env
# Development/Testing Configuration
NODE_ENV=development
AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=true
```

### Step 2: Restart Server

```bash
npm run dev
```

### Step 3: Test

```bash
curl -X POST http://localhost:8080/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "YOUR_ORDER_ID",
    "paymentMethod": "MOLLIE",
    "returnUrl": "http://localhost:3000/payment/return"
  }'
```

**Result:** Subscription will be created immediately if order is eligible.

---

## 📋 How It Works

### With Development Mode Enabled:

```
1. Create Payment Request
   ↓
2. Payment Created (PENDING)
   ↓
3. Order Validated for Subscription
   ↓
4. Subscription Created Immediately ✅
   ↓
5. Response Returned
   ↓
6. (Later) Webhook Still Processes Normally
```

### Console Output:

```
🟡 [DEV MODE] Attempting immediate subscription creation for testing...
🟢 [SUBSCRIPTION] ========== Create Subscription From Order ==========
🟢 [SUBSCRIPTION] Order Number: ORD-2025-001
🟢 [SUBSCRIPTION] Step 1: Validating order eligibility...
✅ [SUBSCRIPTION] - Order is eligible for subscription
✅ [DEV MODE] Subscription created immediately: SUB-2025-001
```

---

## 🎯 Use Cases

### When to Enable:

- ✅ Local development testing
- ✅ Unit/integration tests
- ✅ Quick testing without payment gateway
- ✅ Frontend development without webhook setup

### When NOT to Enable:

- ❌ Production environment
- ❌ Staging environment
- ❌ When testing actual payment flows
- ❌ When testing webhook integration

---

## 🔄 Both APIs Support This

Both payment APIs now have the same development mode support:

### `/api/v1/payments/create`

```bash
POST /api/v1/payments/create
{
  "orderId": "...",
  "paymentMethod": "MOLLIE"
}
```

### `/api/v1/payments/intent`

```bash
POST /api/v1/payments/intent
{
  "orderId": "...",
  "paymentMethod": "MOLLIE"
}
```

Both will create subscription immediately if:

- `NODE_ENV=development`
- `AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=true`
- Order is eligible for subscription

---

## 🧪 Testing Subscription Creation

### Test 1: Create Subscription Order + Payment

```bash
# 1. Create subscription order
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [{
      "productId": "PRODUCT_ID",
      "quantity": 1,
      "planDays": 30
    }],
    "shippingAddressId": "ADDRESS_ID",
    "billingAddressId": "ADDRESS_ID",
    "isOneTime": false,
    "planType": "SUBSCRIPTION",
    "variantType": "SACHETS",
    "selectedPlanDays": 30
  }'

# 2. Create payment (subscription will be created immediately in dev mode)
curl -X POST http://localhost:8080/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "ORDER_ID_FROM_STEP_1",
    "paymentMethod": "MOLLIE"
  }'

# 3. Check subscription was created
curl -X GET http://localhost:8080/api/v1/subscriptions/user/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 2: Verify Logs

```bash
# Check payment logs
grep "Payment created" logs/combined.log | tail -5

# Check dev mode logs
grep "DEV MODE" logs/combined.log | tail -10

# Check subscription logs
grep "SUBSCRIPTION" logs/combined.log | tail -20
```

---

## 🔍 Subscription Eligibility

Subscription will only be created if order meets these criteria:

### Required:

- ✅ `isOneTime = false` OR `planType = "SUBSCRIPTION"`
- ✅ `variantType = "SACHETS"`
- ✅ `selectedPlanDays` in [30, 60, 90, 180]
- ✅ No duplicate subscription exists

### If Not Eligible:

```
ℹ️ [DEV MODE] Order not eligible for subscription or already exists
```

---

## 🐛 Troubleshooting

### Subscription Not Created in Dev Mode?

**Check 1: Environment Variables**

```bash
# Verify settings
echo $NODE_ENV
echo $AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT

# Should output:
# development
# true
```

**Check 2: Order Eligibility**

```bash
# Get order details
curl -X GET http://localhost:8080/api/v1/orders/ORDER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify:
# - isOneTime: false
# - planType: "SUBSCRIPTION"
# - variantType: "SACHETS"
# - selectedPlanDays: 30, 60, 90, or 180
```

**Check 3: Logs**

```bash
# Check for errors
grep "DEV MODE.*failed" logs/combined.log
grep "SUBSCRIPTION.*ERROR" logs/error.log
```

**Check 4: Duplicate Subscription**

```bash
# Check if subscription already exists
curl -X GET http://localhost:8080/api/v1/subscriptions/user/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⚠️ Production Considerations

### Why Not Use in Production?

1. **Payment Not Completed:**

   - Subscription created before payment is actually completed
   - User might cancel payment after subscription is created
   - Inconsistent state

2. **Webhook Still Needed:**

   - Webhook will try to create subscription again
   - Duplicate prevention logic will skip it
   - But adds unnecessary processing

3. **Error Handling:**
   - If subscription creation fails, payment still succeeds
   - In production, webhook retry handles this
   - In dev mode, no retry mechanism

### Production Setup:

```env
# Production .env
NODE_ENV=production
# AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT not set (defaults to false)
```

**Result:** Subscriptions only created via webhook after payment completion.

---

## 🔄 Webhook Flow (Production)

Even with dev mode enabled, webhook flow still works:

```
1. Payment Created (PENDING)
   ↓
2. [DEV MODE] Subscription Created Immediately
   ↓
3. User Completes Payment
   ↓
4. Webhook Received
   ↓
5. Payment Updated (COMPLETED)
   ↓
6. Subscription Creation Attempted
   ↓
7. Duplicate Check → Subscription Already Exists
   ↓
8. Skip Creation (No Error)
```

**Duplicate Prevention:** The `createSubscriptionFromOrder` function checks for existing subscriptions and skips creation if one exists.

---

## 📊 Comparison

| Feature               | Production       | Development Mode    |
| --------------------- | ---------------- | ------------------- |
| Subscription Creation | Via Webhook      | Immediate           |
| Payment Status        | COMPLETED        | PENDING             |
| Timing                | After payment    | On payment creation |
| Reliability           | High             | Medium              |
| Testing               | Requires payment | No payment needed   |
| Recommended           | ✅ Yes           | ⚠️ Testing only     |

---

## 🎓 Best Practices

### Development:

1. ✅ Enable dev mode for quick testing
2. ✅ Verify subscription eligibility first
3. ✅ Check logs for errors
4. ✅ Test webhook flow separately

### Testing:

1. ✅ Test with dev mode enabled (quick)
2. ✅ Test with dev mode disabled (realistic)
3. ✅ Test webhook flow end-to-end
4. ✅ Test duplicate prevention

### Production:

1. ✅ Always disable dev mode
2. ✅ Rely on webhook flow
3. ✅ Monitor webhook logs
4. ✅ Set up webhook retry/monitoring

---

## 📝 Code Reference

### Location:

`src/services/payment/PaymentService.ts`

### Methods Updated:

- `createPayment()` - Line ~260
- `createPaymentIntentForOrder()` - Line ~1060

### Logic:

```typescript
if (
  process.env.NODE_ENV === "development" &&
  process.env.AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT === "true"
) {
  // Attempt immediate subscription creation
  const subscription = await this.createSubscriptionFromOrder(order, payment);
}
```

---

## 🆘 Support

### Need Help?

**Check Logs:**

```bash
# All logs
tail -f logs/combined.log

# Dev mode only
grep "DEV MODE" logs/combined.log

# Subscription only
grep "SUBSCRIPTION" logs/combined.log

# Errors only
tail -f logs/error.log
```

**Verify Configuration:**

```bash
# Check environment
node -e "console.log('NODE_ENV:', process.env.NODE_ENV)"
node -e "console.log('AUTO_CREATE:', process.env.AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT)"
```

**Test Subscription Creation:**

```bash
# Run test suite
./docs/PAYMENT_API_TEST_COMMANDS.sh 5
```

---

## ✅ Checklist

### Enable Development Mode:

- [ ] Set `NODE_ENV=development` in `.env`
- [ ] Set `AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=true` in `.env`
- [ ] Restart server
- [ ] Verify environment variables
- [ ] Test with eligible order
- [ ] Check logs for success

### Disable for Production:

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Remove or set `AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=false`
- [ ] Restart server
- [ ] Verify webhook URL is accessible
- [ ] Test webhook flow
- [ ] Monitor webhook logs

---

**Last Updated:** December 27, 2025
**Version:** 2.0
**Status:** ✅ Production Ready (with optional dev mode)
