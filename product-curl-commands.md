# Product API - cURL Commands

## Base URL
```
http://localhost:8080/api/v1/products
```

**Note:** Authentication token required for Create, Update, and Delete operations.

---

## 1. Create Product

### Basic Product (Sachets variant, no standup pouch)
**Note:** Slug automatically generate hota hai title se. Agar manually slug dena ho to optional hai.
```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Vitamin D3 Supplement",
    "description": "High-quality Vitamin D3 supplement for daily use",
    "productImage": "https://example.com/images/vitamin-d3.jpg",
    "benefits": [
      "Supports bone health",
      "Boosts immune system",
      "Improves mood"
    ],
    "ingredients": [
      "Vitamin D3 (Cholecalciferol)",
      "MCT Oil",
      "Natural Tocopherols"
    ],
    "nutritionInfo": "Per serving: Vitamin D3 - 2000 IU",
    "howToUse": "Take one sachet daily with food",
    "status": "Active",
    "price": {
      "currency": "EUR",
      "amount": 29.99,
      "taxRate": 0.21
    },
    "variant": "SACHETS",
    "hasStandupPouch": false
  }'
```

### Form-Data Example (with image upload)
```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "title=Vitamin D3 Supplement" \
  -F "description=High-quality Vitamin D3 supplement for daily use" \
  -F "benefits=[\"Supports bone health\",\"Boosts immune system\",\"Improves mood\"]" \
  -F "ingredients=[\"Vitamin D3 (Cholecalciferol)\",\"MCT Oil\",\"Natural Tocopherols\"]" \
  -F "nutritionInfo=Per serving: Vitamin D3 - 2000 IU" \
  -F "howToUse=Take one sachet daily with food" \
  -F "status=Active" \
  -F "variant=SACHETS" \
  -F "hasStandupPouch=false" \
  -F "price={\"currency\":\"EUR\",\"amount\":29.99,\"taxRate\":0.21}" \
  -F "productImage=@/absolute/path/to/vitamin-d3.jpg;type=image/jpeg"
```

### Product with Standup Pouch (with subscription pricing)
**Note:** Slug automatically generate hota hai title se.
```bash
curl -X POST http://localhost:8080/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Premium Multivitamin",
    "description": "Complete multivitamin formula with all essential nutrients",
    "productImage": "https://example.com/images/multivitamin.jpg",
    "benefits": [
      "Complete nutrition",
      "Energy boost",
      "Immune support"
    ],
    "ingredients": [
      "Vitamin A",
      "Vitamin C",
      "Vitamin E",
      "B-Complex Vitamins",
      "Zinc",
      "Iron"
    ],
    "nutritionInfo": "Complete multivitamin with 20+ essential nutrients",
    "howToUse": "Take one pouch daily with water",
    "status": "Active",
    "price": {
      "currency": "EUR",
      "amount": 39.99,
      "taxRate": 0.21
    },
    "variant": "STAND_UP_POUCH",
    "hasStandupPouch": true,
    "standupPouchPrices": {
      "oneTime": {
        "currency": "EUR",
        "amount": 39.99,
        "taxRate": 0.21
      },
      "thirtyDays": {
        "currency": "EUR",
        "amount": 109.99,
        "taxRate": 0.21
      },
      "sixtyDays": {
        "currency": "EUR",
        "amount": 199.99,
        "taxRate": 0.21
      },
      "ninetyDays": {
        "currency": "EUR",
        "amount": 279.99,
        "taxRate": 0.21
      },
      "oneEightyDays": {
        "currency": "EUR",
        "amount": 499.99,
        "taxRate": 0.21
      }
    }
  }'
```

---

## 2. Update Product

### Update Product (Partial Update)
```bash
curl -X PUT http://localhost:8080/api/v1/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "Updated Vitamin D3 Supplement",
    "status": "Active",
    "price": {
      "currency": "EUR",
      "amount": 34.99,
      "taxRate": 0.21
    }
  }'
```

