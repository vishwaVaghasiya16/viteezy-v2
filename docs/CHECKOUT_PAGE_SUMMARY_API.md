# Checkout Page Summary API Documentation

## Overview

The Checkout Page Summary API provides comprehensive pricing details for the checkout page, including tax calculations, coupon discounts, plan discounts (15% for 90-day plans), and membership discounts. The API has been updated from GET to POST method to support coupon code validation in the request body.

## API Endpoint

**Method:** `POST`  
**Path:** `/api/v1/checkout/page-summary`  
**Authentication:** Required (Bearer Token)

---

## Request

### Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body

```json
{
  "variantType": "SACHETS",
  "planDurationDays": 90,
  "capsuleCount": 60,
  "couponCode": "SAVE15"
}
```

### Body Parameters

| Parameter          | Type   | Required    | Description                                                                                                                |
| ------------------ | ------ | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `variantType`      | string | No          | Product variant type. Values: `SACHETS` or `STAND_UP_POUCH`. Default: `SACHETS`                                            |
| `planDurationDays` | number | Conditional | Plan duration in days. Values: `30`, `60`, `90`, `180`. Required for SACHETS, forbidden for STAND_UP_POUCH. Default: `180` |
| `capsuleCount`     | number | Conditional | Capsule count. Values: `30`, `60`. Required for STAND_UP_POUCH, forbidden for SACHETS                                      |
| `couponCode`       | string | No          | Coupon code to apply (optional, 3-50 characters)                                                                           |

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "productId": "60d5ec49f1b2c8b1f8e4e1a1",
          "title": "Vitamin D3 Supplement",
          "image": "https://example.com/image.jpg",
          "variant": "SACHETS",
          "quantity": 2,
          "basePlanPrice": {
            "currency": "EUR",
            "amount": 89.99,
            "discountedPrice": 76.49,
            "planType": "90 Day Plan"
          },
          "membershipDiscount": 7.65
        }
      ]
    },
    "subscriptionPlans": [
      {
        "planKey": "thirtyDays",
        "label": "30 Day Plan",
        "durationDays": 30,
        "capsuleCount": 60,
        "totalAmount": 99.99,
        "discountedPrice": 99.99,
        "savePercentage": 0,
        "supplementsCount": 60,
        "perMonthAmount": 99.99,
        "perDeliveryAmount": 99.99,
        "features": ["Free shipping", "Cancel anytime"],
        "isRecommended": false,
        "isSelected": false
      },
      {
        "planKey": "ninetyDays",
        "label": "90 Day Plan",
        "durationDays": 90,
        "capsuleCount": 180,
        "totalAmount": 269.97,
        "discountedPrice": 229.47,
        "savePercentage": 15,
        "supplementsCount": 180,
        "perMonthAmount": 76.49,
        "perDeliveryAmount": 229.47,
        "features": ["15% discount", "Free shipping", "Priority support"],
        "isRecommended": true,
        "isSelected": true
      }
    ],
    "pricing": {
      "subtotal": 269.97,
      "planDiscount": 40.5,
      "planDiscountPercentage": 15,
      "membershipDiscountTotal": 7.65,
      "couponDiscountAmount": 10.0,
      "taxAmount": 35.48,
      "taxRate": 0.21,
      "totalAmount": 269.97,
      "totalDiscountedPrice": 229.47,
      "totalDiscountAmount": 58.15,
      "savePercentage": 15,
      "grandTotal": 246.8,
      "currency": "EUR"
    },
    "coupon": {
      "code": "SAVE15",
      "isValid": true,
      "discountAmount": 10.0,
      "message": "Coupon applied successfully"
    },
    "suggestedProducts": [
      {
        "productId": "60d5ec49f1b2c8b1f8e4e1a2",
        "title": "Omega-3 Fish Oil",
        "image": "https://example.com/omega3.jpg",
        "price": 29.99,
        "variant": "SACHETS"
      }
    ]
  }
}
```

### Response Fields Explanation

#### Cart Items

- `productId`: Product unique identifier
- `title`: Product name
- `image`: Product image URL
- `variant`: Product variant (SACHETS or STAND_UP_POUCH)
- `quantity`: Quantity in cart
- `basePlanPrice`: Selected plan pricing details
  - `currency`: Currency code (EUR)
  - `amount`: Original price before discounts
  - `discountedPrice`: Price after plan discount
  - `planType`: Selected plan type description
- `membershipDiscount`: Membership discount amount for this product

#### Subscription Plans

- `planKey`: Plan identifier (thirtyDays, sixtyDays, ninetyDays, oneEightyDays)
- `label`: Display label for the plan
- `durationDays`: Plan duration in days
- `capsuleCount`: Total capsules in the plan
- `totalAmount`: Total amount before discounts
- `discountedPrice`: Price after plan discount
- `savePercentage`: Percentage saved
- `supplementsCount`: Number of supplements
- `perMonthAmount`: Average cost per month
- `perDeliveryAmount`: Amount to pay per delivery cycle
- `features`: Plan features array
- `isRecommended`: Whether this plan is recommended (90-day plan)
- `isSelected`: Whether this plan is currently selected

#### Pricing Breakdown

- `subtotal`: Original total before any discounts
- `planDiscount`: Discount amount from selected plan
- `planDiscountPercentage`: Plan discount percentage (15% for 90-day plan)
- `membershipDiscountTotal`: Total membership discount across all products
- `couponDiscountAmount`: Discount from applied coupon
- `taxAmount`: Tax amount (21% VAT)
- `taxRate`: Tax rate (0.21 = 21%)
- `totalAmount`: Original total amount
- `totalDiscountedPrice`: Total after plan discounts
- `totalDiscountAmount`: Sum of all discounts (plan + membership + coupon)
- `savePercentage`: Overall savings percentage
- `grandTotal`: Final amount to pay (after all discounts + tax)
- `currency`: Currency code

#### Coupon (if provided)

- `code`: Coupon code (uppercase)
- `isValid`: Whether the coupon is valid
- `discountAmount`: Discount amount from coupon
- `message`: Success or error message

#### Suggested Products

- `productId`: Product ID
- `title`: Product title
- `image`: Product image URL
- `price`: Product price
- `variant`: Product variant

---

## Error Responses

### 400 Bad Request - Empty Cart

```json
{
  "success": false,
  "message": "Cart is empty"
}
```

### 400 Bad Request - Invalid Coupon

```json
{
  "success": true,
  "data": {
    "cart": { ... },
    "subscriptionPlans": [ ... ],
    "pricing": {
      ...
      "couponDiscountAmount": 0,
      ...
    },
    "coupon": {
      "code": "INVALID",
      "isValid": false,
      "discountAmount": 0,
      "message": "Invalid coupon code"
    }
  }
}
```

### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "planDurationDays",
      "message": "Plan duration must be 30, 60, 90, or 180 days"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "User authentication required"
}
```

