# Payment API - Quick Reference

## 🎯 Overview

Two payment APIs are now **fully aligned** and provide the same functionality:

- `/api/v1/payments/create` - Create payment with optional custom amount
- `/api/v1/payments/intent` - Create payment intent (uses order amount)

Both APIs:
✅ Support auto subscription creation via webhook
✅ Return consistent response format
✅ Include full order details
✅ Send complete data to payment gateways

---

## 🚀 Quick Start

### Option 1: Create Payment (Recommended)

```bash
curl -X POST http://localhost:8080/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "674c9a8e1234567890abcdef",
    "paymentMethod": "MOLLIE",
    "returnUrl": "https://yourapp.com/payment/return",
    "cancelUrl": "https://yourapp.com/payment/cancel"
  }'
```

### Option 2: Create Payment Intent (Same Result)

```bash
curl -X POST http://localhost:8080/api/v1/payments/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "674c9a8e1234567890abcdef",
    "paymentMethod": "MOLLIE",
    "returnUrl": "https://yourapp.com/payment/return",
    "cancelUrl": "https://yourapp.com/payment/cancel"
  }'
```

---

## 📋 Request Parameters

### Required:

- `orderId` - Order ID to create payment for
- `paymentMethod` - Payment gateway (`STRIPE` or `MOLLIE`)

### Optional:

- `amount` - Custom amount (only in `/create`, uses order amount if not provided)
  ```json
  "amount": {
    "value": 99.99,
    "currency": "EUR"
  }
  ```
- `returnUrl` - URL to redirect after successful payment
- `cancelUrl` - URL to redirect if payment is cancelled
- `description` - Payment description (only in `/create`)
- `metadata` - Additional metadata (only in `/create`)

---

## 📤 Response Format

Both APIs return the same format:

```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "payment": {
      "_id": "674c9a8e1234567890abcdef",
      "orderId": "674c9a8e1234567890abcdef",
      "status": "PENDING",
      "amount": {
        "amount": 99.99,
        "currency": "EUR",
        "taxRate": 0.21
      },
      "paymentMethod": "MOLLIE",
      "gatewayTransactionId": "tr_abc123xyz"
    },
    "order": {
      "_id": "674c9a8e1234567890abcdef",
      "orderNumber": "ORD-2025-001",
      "status": "PENDING",
      "paymentStatus": "PENDING",
      "total": {
        "amount": 99.99,
        "currency": "EUR"
      }
    },
    "gateway": {
      "redirectUrl": "https://www.mollie.com/checkout/...",
      "clientSecret": null,
      "gatewayTransactionId": "tr_abc123xyz",
      "sessionId": "cs_test_abc123"
    }
  }
}
```

---

## 🔄 Payment Flow

```
1. Create Payment
   ↓
2. Redirect User to gateway.redirectUrl
   ↓
3. User Completes Payment
   ↓
4. Gateway Sends Webhook
   ↓
5. Backend Updates Payment & Order
   ↓
6. Auto-Create Subscription (if eligible)
   ↓
7. Send Confirmation Email
   ↓
8. Redirect User to returnUrl
```

---

## 🔔 Subscription Auto-Creation

Subscriptions are automatically created when:

### Eligibility Criteria:

✅ Payment status is `COMPLETED`
✅ Order `isOneTime` is `false` OR `planType` is `SUBSCRIPTION`
✅ Order `variantType` is `SACHETS`
✅ Order `selectedPlanDays` is 30, 60, 90, or 180
✅ No duplicate subscription exists

### When It Happens:

- **Production:** Triggered by webhook after payment completion
- **Development:** Can be triggered immediately (optional, for testing)
- Also triggered by frontend callback verification
- Runs in background, doesn't block payment flow

### Development Mode (Optional):

For testing without completing payments, enable immediate subscription creation:

```env
# .env file
NODE_ENV=development
AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=true
```

**⚠️ Warning:** Only use in development. In production, always rely on webhook flow.

See: [SUBSCRIPTION_AUTO_CREATION_DEV_MODE.md](./SUBSCRIPTION_AUTO_CREATION_DEV_MODE.md)

### Subscription Details Created:

- `subscriptionStartDate` = Payment completion date
- `subscriptionEndDate` = Start date + plan days
- `nextBillingDate` = Start date + plan days
- `nextDeliveryDate` = Start date + plan days
- `initialDeliveryDate` = Start date + 1 day
- `status` = `ACTIVE`

---

## 🧪 Testing

### Interactive Test Suite:

```bash
# Run test menu
./docs/PAYMENT_API_TEST_COMMANDS.sh

# Run specific test
./docs/PAYMENT_API_TEST_COMMANDS.sh 1

# Run all tests
./docs/PAYMENT_API_TEST_COMMANDS.sh 11
```

### Manual Testing Steps:

1. **Create Order:**

```bash
POST /api/v1/orders
{
  "items": [...],
  "isOneTime": false,
  "planType": "SUBSCRIPTION",
  "variantType": "SACHETS",
  "selectedPlanDays": 30
}
```

2. **Create Payment:**

```bash
POST /api/v1/payments/create
{
  "orderId": "...",
  "paymentMethod": "MOLLIE"
}
```

3. **Complete Payment:**

- Open `gateway.redirectUrl` in browser
- Complete payment on gateway

4. **Verify Webhook:**

```bash
# Check logs
grep "WEBHOOK" logs/combined.log | tail -20
grep "SUBSCRIPTION" logs/combined.log | tail -20
```

5. **Check Subscription:**

```bash
GET /api/v1/subscriptions/user/me
```

---

## 🔍 Tracking Payment Status

### Track by Order ID:

