# Create Order API - Testing Guide

## API Endpoint

```
POST /api/orders
```

## Authentication

This endpoint requires authentication. Include the Bearer token in the Authorization header.

---

## cURL Command (Basic Example)

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -d '{
    "items": [
      {
        "productId": "64f0b1c2d3e4f5a601000001",
        "variantId": "64f0b1c2d3e4f5a601000002",
        "quantity": 2,
        "price": {
          "currency": "EUR",
          "amount": 29.99,
          "taxRate": 0.21
        },
        "name": "Vitamin D3 1000IU",
        "sku": "VIT-D3-1000"
      }
    ],
    "shippingAddress": {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+31612345678",
      "line1": "Main Street 123",
      "line2": "Apartment 4B",
      "city": "Amsterdam",
      "state": "North Holland",
      "zip": "1012 AB",
      "country": "Netherlands"
    },
    "billingAddress": {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+31612345678",
      "line1": "Main Street 123",
      "line2": "Apartment 4B",
      "city": "Amsterdam",
      "state": "North Holland",
      "zip": "1012 AB",
      "country": "Netherlands"
    },
    "shippingAmount": {
      "currency": "EUR",
      "amount": 5.99,
      "taxRate": 0.21
    },
    "taxAmount": {
      "currency": "EUR",
      "amount": 12.60,
      "taxRate": 0.21
    },
    "couponCode": "WELCOME10",
    "paymentMethod": "Stripe",
    "notes": "Please deliver before 5 PM"
  }'
```

---

## cURL Command (With Membership Discount)

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -d '{
    "items": [
      {
        "productId": "64f0b1c2d3e4f5a601000001",
        "quantity": 1,
        "price": {
          "currency": "EUR",
          "amount": 49.99,
          "taxRate": 0.21
        },
        "name": "Premium Vitamin Pack"
      }
    ],
    "shippingAddress": {
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "phone": "+31698765432",
      "line1": "Park Avenue 456",
      "city": "Rotterdam",
      "state": "South Holland",
      "zip": "3011 AA",
      "country": "Netherlands"
    },
    "shippingAmount": {
      "currency": "EUR",
      "amount": 0,
      "taxRate": 0
    },
    "taxAmount": {
      "currency": "EUR",
      "amount": 10.50,
      "taxRate": 0.21
    },
    "membership": {
      "isMember": true,
      "membershipId": "64f0a1b2c3d4e5f601000001",
      "level": "Gold",
      "label": "Gold Member",
      "discountType": "Percentage",
      "discountValue": 15,
      "metadata": {
        "tier": "premium"
      }
    },
    "plan": {
      "type": "One-Time",
      "metadata": {
        "source": "web"
      }
    },
    "paymentMethod": "Mollie"
  }'
```

---

## cURL Command (Subscription Plan)

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN_HERE" \
  -d '{
    "items": [
      {
        "productId": "64f0b1c2d3e4f5a601000003",
        "quantity": 1,
        "price": {
          "currency": "EUR",
          "amount": 39.99,
          "taxRate": 0.21
        },
        "name": "Monthly Vitamin Subscription"
      }
    ],
    "shippingAddress": {
      "name": "Bob Johnson",
      "email": "bob.johnson@example.com",
      "phone": "+31611111111",
      "line1": "Oak Street 789",
      "city": "Utrecht",
      "state": "Utrecht",
      "zip": "3511 AA",
      "country": "Netherlands"
    },
    "shippingAmount": {
      "currency": "EUR",
      "amount": 0,
      "taxRate": 0
    },
    "taxAmount": {
      "currency": "EUR",
      "amount": 8.40,
      "taxRate": 0.21
    },
    "couponCode": "SAVE20",
    "plan": {
      "type": "Subscription",
      "interval": "monthly",
      "startDate": "2025-02-01T00:00:00.000Z",
      "trialDays": 7,
      "metadata": {
        "billingCycle": "monthly",
        "autoRenew": true
      }
    },
    "paymentMethod": "Stripe",
    "metadata": {
      "campaign": "winter-sale",
      "referral": "friend123"
    }
  }'
