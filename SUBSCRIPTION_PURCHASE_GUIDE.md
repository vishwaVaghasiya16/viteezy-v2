# Subscription Purchase API Guide

## Complete Flow for Purchasing a Subscription

### Step 1: Create Order with Subscription Plan Type

**Endpoint:** `POST /api/v1/orders`

**Request Body:**

```json
{
  "items": [
    {
      "productId": "665f9b9c9ab54b2a1d123456",
      "variantId": "665fa0123c98c2845b678901",
      "quantity": 2,
      "price": {
        "amount": 29.99,
        "currency": "EUR",
        "taxRate": 0.21
      },
      "name": "Vitamin C 1000mg",
      "sku": "VIT-C-1000"
    }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "phone": "+31612345678",
    "line1": "Main Street 123",
    "line2": "Apt 4B",
    "city": "Amsterdam",
    "state": "North Holland",
    "zip": "1012 AB",
    "country": "NL"
  },
  "billingAddress": {
    "name": "John Doe",
    "phone": "+31612345678",
    "line1": "Main Street 123",
    "line2": "Apt 4B",
    "city": "Amsterdam",
    "state": "North Holland",
    "zip": "1012 AB",
    "country": "NL"
  },
  "shippingAmount": {
    "amount": 5.99,
    "currency": "EUR",
    "taxRate": 0.21
  },
  "taxAmount": {
    "amount": 6.3,
    "currency": "EUR",
    "taxRate": 0.21
  },
  "plan": {
    "type": "Subscription",
    "interval": 60,
    "startDate": "2024-01-15T00:00:00.000Z",
    "metadata": {
      "cycleDays": 60,
      "autoRenew": true
    }
  },
  "paymentMethod": "Stripe",
  "couponCode": "SAVE10",
  "notes": "Please deliver in the morning"
}
```

**cURL Command:**

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "665f9b9c9ab54b2a1d123456",
        "quantity": 2,
        "price": {
          "amount": 29.99,
          "currency": "EUR",
          "taxRate": 0.21
        },
        "name": "Vitamin C 1000mg"
      }
    ],
    "shippingAddress": {
      "name": "John Doe",
      "phone": "+31612345678",
      "line1": "Main Street 123",
      "city": "Amsterdam",
      "zip": "1012 AB",
      "country": "NL"
    },
    "shippingAmount": {
      "amount": 5.99,
      "currency": "EUR",
      "taxRate": 0.21
    },
    "plan": {
      "type": "Subscription",
      "interval": 60,
      "startDate": "2024-01-15T00:00:00.000Z",
      "metadata": {
        "cycleDays": 60,
        "autoRenew": true
      }
    },
    "paymentMethod": "Stripe"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "665fa0123c98c2845b678901",
      "orderNumber": "VTZ-1705123456-1234",
      "planType": "Subscription",
      "totals": {
        "subtotal": { "amount": 59.98, "currency": "EUR", "taxRate": 0.21 },
        "shipping": { "amount": 5.99, "currency": "EUR", "taxRate": 0.21 },
        "tax": { "amount": 6.3, "currency": "EUR", "taxRate": 0.21 },
        "total": { "amount": 72.27, "currency": "EUR", "taxRate": 0.21 }
      },
      "metadata": {
        "planDetails": {
          "interval": 60,
          "startDate": "2024-01-15T00:00:00.000Z",
          "cycleDays": 60,
          "autoRenew": true
        }
      }
    }
  }
}
```

---

### Step 2: Create Payment Intent

**Endpoint:** `POST /api/v1/payments/intent`

**Request Body:**

```json
{
  "orderId": "665fa0123c98c2845b678901",
  "paymentMethod": "Stripe",
  "returnUrl": "https://yourapp.com/payment/return",
  "metadata": {
    "subscription": true,
    "cycleDays": 60
  }
}
```

**cURL Command:**

```bash
curl -X POST http://localhost:3000/api/v1/payments/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "orderId": "665fa0123c98c2845b678901",
    "paymentMethod": "Stripe",
    "returnUrl": "https://yourapp.com/payment/return?orderId=665fa0123c98c2845b678901"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "payment": {
      "id": "665fb1234c98c2845b678902",
      "status": "Pending",
      "paymentMethod": "Stripe",
      "gatewayTransactionId": "cs_test_...",
      "amount": {
        "amount": 72.27,
        "currency": "EUR",
        "taxRate": 0.21
      }
    },
    "result": {
      "redirectUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
      "clientSecret": "cs_test_..."
    }
  }
}
```

---

### Step 3: Redirect User to Payment Gateway

Use the `redirectUrl` from Step 2 to redirect the user to Stripe/Mollie checkout.

---

### Step 4: After Payment Success - Create Subscription

**Endpoint:** `POST /api/v1/subscriptions`

**Request Body:**

```json
{
  "orderId": "665fa0123c98c2845b678901",
  "cycleDays": 60,
  "items": [
    {
      "productId": "665f9b9c9ab54b2a1d123456",
      "variantId": "665fa0123c98c2845b678901",
      "quantity": 2,
      "price": {
        "amount": 29.99,
        "currency": "EUR",
        "taxRate": 0.21
      },
      "name": "Vitamin C 1000mg",
      "sku": "VIT-C-1000"
    }
  ],
  "amount": {
    "amount": 72.27,
    "currency": "EUR",
    "taxRate": 0.21
  },
  "paymentMethod": "Stripe",
  "gatewaySubscriptionId": "sub_1234567890",
  "gatewayCustomerId": "cus_1234567890",
  "initialDeliveryDate": "2024-01-15T00:00:00.000Z",
  "nextDeliveryDate": "2024-03-15T00:00:00.000Z",
  "nextBillingDate": "2024-03-15T00:00:00.000Z"
}
```

**cURL Command:**

```bash
curl -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "orderId": "665fa0123c98c2845b678901",
    "cycleDays": 60,
    "items": [
      {
        "productId": "665f9b9c9ab54b2a1d123456",
        "quantity": 2,
        "price": {
          "amount": 29.99,
          "currency": "EUR",
          "taxRate": 0.21
        },
        "name": "Vitamin C 1000mg"
      }
    ],
    "amount": {
      "amount": 72.27,
      "currency": "EUR",
      "taxRate": 0.21
    },
    "paymentMethod": "Stripe",
    "initialDeliveryDate": "2024-01-15T00:00:00.000Z",
    "nextDeliveryDate": "2024-03-15T00:00:00.000Z",
    "nextBillingDate": "2024-03-15T00:00:00.000Z"
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": {
      "id": "665fc2345c98c2845b678903",
      "subscriptionNumber": "SUB-1705123456-5678",
      "orderId": "665fa0123c98c2845b678901",
      "status": "Active",
      "cycleDays": 60,
      "amount": {
        "amount": 72.27,
        "currency": "EUR",
        "taxRate": 0.21
      },
      "initialDeliveryDate": "2024-01-15T00:00:00.000Z",
      "nextDeliveryDate": "2024-03-15T00:00:00.000Z",
      "nextBillingDate": "2024-03-15T00:00:00.000Z",
      "daysUntilNextDelivery": 60,
      "daysUntilNextBilling": 60,
      "cycleCount": 0
    }
  }
}
```

---

## Complete Example (All Steps Combined)

```bash
# Step 1: Create Order
ORDER_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "items": [{
      "productId": "665f9b9c9ab54b2a1d123456",
      "quantity": 2,
      "price": {"amount": 29.99, "currency": "EUR", "taxRate": 0.21},
      "name": "Vitamin C 1000mg"
    }],
    "shippingAddress": {
      "name": "John Doe",
      "phone": "+31612345678",
      "line1": "Main Street 123",
      "city": "Amsterdam",
      "zip": "1012 AB",
      "country": "NL"
    },
    "shippingAmount": {"amount": 5.99, "currency": "EUR", "taxRate": 0.21},
    "plan": {
      "type": "Subscription",
      "interval": 60,
      "startDate": "2024-01-15T00:00:00.000Z",
      "metadata": {"cycleDays": 60, "autoRenew": true}
    },
    "paymentMethod": "Stripe"
  }')

