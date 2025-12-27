#!/bin/bash

# Payment Tracking API Test Commands
# Usage: bash docs/PAYMENT_TRACKING_TEST_COMMANDS.sh

BASE_URL="http://localhost:8080/api/v1"

echo "🧪 Payment Tracking API Test Commands"
echo "======================================"
echo ""

# Test 1: Track by Order ID
echo "📦 Test 1: Track by Order ID"
echo "----------------------------"
echo "curl -X GET \"$BASE_URL/payments/track/694f5c75e410a6d657bb4cb9\""
echo ""
curl -X GET "$BASE_URL/payments/track/694f5c75e410a6d657bb4cb9" | jq '.'
echo ""
echo ""

# Test 2: Track by Membership ID
echo "👤 Test 2: Track by Membership ID"
echo "----------------------------"
echo "curl -X GET \"$BASE_URL/payments/track/694f5cd9dfd03b83a29541c1\""
echo ""
curl -X GET "$BASE_URL/payments/track/694f5cd9dfd03b83a29541c1" | jq '.'
echo ""
echo ""

# Test 3: Track by Payment ID
echo "💳 Test 3: Track by Payment ID"
echo "----------------------------"
echo "curl -X GET \"$BASE_URL/payments/track/694f61a0de6c27827ee53dcb\""
echo ""
curl -X GET "$BASE_URL/payments/track/694f61a0de6c27827ee53dcb" | jq '.'
echo ""
echo ""

# Test 4: Invalid Reference ID
echo "❌ Test 4: Invalid Reference ID"
echo "----------------------------"
echo "curl -X GET \"$BASE_URL/payments/track/invalid-id\""
echo ""
curl -X GET "$BASE_URL/payments/track/invalid-id" | jq '.'
echo ""
echo ""

# Test 5: Non-existent Reference ID
echo "❌ Test 5: Non-existent Reference ID"
echo "----------------------------"
echo "curl -X GET \"$BASE_URL/payments/track/507f1f77bcf86cd799439011\""
echo ""
curl -X GET "$BASE_URL/payments/track/507f1f77bcf86cd799439011" | jq '.'
echo ""
echo ""

echo "✅ Tests completed!"

