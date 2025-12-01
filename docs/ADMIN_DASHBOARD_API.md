# Admin Dashboard API - Stats Summary

Base URL: `http://localhost:8080/api/v1`

**Note:** Replace `YOUR_AUTH_TOKEN` with your actual JWT token obtained from login.

---

## Dashboard Stats API

### Get Dashboard Stats Summary

```bash
curl -X GET http://localhost:8080/api/v1/admin/dashboard/stats \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Response Format

```json
{
  "success": true,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "stats": {
      "totalUsers": {
        "value": 12482,
        "change": {
          "percentage": 5.2,
          "isPositive": true,
          "period": "This month"
        }
      },
      "totalOrders": {
        "value": 8145,
        "change": {
          "percentage": 8.4,
          "isPositive": true,
          "period": "This month"
        }
      },
      "totalRevenue": {
        "value": 124500,
        "change": {
          "percentage": 15.3,
          "isPositive": true,
          "period": "This month"
        }
      },
      "activeSubscriptions": {
        "value": 3210,
        "change": {
          "percentage": 1.1,
          "isPositive": false,
          "period": "This month"
        }
      },
      "membershipPurchases": {
        "value": 1890,
        "change": {
          "percentage": 7.8,
          "isPositive": true,
          "period": "This month"
        }
      }
    }
  }
}
```

---

## Stats Cards Details

### 1. Total Users

- **Value**: Total count of all users (excluding deleted)
- **Change**: Percentage change comparing current month vs last month
- **Period**: "This month"

### 2. Total Orders

- **Value**: Total count of all orders (excluding deleted)
- **Change**: Percentage change comparing current month vs last month
- **Period**: "This month"

### 3. Total Revenue

- **Value**: Sum of all completed payments (in base currency amount)
- **Change**: Percentage change comparing current month vs last month
- **Period**: "This month"
- **Note**: Only includes payments with `COMPLETED` status

### 4. Active Subscriptions

- **Value**: Count of subscriptions with `ACTIVE` status
- **Change**: Percentage change comparing current month vs last month
- **Period**: "This month"

### 5. Membership Purchases

- **Value**: Total count of all membership purchases (excluding deleted)
- **Change**: Percentage change comparing current month vs last month
- **Period**: "This month"

---

## Percentage Change Calculation

The percentage change is calculated as:

```
((Current Month Value - Last Month Value) / Last Month Value) * 100
```

- **isPositive**: `true` if change is positive or zero, `false` if negative
- **percentage**: Absolute value of the percentage change
- **period**: Always "This month" (comparing current month with previous month)

---

## Notes

1. **Authentication**: Requires Admin role. Include JWT token in `Authorization` header.
2. **Time Period**: All comparisons are based on calendar months (current month vs last month).
3. **Revenue Calculation**: Only includes payments with `COMPLETED` status.
4. **Active Subscriptions**: Only counts subscriptions with `ACTIVE` status.
5. **Soft Delete**: All queries exclude soft-deleted records where applicable.
6. **Currency**: Revenue is returned in the base currency amount (from `amount.amount` field in payments).

---

## Example Usage

```bash
# Get dashboard stats
curl -X GET http://localhost:8080/api/v1/admin/dashboard/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

The response can be directly used to populate dashboard cards with:

- Main value (e.g., "12,482")
- Percentage change (e.g., "+5.2%")
- Trend indicator (up/down arrow based on `isPositive`)
- Period label (e.g., "This month")

---

## Revenue Overview Chart API

### Get Revenue Overview Chart Data

```bash
# Monthly view (default - last 12 months)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/revenue-overview?period=monthly" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Weekly view (last 12 weeks)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/revenue-overview?period=weekly" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Daily view (last 30 days)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/revenue-overview?period=daily" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Custom date range (monthly)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/revenue-overview?period=monthly&startDate=2024-01-01T00:00:00.000Z&endDate=2024-12-31T23:59:59.999Z" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Response Format

```json
{
  "success": true,
  "message": "Revenue overview retrieved successfully",
  "data": {
    "period": "monthly",
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.999Z",
    "data": [
      {
        "date": "2024-01",
        "revenue": 2856.5,
        "count": 45
      },
      {
        "date": "2024-02",
        "revenue": 3520.75,
        "count": 52
      },
      {
        "date": "2024-03",
        "revenue": 0,
        "count": 0
      }
    ]
  }
}
```

**Query Parameters:**

- `period` (optional): "daily", "weekly", or "monthly" (default: "monthly")
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string

**Date Format:**

- **Daily**: `YYYY-MM-DD` (e.g., "2024-01-15")
- **Weekly**: `YYYY-WXX` (e.g., "2024-W03")
- **Monthly**: `YYYY-MM` (e.g., "2024-01")

**Note:** All dates in the specified range are included in the response. If there's no data for a specific date, it will appear with `revenue: 0` and `count: 0`.

---

## Top Selling Plans Chart API

### Get Top Selling Plans Chart Data

```bash
# Today's data (default)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/top-selling-plans" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Specific date
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/top-selling-plans?date=2024-12-01" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Response Format

```json
{
  "success": true,
  "message": "Top selling plans retrieved successfully",
  "data": {
    "date": "2024-12-01",
    "total": 150,
    "plans": [
      {
        "name": "90 days plan",
        "count": 60,
        "percentage": 40.0
      },
      {
        "name": "60 days plan",
        "count": 52,
        "percentage": 35.0
      },
      {
        "name": "One-time purchases",
        "count": 38,
        "percentage": 25.0
      }
    ]
  }
}
```

**Query Parameters:**

- `date` (optional): ISO 8601 date string (default: today)

---

## Top Selling Products API

### Get Top Selling Products List

```bash
# Default (top 10)
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/top-selling-products" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Top 20 products
curl -X GET "http://localhost:8080/api/v1/admin/dashboard/top-selling-products?limit=20" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Response Format

```json
{
  "success": true,
  "message": "Top selling products retrieved successfully",
  "data": {
    "products": [
      {
        "productId": "64f0a1b2c3d4e5f601000001",
        "productName": "Daily Essentials",
        "productImage": "https://example.com/image.jpg",
        "category": "General Health",
        "price": 49.99,
        "currency": "EUR",
        "totalSales": 1204,
        "revenue": 49200.0,
        "status": "inStock"
      },
      {
        "productId": "64f0a1b2c3d4e5f601000002",
        "productName": "Vitamin D3",
        "productImage": "https://example.com/image2.jpg",
        "category": "Vitamins",
        "price": 29.99,
        "currency": "EUR",
        "totalSales": 856,
        "revenue": 25674.44,
        "status": "lowStock"
      }
    ]
  }
}
```

**Query Parameters:**

- `limit` (optional): Number of products to return (default: 10, max: 100)

### Stock Status Values

- **inStock**: Available quantity > 10
- **lowStock**: Available quantity 1-10
- **outOfStock**: Available quantity = 0

**Note:** Stock status is calculated based on product variants' inventory (quantity - reserved).