```

---

## Postman Setup Instructions

### 1. Create New Request

- Method: `POST`
- URL: `http://localhost:8080/api/orders` (or your server URL)

### 2. Headers

Add these headers:

- `Content-Type: application/json`
- `Authorization: Bearer YOUR_AUTH_TOKEN_HERE`

### 3. Body (raw JSON)

Use any of the JSON examples above in the Body tab (select "raw" and "JSON").

### 4. Required Fields

- `items` (array, at least 1 item)
  - `productId` (required, MongoDB ObjectId)
  - `quantity` (required, min: 1)
  - `price` (required object with currency, amount, taxRate)
- `shippingAddress` (required object with name, line1, city, state, zip, country)

### 5. Optional Fields

- `billingAddress` (if not provided, uses shippingAddress)
- `shippingAmount` (defaults to EUR 0)
- `taxAmount` (defaults to EUR 0)
- `couponCode` (uppercase string)
- `membership` (object with isMember, discountType, discountValue)
- `plan` (object with type: "One-Time" or "Subscription")
- `paymentMethod` ("Stripe", "Mollie", "Paypal", "Bank Transfer")
- `notes` (max 1000 characters)
- `metadata` (any object)

---

## Expected Success Response (200/201)

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "65f1a1b2c3d4e5f601000001",
      "orderNumber": "VTZ-1704067200000-1234",
      "status": "Pending",
      "planType": "One-Time",
      "items": [...],
      "pricing": {
        "subtotal": {
          "currency": "EUR",
          "amount": 29.99,
          "taxRate": 0.21
        },
        "tax": {
          "currency": "EUR",
          "amount": 6.30,
          "taxRate": 0.21
        },
        "shipping": {
          "currency": "EUR",
          "amount": 5.99,
          "taxRate": 0.21
        },
        "discount": {
          "currency": "EUR",
          "amount": 0,
          "taxRate": 0
        },
        "couponDiscount": {
          "currency": "EUR",
          "amount": 3.00,
          "taxRate": 0
        },
        "membershipDiscount": {
          "currency": "EUR",
          "amount": 0,
          "taxRate": 0
        },
        "total": {
          "currency": "EUR",
          "amount": 39.28,
          "taxRate": 0.21
        }
      },
      "shippingAddress": {...},
      "billingAddress": {...},
      "paymentMethod": "Stripe",
      "paymentStatus": "Pending",
      "couponCode": "WELCOME10",
      "metadata": {...},
      "createdAt": "2025-01-01T12:00:00.000Z"
    }
  }
}
```

---

## Common Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "message": "User not authenticated",
  "error": "User not authenticated"
}
```

### 400 Bad Request (Validation Error)

```json
{
  "success": false,
  "message": "Validation error",
  "error": "Items must contain at least 1 item",
  "errorType": "ValidationError"
}
```

### 404 Not Found (Invalid Product)

```json
{
  "success": false,
  "message": "One or more products are unavailable",
  "error": "One or more products are unavailable"
}
```

---

## Notes

1. **Replace `YOUR_AUTH_TOKEN_HERE`** with your actual JWT token from login/register
2. **Replace ObjectIds** (`64f0b1c2d3e4f5a601000001`) with actual product IDs from your database
3. **Base URL** - Update `http://localhost:8080` to your actual server URL
4. **Currency** - Currently defaults to "EUR", but can be changed
5. **Coupon Code** - Must be uppercase and valid in your database
6. **Membership** - Only required if `isMember: true`

---

## Quick Test (Minimal Required Fields)

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "productId": "64f0b1c2d3e4f5a601000001",
        "quantity": 1,
        "price": {
          "currency": "EUR",
          "amount": 19.99,
          "taxRate": 0.21
        }
      }
    ],
    "shippingAddress": {
      "name": "Test User",
      "line1": "Test Street 1",
      "city": "Amsterdam",
      "state": "North Holland",
      "zip": "1012 AB",
      "country": "Netherlands"
    }
  }'
```