# Extract order ID from response
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.data.order.id')

# Step 2: Create Payment Intent
PAYMENT_RESPONSE=$(curl -X POST http://localhost:3000/api/v1/payments/intent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"paymentMethod\": \"Stripe\",
    \"returnUrl\": \"https://yourapp.com/payment/return?orderId=$ORDER_ID\"
  }")

# Extract redirect URL
REDIRECT_URL=$(echo $PAYMENT_RESPONSE | jq -r '.data.result.redirectUrl')

echo "Redirect user to: $REDIRECT_URL"

# After payment success (Step 3), create subscription
# This is typically done automatically via webhook, but can be done manually:

curl -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d "{
    \"orderId\": \"$ORDER_ID\",
    \"cycleDays\": 60,
    \"items\": [{
      \"productId\": \"665f9b9c9ab54b2a1d123456\",
      \"quantity\": 2,
      \"price\": {\"amount\": 29.99, \"currency\": \"EUR\", \"taxRate\": 0.21},
      \"name\": \"Vitamin C 1000mg\"
    }],
    \"amount\": {\"amount\": 72.27, \"currency\": \"EUR\", \"taxRate\": 0.21},
    \"paymentMethod\": \"Stripe\",
    \"initialDeliveryDate\": \"2024-01-15T00:00:00.000Z\",
    \"nextDeliveryDate\": \"2024-03-15T00:00:00.000Z\",
    \"nextBillingDate\": \"2024-03-15T00:00:00.000Z\"
  }"
```

---

## Important Notes

1. **Cycle Days**: Only `60`, `90`, or `180` days are allowed for subscriptions
2. **Order Plan Type**: Must be set to `"Subscription"` in the order creation
3. **Payment Gateway**: Supports both `Stripe` and `Mollie`
4. **Webhook Handling**: After successful payment, the subscription is typically created automatically via webhook
5. **Dates**: Calculate `nextDeliveryDate` and `nextBillingDate` based on `cycleDays` from `initialDeliveryDate`

---

## Alternative: Using Pre-Checkout Validation

Before creating the order, you can validate the checkout data:

```bash
curl -X POST http://localhost:3000/api/v1/pre-checkout/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "items": [{
      "productId": "665f9b9c9ab54b2a1d123456",
      "quantity": 2,
      "price": {"amount": 29.99, "currency": "EUR"}
    }],
    "shippingAddressId": "665fa0123c98c2845b678901"
  }'
```
