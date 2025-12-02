# Admin Coupon API - cURL Commands

Base URL: `http://localhost:8080/api/v1`

**Note:** Replace `YOUR_AUTH_TOKEN` with your actual JWT token obtained from login.

---

## Coupons API

### 1. Create New Coupon

```bash
curl -X POST http://localhost:8080/api/v1/admin/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "code": "SAVE20",
    "name": {
      "en": "20% Off",
      "nl": "20% Korting"
    },
    "description": {
      "en": "Get 20% off on your purchase",
      "nl": "Krijg 20% korting op uw aankoop"
    },
    "type": "Percentage",
    "value": 20,
    "minOrderAmount": 50,
    "maxDiscountAmount": 100,
    "usageLimit": 1000,
    "userUsageLimit": 1,
    "validFrom": "2024-12-01T00:00:00.000Z",
    "validUntil": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "isRecurring": false,
    "oneTimeUse": true
  }'
```

**Example with Fixed Discount:**

```bash
curl -X POST http://localhost:8080/api/v1/admin/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "code": "FLAT50",
    "name": {
      "en": "Flat 50 Off",
      "nl": "Plat 50 Korting"
    },
    "type": "Fixed",
    "value": 50,
    "minOrderAmount": 100,
    "usageLimit": 500,
    "userUsageLimit": 1,
    "validUntil": "2024-12-31T23:59:59.000Z",
    "isActive": true,
    "oneTimeUse": false
  }'
```

### 2. Get All Coupons (Paginated)

```bash
# Basic request
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Filter by status
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10&status=active" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Filter by type
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10&type=Percentage" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Search by code or name
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10&search=SAVE20" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Combined filters
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10&status=active&type=Percentage&search=SAVE" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 3. Get Coupon by ID

```bash
curl -X GET http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### 4. Update Coupon

```bash
curl -X PUT http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "value": 25,
    "minOrderAmount": 75,
    "usageLimit": 1500,
    "validUntil": "2025-01-31T23:59:59.000Z",
    "isRecurring": true
  }'
```

**Update Multiple Fields:**

```bash
curl -X PUT http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "code": "SAVE25",
    "value": 25,
    "minOrderAmount": 100,
    "maxDiscountAmount": 150,
    "usageLimit": 2000,
    "userUsageLimit": 2,
    "validUntil": "2025-06-30T23:59:59.000Z",
    "oneTimeUse": false,
    "isRecurring": true
  }'
```

### 5. Update Coupon Status (Toggle Active/Inactive)

```bash
# Activate coupon
curl -X PATCH http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "isActive": true
  }'
```

```bash
# Deactivate coupon
curl -X PATCH http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "isActive": false
  }'
```

### 6. Delete Coupon (Soft Delete)

```bash
curl -X DELETE http://localhost:8080/api/v1/admin/coupons/64f0a1b2c3d4e5f601000001 \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Field Descriptions

### Required Fields (Create):

- **code** (String): Unique coupon code (automatically converted to uppercase)
- **type** (String): Discount type - `"Percentage"` or `"Fixed"` or `"Free Shipping"`
- **value** (Number): Discount value
  - For Percentage: 0-100
  - For Fixed: Any positive number

### Optional Fields:

- **name** (Object): I18n object with `en` and `nl` fields
- **description** (Object): I18n object with `en` and `nl` fields
- **minOrderAmount** (Number): Minimum cart amount required to use coupon
- **maxDiscountAmount** (Number): Maximum discount amount (for percentage coupons)
- **usageLimit** (Number): Maximum global usage count
- **userUsageLimit** (Number): Maximum usage per user
- **validFrom** (Date): Coupon valid from date (ISO 8601 format)
- **validUntil** (Date): Coupon expiry date (ISO 8601 format)
- **isActive** (Boolean): Active status (default: `true`)
- **isRecurring** (Boolean): Can be used again on subscription renewals (default: `false`)
- **oneTimeUse** (Boolean): Customer can use this coupon only once in their lifetime (default: `false`)
- **applicableProducts** (Array): Array of product ObjectIds
- **applicableCategories** (Array): Array of category ObjectIds
- **excludedProducts** (Array): Array of product ObjectIds to exclude

### Discount Types:

- **Percentage**: Discount percentage (0-100)
- **Fixed**: Fixed discount amount
- **Free Shipping**: Free shipping coupon

---

## Notes

1. **Authentication**: All endpoints require Admin role. Include JWT token in `Authorization` header.
2. **Coupon Code**: Automatically converted to uppercase. Must be unique.
3. **Percentage Validation**: Percentage coupons must have value between 0-100.
4. **Date Validation**: `validUntil` must be after `validFrom` if both are provided.
5. **Soft Delete**: Delete operation is soft delete - coupon is marked as deleted but not removed from database.
6. **Usage Tracking**: `usageCount` is automatically tracked and cannot be manually updated.
7. **Status Toggle**: Use the status endpoint to quickly activate/deactivate coupons.

---

## Example: Complete Coupon Lifecycle

```bash
# 1. Create a new coupon
curl -X POST http://localhost:8080/api/v1/admin/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "code": "WELCOME10",
    "name": {"en": "Welcome 10% Off"},
    "type": "Percentage",
    "value": 10,
    "minOrderAmount": 25,
    "usageLimit": 100,
    "userUsageLimit": 1,
    "validUntil": "2025-12-31T23:59:59.000Z",
    "isActive": true,
    "oneTimeUse": true
  }'

# 2. List all coupons
curl -X GET "http://localhost:8080/api/v1/admin/coupons?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# 3. Get coupon details
curl -X GET http://localhost:8080/api/v1/admin/coupons/COUPON_ID \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# 4. Update coupon discount value
curl -X PUT http://localhost:8080/api/v1/admin/coupons/COUPON_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"value": 15, "minOrderAmount": 30}'

# 5. Deactivate coupon
curl -X PATCH http://localhost:8080/api/v1/admin/coupons/COUPON_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"isActive": false}'

# 6. Reactivate coupon
curl -X PATCH http://localhost:8080/api/v1/admin/coupons/COUPON_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"isActive": true}'

# 7. Delete coupon
curl -X DELETE http://localhost:8080/api/v1/admin/coupons/COUPON_ID \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```
