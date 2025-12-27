`# Payment API Alignment Documentation

## Overview

This document explains the alignment between `/api/v1/payments/create` and `/api/v1/payments/intent` APIs to ensure consistent functionality and behavior.

## Changes Made (Dec 27, 2025)

### 1. Aligned `createPayment` with `createPaymentIntent`

Both APIs now provide the same comprehensive functionality:

- ✅ Full order details with populated addresses
- ✅ Line items for gateway checkout
- ✅ Customer information (email, name)
- ✅ Shipping and billing addresses
- ✅ Automatic webhook URL configuration
- ✅ Order validation and payment status checks
- ✅ Consistent response format
- ✅ Auto subscription creation via webhook flow

### 2. Key Improvements

#### Before:

- `createPayment` was basic with minimal data
- Different response formats
- Missing order details in response
- Amount was required in request

#### After:

- Both APIs now use order-based payment creation
- Consistent response format with order details
- Amount is optional (uses order.grandTotal if not provided)
- Both support `cancelUrl` parameter
- Both return the same gateway information

## API Comparison

### POST /api/v1/payments/create

**Purpose:** Create payment intent for an order (now aligned with intent API)

**Request Body:**

```json
{
  "orderId": "string (required)",
  "paymentMethod": "STRIPE | MOLLIE (required)",
  "amount": {
    "value": "number (optional - uses order amount if not provided)",
    "currency": "string (optional - uses order currency if not provided)"
  },
  "description": "string (optional)",
  "metadata": "object (optional)",
  "returnUrl": "string (optional)",
  "cancelUrl": "string (optional)",
  "webhookUrl": "string (optional - auto-configured if not provided)"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment created successfully",
  "data": {
    "payment": {
      "_id": "string",
      "orderId": "string",
      "status": "PENDING | COMPLETED | FAILED",
      "amount": {
        "amount": "number",
        "currency": "string",
        "taxRate": "number"
      },
      "paymentMethod": "STRIPE | MOLLIE",
      "gatewayTransactionId": "string"
    },
    "order": {
      "_id": "string",
      "orderNumber": "string",
      "status": "PENDING | CONFIRMED",
      "paymentStatus": "PENDING | COMPLETED",
      "total": {
        "amount": "number",
        "currency": "string"
      }
    },
    "gateway": {
      "redirectUrl": "string",
      "clientSecret": "string",
      "gatewayTransactionId": "string",
      "sessionId": "string"
    }
  }
}
```

### POST /api/v1/payments/intent

**Purpose:** Create payment intent for an order (product checkout)

**Request Body:**

```json
{
  "orderId": "string (required)",
  "paymentMethod": "STRIPE | MOLLIE (required)",
  "returnUrl": "string (optional)",
  "cancelUrl": "string (optional)"
}
```

**Response:** Same as `/create` API

## Subscription Auto-Creation Flow

Both APIs now support automatic subscription creation when payment is completed:

### Flow:

1. **Create Payment** → Payment record created with `PENDING` status
2. **User Redirected** → User completes payment on gateway
3. **Webhook Received** → Gateway sends webhook notification
4. **Payment Updated** → Payment status updated to `COMPLETED`
5. **Order Updated** → Order status updated to `CONFIRMED`
6. **Subscription Created** → If order is eligible, subscription is auto-created

### Subscription Eligibility Criteria:

- ✅ Order must be subscription type (`isOneTime = false` OR `planType = SUBSCRIPTION`)
- ✅ Order must be for SACHETS variant (`variantType = SACHETS`)
- ✅ Order must have valid plan days (`selectedPlanDays` = 30, 60, 90, or 180)
- ✅ No duplicate subscription exists for the order

### Subscription Creation Logic:

Both APIs use the same `createSubscriptionFromOrder` function which:

- Validates order eligibility
- Checks for duplicate subscriptions
- Calculates subscription dates based on plan days
- Maps order items to subscription items
- Creates subscription with `ACTIVE` status
- Tracks creation metadata

## Usage Examples

### Example 1: Create Payment (Recommended)

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

### Example 2: Create Payment Intent (Same Result)

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

### Example 3: Override Order Amount (Only in /create)

```bash
curl -X POST http://localhost:8080/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "orderId": "674c9a8e1234567890abcdef",
    "paymentMethod": "STRIPE",
    "amount": {
      "value": 99.99,
      "currency": "EUR"
    },
    "returnUrl": "https://yourapp.com/payment/return"
  }'
```

## Payment Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Payment Creation Flow                        │
└─────────────────────────────────────────────────────────────────┘

1. Client Request
   │
   ├─► POST /api/v1/payments/create
   │   OR
   └─► POST /api/v1/payments/intent
       │
       ▼
2. Backend Processing
   ├─► Validate order and user
   ├─► Check existing payments
   ├─► Build payment intent data
   │   ├─► Order details
   │   ├─► Line items
   │   ├─► Customer info
   │   └─► Addresses
   ├─► Create payment via gateway
   ├─► Save payment to database
   └─► Update order with payment info
       │
       ▼
3. Response to Client
   ├─► Payment details
   ├─► Order details
   └─► Gateway redirect URL
       │
       ▼
4. User Redirected to Gateway
   │
   ▼
5. Webhook Received (Payment Completed)
   ├─► Update payment status
   ├─► Update order status
   ├─► Send confirmation email
   └─► Auto-create subscription (if eligible)
       │
       ▼
6. User Redirected Back
   └─► Success/Failure page
```