```bash
curl -X GET "http://localhost:8080/api/v1/payments/track?orderId=674c9a8e..." \
  -H "Content-Type: application/json"
```

### Get Payment Details:

```bash
curl -X GET "http://localhost:8080/api/v1/payments/674c9a8e..." \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify Payment (Frontend Callback):

```bash
curl -X POST http://localhost:8080/api/v1/payments/verify-callback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "paymentId": "674c9a8e...",
    "gatewayTransactionId": "tr_abc123"
  }'
```

---

## 🐛 Troubleshooting

### Subscription Not Created?

**Check Eligibility:**

```bash
# Get order details
GET /api/v1/orders/:orderId

# Verify:
# - isOneTime = false OR planType = "SUBSCRIPTION"
# - variantType = "SACHETS"
# - selectedPlanDays in [30, 60, 90, 180]
```

**Check Logs:**

```bash
# Payment logs
grep "Payment created" logs/combined.log | tail -20

# Webhook logs
grep "WEBHOOK" logs/combined.log | tail -20

# Subscription logs
grep "SUBSCRIPTION" logs/combined.log | tail -20

# Errors
grep "ERROR" logs/error.log | tail -20
```

**Check Payment Status:**

```bash
# Must be COMPLETED for subscription creation
GET /api/v1/payments/track?orderId=...
```

### Different Gateway URLs?

This is **expected** behavior:

- **Stripe** returns `clientSecret` for Stripe Elements
- **Mollie** returns `redirectUrl` for redirect flow
- Different gateways have different checkout flows

**Not a bug if:**

- URLs are from correct gateway (Stripe vs Mollie)
- Both APIs return same URL for same gateway
- Payment completes successfully

### Amount Mismatch?

**Check:**

1. If `amount` provided in request, it's used
2. If `amount` not provided, `order.grandTotal` is used
3. Verify order total includes all items, taxes, discounts

---

## 📚 Documentation Files

1. **PAYMENT_API_ALIGNMENT.md** - Complete technical documentation
2. **PAYMENT_API_CHANGES_SUMMARY.md** - What changed and why
3. **PAYMENT_API_TEST_COMMANDS.sh** - Interactive test suite
4. **PAYMENT_API_README.md** - This file (quick reference)

---

## 🔐 Environment Variables

Required:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mollie
MOLLIE_API_KEY=test_...

# App
APP_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
```

---

## 📊 API Comparison Table

| Feature             | `/create`        | `/intent` |
| ------------------- | ---------------- | --------- |
| Custom Amount       | ✅ Yes           | ❌ No     |
| Uses Order Amount   | ✅ Yes (default) | ✅ Yes    |
| Custom Description  | ✅ Yes           | ❌ No     |
| Custom Metadata     | ✅ Yes           | ❌ No     |
| Return URL          | ✅ Yes           | ✅ Yes    |
| Cancel URL          | ✅ Yes           | ✅ Yes    |
| Auto Subscription   | ✅ Yes           | ✅ Yes    |
| Response Format     | ✅ Same          | ✅ Same   |
| Gateway Integration | ✅ Same          | ✅ Same   |

---

## 💡 Best Practices

### Use `/create` when:

- You need to override order amount
- You need custom description
- You need to pass custom metadata

### Use `/intent` when:

- You want simple payment creation
- You always use order amount
- You don't need custom fields

### Both work for:

- ✅ Subscription orders
- ✅ One-time orders
- ✅ Stripe payments
- ✅ Mollie payments
- ✅ Auto subscription creation

---

## 🎓 Examples

### Example 1: Simple Payment

```typescript
const response = await fetch("/api/v1/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    orderId: order._id,
    paymentMethod: "MOLLIE",
    returnUrl: window.location.origin + "/payment/success",
    cancelUrl: window.location.origin + "/payment/cancel",
  }),
});

const { data } = await response.json();
// Redirect to gateway
window.location.href = data.gateway.redirectUrl;
```

### Example 2: Custom Amount Payment

```typescript
const response = await fetch("/api/v1/payments/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    orderId: order._id,
    paymentMethod: "STRIPE",
    amount: {
      value: 49.99,
      currency: "EUR",
    },
    description: "Partial payment",
    returnUrl: window.location.origin + "/payment/success",
  }),
});
```

### Example 3: Handle Payment Return

```typescript
// On return URL page
const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get("paymentId");

// Verify payment
const response = await fetch("/api/v1/payments/verify-callback", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    paymentId: paymentId,
  }),
});

const { data } = await response.json();
if (data.payment.status === "COMPLETED") {
  // Show success message
  // Check if subscription was created
  if (data.order.planType === "SUBSCRIPTION") {
    // Fetch subscription details
    const subResponse = await fetch("/api/v1/subscriptions/user/me");
    const subscriptions = await subResponse.json();
    // Show subscription details
  }
}
```

---

## 🆘 Support

**Need Help?**

- Check logs: `logs/combined.log` and `logs/error.log`
- Run test suite: `./docs/PAYMENT_API_TEST_COMMANDS.sh`
- Read full docs: `docs/PAYMENT_API_ALIGNMENT.md`

**Found a Bug?**

- Check if payment completed on gateway
- Check if webhook was received
- Check order eligibility for subscriptions
- Review error logs for details

---

## ✅ Checklist for Integration

- [ ] Update frontend to use new response format
- [ ] Add order details handling in UI
- [ ] Test with both Stripe and Mollie
- [ ] Test subscription order flow
- [ ] Verify webhook processing
- [ ] Test payment return handling
- [ ] Update TypeScript types if needed
- [ ] Test error scenarios
- [ ] Monitor logs for issues
- [ ] Update team documentation

---

**Last Updated:** December 27, 2025
**Version:** 2.0
**Status:** ✅ Production Ready