### 404 Not Found - No Products

```json
{
  "success": false,
  "message": "No valid products found in cart"
}
```

---

## CURL Examples

### Basic Request (SACHETS, 90-day plan)

```bash
curl -X POST https://api.example.com/api/v1/checkout/page-summary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantType": "SACHETS",
    "planDurationDays": 90
  }'
```

### With Coupon Code

```bash
curl -X POST https://api.example.com/api/v1/checkout/page-summary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantType": "SACHETS",
    "planDurationDays": 90,
    "couponCode": "SAVE15"
  }'
```

### Stand-up Pouch Variant

```bash
curl -X POST https://api.example.com/api/v1/checkout/page-summary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantType": "STAND_UP_POUCH",
    "capsuleCount": 60,
    "couponCode": "WELCOME10"
  }'
```

### 30-day Plan

```bash
curl -X POST https://api.example.com/api/v1/checkout/page-summary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variantType": "SACHETS",
    "planDurationDays": 30
  }'
```

---

## Pricing Calculation Flow

### 1. Subtotal Calculation

```
Subtotal = Sum of (Product Base Price × Quantity) for all cart items
```

### 2. Plan Discount

```
For 90-day plan: 15% automatic discount
Plan Discount = Subtotal × 0.15
Discounted Price = Subtotal - Plan Discount
```

### 3. Membership Discount

```
If user is a member:
  Membership Discount = Calculated per product based on membership tier
  Subtotal After Membership = Discounted Price - Membership Discount
```

### 4. Coupon Discount

```
If valid coupon provided:
  Coupon Discount = Calculated based on coupon type (percentage/fixed)
  Subtotal After Coupon = Subtotal After Membership - Coupon Discount
```

### 5. Tax Calculation

```
Tax Rate = 21% (VAT for Netherlands/EU)
Tax Amount = Subtotal After Coupon × 0.21
```

### 6. Grand Total

```
Grand Total = Subtotal After Coupon + Tax Amount
```

### Example Calculation:

```
Subtotal:                €269.97
Plan Discount (15%):     -€40.50
Membership Discount:     -€7.65
Coupon Discount:         -€10.00
─────────────────────────────────
Subtotal After Discounts: €211.82
Tax (21%):               +€44.48
─────────────────────────────────
Grand Total:             €256.30
```

---

## Discount Types

### 1. Plan Discount (Automatic)

- **30-day plan**: 0% discount
- **60-day plan**: 0% discount
- **90-day plan**: **15% automatic discount** ✨
- **180-day plan**: 0% discount

### 2. Membership Discount

- Applied based on user's membership tier
- Calculated per product
- Varies by product and membership level

### 3. Coupon Discount

- Applied after plan and membership discounts
- Types:
  - **Percentage**: X% off the order
  - **Fixed Amount**: €X off the order
  - **Free Shipping**: Shipping cost waived