### Update via Form-Data (with new image)
```bash
curl -X PUT http://localhost:8080/api/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "title=Updated Vitamin D3 Supplement" \
  -F "status=Active" \
  -F "price={\"currency\":\"EUR\",\"amount\":34.99,\"taxRate\":0.21}" \
  -F "productImage=@/absolute/path/to/new-vitamin-d3.jpg;type=image/jpeg"
```

### Update Product with Standup Pouch Pricing
```bash
curl -X PUT http://localhost:8080/api/v1/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "hasStandupPouch": true,
    "standupPouchPrices": {
      "oneTime": {
        "currency": "EUR",
        "amount": 44.99,
        "taxRate": 0.21
      },
      "thirtyDays": {
        "currency": "EUR",
        "amount": 119.99,
        "taxRate": 0.21
      },
      "sixtyDays": {
        "currency": "EUR",
        "amount": 219.99,
        "taxRate": 0.21
      },
      "ninetyDays": {
        "currency": "EUR",
        "amount": 299.99,
        "taxRate": 0.21
      },
      "oneEightyDays": {
        "currency": "EUR",
        "amount": 549.99,
        "taxRate": 0.21
      }
    }
  }'
```

---

## 3. Delete Product

```bash
curl -X DELETE http://localhost:8080/api/v1/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 4. Get Product (for reference - no auth required)

### Get Product by ID
```bash
curl -X GET http://localhost:8080/api/v1/products/PRODUCT_ID
```

### Get Product by Slug
```bash
curl -X GET http://localhost:8080/api/v1/products/slug/vitamin-d3-supplement
```

### Get All Products
```bash
curl -X GET http://localhost:8080/api/v1/products?page=1&limit=10&status=Active
```

### Search + Sort Examples
```bash
# Keyword search sorted by relevance (requires ?search= query)
curl -X GET "http://localhost:8080/api/v1/products?search=vitamin&sortBy=relevance"

# Price sorting
curl -X GET "http://localhost:8080/api/v1/products?sortBy=priceLowToHigh"
curl -X GET "http://localhost:8080/api/v1/products?sortBy=priceHighToLow"

# Rating sorting (average rating desc, fallback to rating count)
curl -X GET "http://localhost:8080/api/v1/products?sortBy=rating"
```

### Filter by Categories / Health Goals / Ingredients
```bash
# Multiple values can be comma separated
curl -X GET "http://localhost:8080/api/v1/products?categories=immunity,energy&healthGoals=skin-care&ingredients=Vitamin%20C"
```

### Get Available Filter Values
```bash
curl -X GET http://localhost:8080/api/v1/products/filters
```

---

## Authentication Token

Pehle login karke token lein:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

Response se `accessToken` copy karke upar ke commands mein `YOUR_ACCESS_TOKEN` ki jagah use karein.

---

## Important Notes

1. **Slug Auto-Generation** - Slug automatically title se generate hota hai. Agar manually slug dena ho to optional hai, lekin recommended nahi hai.
2. **Replace `YOUR_ACCESS_TOKEN`** - Apne actual JWT token se replace karein
3. **Replace `PRODUCT_ID`** - Actual product MongoDB ObjectId se replace karein
4. **Port** - Agar aapka server different port par chal raha hai, to URL update karein
5. **Currency** - Valid values: `EUR`, `USD`, `GBP`, `INR`
6. **Variant** - Valid values: `SACHETS`, `STAND_UP_POUCH`
7. **Status** - Valid values: `Active`, `Hidden`, `Draft`
8. **hasStandupPouch** - Agar `true` hai, to `standupPouchPrices` required hai
9. **Form-Data JSON Fields** - Multipart form mein `benefits`, `ingredients`, `price`, aur `standupPouchPrices` ko JSON string ke roop mein bhejein (e.g. `-F "price={\"currency\":\"EUR\"...}"`)

---

## Windows PowerShell ke liye

Agar aap Windows PowerShell use kar rahe hain, to single quotes ki jagah double quotes use karein aur escape karein:

```powershell
curl -X POST http://localhost:8080/api/v1/products `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -d "{`"title`": `"Vitamin D3 Supplement`", `"description`": `"High-quality supplement`"}"
```

Ya phir file se data send karein:

```powershell
curl -X POST http://localhost:8080/api/v1/products `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" `
  -d "@product-data.json"
```