## Webhook Flow for Subscription Creation

```
┌─────────────────────────────────────────────────────────────────┐
│              Webhook → Subscription Creation Flow                │
└─────────────────────────────────────────────────────────────────┘

1. Gateway Webhook
   │
   ▼
2. processWebhook()
   ├─► Verify webhook signature
   ├─► Find payment by transaction ID
   ├─► Update payment status to COMPLETED
   │
   ▼
3. Order Update
   ├─► Update order.paymentStatus = COMPLETED
   ├─► Update order.status = CONFIRMED
   ├─► Track coupon usage (if applicable)
   └─► Send order confirmation email
   │
   ▼
4. Subscription Check
   ├─► Check if order is subscription type
   ├─► Check if variant is SACHETS
   ├─► Check if plan days are valid
   └─► Check for duplicate subscription
   │
   ▼
5. createSubscriptionFromOrder()
   ├─► Calculate subscription dates
   │   ├─► subscriptionStartDate = now
   │   ├─► subscriptionEndDate = now + cycleDays
   │   ├─► nextBillingDate = now + cycleDays
   │   └─► nextDeliveryDate = now + cycleDays
   ├─► Map order items to subscription items
   ├─► Create subscription with ACTIVE status
   └─► Log success
```

## Testing

### Test Subscription Auto-Creation

1. **Create a subscription order:**

```bash
# Create order with subscription settings
POST /api/v1/orders
{
  "items": [...],
  "isOneTime": false,
  "planType": "SUBSCRIPTION",
  "variantType": "SACHETS",
  "selectedPlanDays": 30
}
```

2. **Create payment:**

```bash
# Use either API
POST /api/v1/payments/create
# OR
POST /api/v1/payments/intent
```

3. **Complete payment on gateway**

4. **Check webhook logs:**

```bash
# Look for subscription creation logs
grep "SUBSCRIPTION" logs/combined.log
```

5. **Verify subscription created:**

```bash
GET /api/v1/subscriptions/user/me
```

## Migration Notes

### For Existing Integrations:

1. **If using `/create` API:**

   - ✅ No breaking changes
   - ✅ `amount` is now optional
   - ✅ Response now includes `order` object
   - ✅ Add `cancelUrl` if needed

2. **If using `/intent` API:**

   - ✅ No changes needed
   - ✅ Already aligned

3. **Both APIs now:**
   - ✅ Support auto subscription creation
   - ✅ Return consistent response format
   - ✅ Include order details in response
   - ✅ Support cancelUrl parameter

## Troubleshooting

### Subscription Not Created?

Check these conditions:

1. Order `isOneTime` must be `false` OR `planType` must be `SUBSCRIPTION`
2. Order `variantType` must be `SACHETS`
3. Order `selectedPlanDays` must be 30, 60, 90, or 180
4. No existing subscription for the order
5. Payment must be `COMPLETED`
6. Check webhook logs for errors

### Different Gateway URLs?

Both APIs now use the same gateway integration:

- Same line items format
- Same address format
- Same customer information
- Same webhook configuration

If you see different URLs, check:

1. Payment method (STRIPE vs MOLLIE)
2. Order country (affects available methods)
3. Gateway configuration in environment variables

## Environment Variables

Required for both APIs:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mollie
MOLLIE_API_KEY=test_...

# App
APP_BASE_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000

# Development/Testing (Optional)
# Set to 'true' to auto-create subscriptions immediately on payment creation
# WARNING: Only use in development - not recommended for production
NODE_ENV=development
AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=false
```

### Development Mode for Subscription Testing

For testing subscription creation without completing payments:

```env
NODE_ENV=development
AUTO_CREATE_SUBSCRIPTION_ON_PAYMENT=true
```

This will create subscriptions immediately when payment is created (before payment completion).

**⚠️ Important:**

- Only use in development/testing
- In production, always set to `false` or remove
- Subscriptions should be created via webhook after payment completion

See: [SUBSCRIPTION_AUTO_CREATION_DEV_MODE.md](./SUBSCRIPTION_AUTO_CREATION_DEV_MODE.md) for details.

## Support

For issues or questions:

1. Check logs: `logs/combined.log`
2. Check webhook logs: Look for `[WEBHOOK]` and `[SUBSCRIPTION]` tags
3. Verify order eligibility criteria
4. Test with Stripe/Mollie test mode first

## Changelog

### 2025-12-27

- ✅ Aligned `createPayment` with `createPaymentIntent`
- ✅ Made `amount` optional in create payment API
- ✅ Added `cancelUrl` support to create payment API
- ✅ Unified response format for both APIs
- ✅ Both APIs now use order-based payment creation
- ✅ Both APIs support auto subscription creation via webhook
- ✅ Updated validation schema for consistency