---

## Coupon Validation

### Validation Checks

1. ✅ Coupon exists and is active
2. ✅ Coupon is within valid date range
3. ✅ Usage limit not exceeded (global)
4. ✅ User usage limit not exceeded
5. ✅ Minimum order amount met
6. ✅ Applicable to selected products/categories
7. ✅ Not excluded products

### Coupon Error Messages

- `"Invalid coupon code"` - Coupon doesn't exist
- `"This coupon is not active"` - Coupon is deactivated
- `"This coupon is not yet valid"` - Coupon start date not reached
- `"This coupon has expired"` - Coupon end date passed
- `"This coupon has reached its usage limit"` - Global limit reached
- `"You have reached the maximum usage limit for this coupon"` - User limit reached
- `"Minimum order amount of €X is required for this coupon"` - Order too small
- `"This coupon is not applicable to the selected products"` - Product restriction
- `"This coupon is not applicable to the selected categories"` - Category restriction

---

## Tax Information

### VAT (Value Added Tax)

- **Rate**: 21%
- **Region**: Netherlands / European Union
- **Applied To**: Subtotal after all discounts
- **Included In**: Grand Total

### Tax Calculation

```javascript
taxAmount = subtotalAfterDiscounts * 0.21;
grandTotal = subtotalAfterDiscounts + taxAmount;
```

---

## Plan Features

### 30-Day Plan

- ✅ Cancel anytime
- ✅ Free shipping
- ⚠️ No discount

### 60-Day Plan

- ✅ Cancel anytime
- ✅ Free shipping
- ⚠️ No discount

### 90-Day Plan (Recommended) ⭐

- ✅ **15% automatic discount**
- ✅ Cancel anytime
- ✅ Free shipping
- ✅ Priority support
- ✅ Best value

### 180-Day Plan

- ✅ Cancel anytime
- ✅ Free shipping
- ✅ Priority support
- ⚠️ No automatic discount

---

## Integration Guide

### Frontend Integration

```typescript
// API call example
async function getCheckoutSummary(
  planDurationDays: number,
  couponCode?: string
) {
  const response = await fetch("/api/v1/checkout/page-summary", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variantType: "SACHETS",
      planDurationDays,
      couponCode,
    }),
  });

  return await response.json();
}

// Display pricing
function displayPricing(data) {
  console.log(`Subtotal: €${data.pricing.subtotal}`);
  console.log(
    `Plan Discount (${data.pricing.planDiscountPercentage}%): -€${data.pricing.planDiscount}`
  );
  console.log(`Membership Discount: -€${data.pricing.membershipDiscountTotal}`);
  console.log(`Coupon Discount: -€${data.pricing.couponDiscountAmount}`);
  console.log(`Tax (21%): +€${data.pricing.taxAmount}`);
  console.log(`─────────────────────────`);
  console.log(`Grand Total: €${data.pricing.grandTotal}`);
}
```

---

## Testing

### Test Scenarios

1. **Basic Checkout (90-day plan)**

   - Expected: 15% plan discount applied
   - Verify: `planDiscountPercentage === 15`

2. **With Valid Coupon**

   - Expected: Coupon discount applied
   - Verify: `coupon.isValid === true`

3. **With Invalid Coupon**

   - Expected: Coupon marked as invalid, no discount
   - Verify: `coupon.isValid === false`

4. **Membership Discount**

   - Expected: Additional membership discount
   - Verify: `membershipDiscountTotal > 0`

5. **Tax Calculation**
   - Expected: 21% tax on subtotal after discounts
   - Verify: `taxAmount === subtotalAfterDiscounts * 0.21`

---

## Migration from GET to POST

### Old API (Deprecated)

```bash
GET /api/v1/checkout/page-summary?planDurationDays=90&variantType=SACHETS
```

### New API (Current)

```bash
POST /api/v1/checkout/page-summary
Body: { "planDurationDays": 90, "variantType": "SACHETS" }
```

### Migration Steps

1. Change HTTP method from GET to POST
2. Move query parameters to request body
3. Add coupon code support in body
4. Update response handling for new pricing fields

---

## Changelog

### Version 2.0 (Current)

- ✅ Changed from GET to POST method
- ✅ Moved parameters from query to body
- ✅ Added coupon code support
- ✅ Added comprehensive pricing breakdown
- ✅ Added tax calculation (21% VAT)
- ✅ Added plan discount details (15% for 90-day)
- ✅ Added coupon verification
- ✅ Enhanced error handling

### Version 1.0 (Deprecated)

- GET method with query parameters
- Basic pricing without detailed breakdown
- No coupon support

---

## Support

For questions or issues:

- Check error messages in response
- Verify authentication token is valid
- Ensure cart is not empty
- Validate request body parameters

---

**Last Updated:** December 25, 2025  
**API Version:** 2.0  
**Status:** Production Ready ✅
