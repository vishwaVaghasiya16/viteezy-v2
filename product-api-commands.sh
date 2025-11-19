#!/bin/bash

# Product API cURL Commands Script
# Usage: ./product-api-commands.sh

# Configuration
BASE_URL="http://localhost:8080/api/v1"
TOKEN="YOUR_ACCESS_TOKEN"  # Replace with your actual token
PRODUCT_ID="YOUR_PRODUCT_ID"  # Replace with actual product ID

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Product API cURL Commands ===${NC}\n"

# 1. Create Product (Basic - Sachets)
echo -e "${GREEN}1. Creating Product (Sachets variant)...${NC}"
curl -X POST "${BASE_URL}/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "Vitamin D3 Supplement",
    "slug": "vitamin-d3-supplement",
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

echo -e "\n\n${YELLOW}---${NC}\n"

# 2. Create Product (With Standup Pouch)
echo -e "${GREEN}2. Creating Product (With Standup Pouch)...${NC}"
curl -X POST "${BASE_URL}/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "Premium Multivitamin",
    "slug": "premium-multivitamin",
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

echo -e "\n\n${YELLOW}---${NC}\n"

# 3. Update Product
echo -e "${GREEN}3. Updating Product...${NC}"
curl -X PUT "${BASE_URL}/products/${PRODUCT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "title": "Updated Vitamin D3 Supplement",
    "status": "Active",
    "price": {
      "currency": "EUR",
      "amount": 34.99,
      "taxRate": 0.21
    }
  }'

echo -e "\n\n${YELLOW}---${NC}\n"

# 4. Delete Product
echo -e "${GREEN}4. Deleting Product...${NC}"
curl -X DELETE "${BASE_URL}/products/${PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

echo -e "\n\n${YELLOW}---${NC}\n"

# 5. Get Product by ID
echo -e "${GREEN}5. Getting Product by ID...${NC}"
curl -X GET "${BASE_URL}/products/${PRODUCT_ID}"

echo -e "\n\n${YELLOW}---${NC}\n"

# 6. Get All Products
echo -e "${GREEN}6. Getting All Products...${NC}"
curl -X GET "${BASE_URL}/products?page=1&limit=10&status=Active"

echo -e "\n\n${BLUE}=== Done ===${NC}"

