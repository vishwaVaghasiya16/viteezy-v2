# Cart Management API Documentation

## Overview
Complete Cart Management API with product validation, stock checking, pricing calculation, and low stock warnings.

## Features
✅ **Product & Variant Validation**: Validates product_id and variant_id exist and are active
✅ **Stock Management**: Ensures requested quantity ≤ available stock
✅ **Low Stock Warnings**: Returns warnings when stock is low (< 10 items)
✅ **Correct Pricing**: Returns pricing from product or variant as appropriate
✅ **Cart Operations**: Add, update, remove items, clear cart, get cart

---

## API Endpoints

### Base URL
```
/api/v1/carts
```

All endpoints require authentication (Bearer token).

---

## 1. Get User's Cart

**GET** `/api/v1/carts`

Get the current user's cart with all items, totals, and stock warnings.

### Response
```json
{
  "success": true,
  "message": "Cart retrieved successfully",
  "data": {
    "cart": {
      "_id": "...",
      "userId": "...",
      "items": [
        {
          "productId": "...",
          "variantId": "...",
          "quantity": 2,
          "price": {
            "currency": "EUR",
            "amount": 29.99,
            "taxRate": 0.21
          },
          "addedAt": "2025-01-20T10:00:00.000Z",
          "product": { ... },
          "variant": { ... },
          "stockWarning": {
            "available": 5,
            "requested": 2,
            "isLowStock": true,
            "message": "Only 5 items available in stock"
          }
        }
      ],
      "subtotal": {
        "currency": "EUR",
        "amount": 59.98,
        "taxRate": 0.21
      },
      "tax": {
        "currency": "EUR",
        "amount": 12.60,
        "taxRate": 0.21
      },
      "total": {
        "currency": "EUR",
        "amount": 72.58,
        "taxRate": 0.21
      }
    },
    "warnings": [
      {
        "productId": "...",
        "variantId": "...",
        "message": "Only 5 items available in stock",
        "available": 5
      }
    ]
  }
}
```

---

## 2. Add Item to Cart

**POST** `/api/v1/carts/items`

Add a product (with or without variant) to the cart.

### Request Body
```json
{
  "productId": "691d58dec8176b5dca58b1be",
  "variantId": "691d58dec8176b5dca58b1bf",  // Optional
  "quantity": 2
}
```

### Validation Rules
- `productId`: Required, valid MongoDB ObjectId
- `variantId`: Optional, valid MongoDB ObjectId (if provided, must belong to product)
- `quantity`: Required, integer ≥ 1

### Stock Validation
- ✅ Product must exist and be `Active`
- ✅ Variant (if provided) must exist and be `isActive: true`
- ✅ Quantity must not exceed available stock (unless `allowBackorder: true`)
- ✅ Returns warning if stock < 10 items

### Pricing Logic
- If `variantId` provided: Uses variant price
- If no `variantId`: Uses product price

### Response
```json
{
  "success": true,
  "message": "Item added to cart",
  "data": {
    "cart": { ... },
    "warnings": [
      {
        "productId": "...",
        "variantId": "...",
        "message": "Only 5 items available in stock",
        "available": 5
      }
    ]
  }
}
```

### Error Responses

**Product Not Found**
```json
{
  "success": false,
  "message": "Product not found or not available",
  "errorType": "NotFound",
  "error": "Product not found or not available"
}
```

**Variant Not Found**
```json
{
  "success": false,
  "message": "Product variant not found or not available",
  "errorType": "NotFound",
  "error": "Product variant not found or not available"
}
```

**Insufficient Stock**
```json
{
  "success": false,
  "message": "Insufficient stock. Available: 5, Requested: 10",
  "errorType": "BadRequest",
  "error": "Insufficient stock. Available: 5, Requested: 10"
}
```

---

## 3. Update Cart Item Quantity

**PUT** `/api/v1/carts/items/:index`

Update the quantity of a cart item by its index.

### URL Parameters
- `index`: Item index in cart (0-based)

### Request Body
```json
{
  "quantity": 3
}
```

### Validation Rules
- `quantity`: Required, integer ≥ 1

### Stock Validation
- ✅ Validates stock availability before updating
- ✅ Returns warning if stock is low

### Response
```json
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": {
    "cart": { ... },
    "warnings": [ ... ]
  }
}
```

---

## 4. Remove Item from Cart

**DELETE** `/api/v1/carts/items/:index`

Remove an item from the cart by its index.

### URL Parameters
- `index`: Item index in cart (0-based)

### Response
```json
{
  "success": true,
  "message": "Item removed from cart",
  "data": {
    "cart": { ... }
  }
}
```

---

## 5. Clear Cart

**DELETE** `/api/v1/carts`

Remove all items from the cart.

### Response
```json
{
  "success": true,
  "message": "Cart cleared successfully"
}
```

---

## Stock Warning Logic

### Low Stock Threshold
- Default: **10 items**
- Configurable in `CartService.LOW_STOCK_THRESHOLD`

### Warning Types

1. **Out of Stock** (`available === 0`)
   ```json
   {
     "message": "This item is out of stock",
     "isLowStock": true
   }
   ```

2. **Low Stock** (`available ≤ 10`)
   ```json
   {
     "message": "Only 5 items available in stock",
     "isLowStock": true
   }
   ```

3. **Approaching Low Stock** (requested quantity would leave < 10 remaining)
   ```json
   {
     "message": "Low stock warning: Only 12 items remaining",
     "isLowStock": false
   }
   ```

---

## Pricing Calculation

### Price Source Priority
1. **Variant Price** (if `variantId` provided)
2. **Product Price** (if no variant)

### Totals Calculation
- **Subtotal**: Sum of (item.price.amount × item.quantity) for all items
- **Tax**: Subtotal × taxRate
- **Total**: Subtotal + Tax

### Currency
- Uses currency from first item (assumes all items have same currency)
- Default: `EUR`

---

## cURL Examples

### 1. Get Cart
```bash
curl --location 'http://localhost:8080/api/v1/carts' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

### 2. Add Item (Product Only)
```bash
curl --location 'http://localhost:8080/api/v1/carts/items' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "productId": "691d58dec8176b5dca58b1be",
  "quantity": 2
}'
```

### 3. Add Item (With Variant)
```bash
curl --location 'http://localhost:8080/api/v1/carts/items' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "productId": "691d58dec8176b5dca58b1be",
  "variantId": "691d58dec8176b5dca58b1bf",
  "quantity": 1
}'
```

### 4. Update Item Quantity
```bash
curl --location --request PUT 'http://localhost:8080/api/v1/carts/items/0' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "quantity": 5
}'
```

### 5. Remove Item
```bash
curl --location --request DELETE 'http://localhost:8080/api/v1/carts/items/0' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

### 6. Clear Cart
```bash
curl --location --request DELETE 'http://localhost:8080/api/v1/carts' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

## PowerShell Examples

### 1. Add Item
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_TOKEN"
    "Content-Type" = "application/json"
}

$body = @{
    productId = "691d58dec8176b5dca58b1be"
    variantId = "691d58dec8176b5dca58b1bf"
    quantity = 2
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/carts/items" -Method Post -Headers $headers -Body $body
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errorType": "ErrorType",
  "error": "Detailed error message"
}
```

### Common Error Types
- `ValidationError`: Invalid input data
- `NotFound`: Product/variant/cart item not found
- `BadRequest`: Business logic error (e.g., insufficient stock)
- `Unauthorized`: Missing or invalid authentication token

---

## Implementation Details

### Files Created/Modified
1. **`src/validation/cartValidation.ts`**: Joi validation schemas
2. **`src/services/cartService.ts`**: Business logic for cart operations
3. **`src/controllers/cartController.ts`**: Request handlers
4. **`src/routes/cartRoutes.ts`**: Route definitions
5. **`src/routes/index.ts`**: Added cart routes

### Key Features
- ✅ Automatic cart creation if doesn't exist
- ✅ Stock validation on add/update
- ✅ Low stock warnings
- ✅ Correct pricing from product/variant
- ✅ Automatic totals calculation
- ✅ Product and variant details in response
- ✅ Scalable architecture

---

## Testing Checklist

- [ ] Add product without variant
- [ ] Add product with variant
- [ ] Add duplicate item (should update quantity)
- [ ] Update item quantity
- [ ] Remove item
- [ ] Clear cart
- [ ] Get cart with warnings
- [ ] Test insufficient stock error
- [ ] Test invalid product/variant ID
- [ ] Test low stock warnings

---

## Notes

- Cart expires after 30 days (configurable in model)
- Stock warnings are informational and don't block operations (unless out of stock)
- Backorder is allowed if `variant.inventory.allowBackorder === true`
- All prices include tax calculation
- Currency is assumed to be consistent across all items

