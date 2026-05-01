#!/bin/bash

# Family Member Registration API Test Commands
# This script contains test commands for the Family Member Registration API

# Set your API base URL
API_URL="http://localhost:5000/api/auth"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Family Member Registration API Tests${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Register a main member (parent)
echo -e "${GREEN}Step 1: Register Main Member (Parent)${NC}"
echo "POST $API_URL/register"
curl -X POST $API_URL/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Michael",
    "lastName": "Johnson",
    "email": "michael.johnson@example.com",
    "password": "SecurePassword123",
    "phone": "+31612345600",
    "countryCode": "NL"
  }' | jq '.'

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 2: Verify OTP (you need to get the OTP from email/logs)
echo -e "${GREEN}Step 2: Verify OTP (Replace 123456 with actual OTP)${NC}"
echo "POST $API_URL/verify-otp"
echo "NOTE: Check your email or server logs for the OTP"
echo "curl -X POST $API_URL/verify-otp \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"email\": \"michael.johnson@example.com\","
echo "    \"otp\": \"123456\","
echo "    \"type\": \"Email Verification\","
echo "    \"deviceInfo\": \"Web\""
echo "  }'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 3: Login as main member
echo -e "${GREEN}Step 3: Login as Main Member${NC}"
echo "POST $API_URL/login"
echo "NOTE: Save the accessToken from the response"
curl -X POST $API_URL/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "michael.johnson@example.com",
    "password": "SecurePassword123",
    "deviceInfo": "Web"
  }' | jq '.'

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 4: Register Family Member with Email
echo -e "${GREEN}Step 4: Register Family Member WITH Email${NC}"
echo "POST $API_URL/register-family-member"
echo "NOTE: Replace YOUR_ACCESS_TOKEN with the token from login"
echo ""
echo "curl -X POST $API_URL/register-family-member \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"firstName\": \"Emma\","
echo "    \"lastName\": \"Johnson\","
echo "    \"email\": \"emma.johnson@example.com\","
echo "    \"password\": \"ChildPassword123\","
echo "    \"phone\": \"+31612345601\","
echo "    \"countryCode\": \"NL\","
echo "    \"gender\": \"Female\","
echo "    \"age\": 16,"
echo "    \"relationshipToParent\": \"Child\""
echo "  }'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 5: Register Family Member WITHOUT Email
echo -e "${GREEN}Step 5: Register Family Member WITHOUT Email${NC}"
echo "POST $API_URL/register-family-member"
echo ""
echo "curl -X POST $API_URL/register-family-member \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"firstName\": \"Oliver\","
echo "    \"lastName\": \"Johnson\","
echo "    \"password\": \"ChildPassword123\","
echo "    \"phone\": \"+31612345602\","
echo "    \"countryCode\": \"NL\","
echo "    \"gender\": \"Male\","
echo "    \"age\": 12,"
echo "    \"relationshipToParent\": \"Child\""
echo "  }'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 6: Register Spouse
echo -e "${GREEN}Step 6: Register Spouse${NC}"
echo "POST $API_URL/register-family-member"
echo ""
echo "curl -X POST $API_URL/register-family-member \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"firstName\": \"Sarah\","
echo "    \"lastName\": \"Johnson\","
echo "    \"email\": \"sarah.johnson@example.com\","
echo "    \"password\": \"SpousePassword123\","
echo "    \"phone\": \"+31612345603\","
echo "    \"countryCode\": \"NL\","
echo "    \"gender\": \"Female\","
echo "    \"age\": 38,"
echo "    \"relationshipToParent\": \"Spouse\""
echo "  }'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 7: Get All Family Members
echo -e "${GREEN}Step 7: Get All Family Members${NC}"
echo "GET $API_URL/family-members"
echo ""
echo "curl -X GET $API_URL/family-members \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" | jq '.'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Step 8: Get Profile (Main Member)
echo -e "${GREEN}Step 8: Get Profile (Main Member)${NC}"
echo "GET $API_URL/profile"
echo ""
echo "curl -X GET $API_URL/profile \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" | jq '.'"

echo -e "\n${BLUE}----------------------------------------${NC}\n"

# Additional Examples
echo -e "${GREEN}Additional Examples:${NC}\n"

echo "Register Parent (Elderly):"
echo "curl -X POST $API_URL/register-family-member \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"firstName\": \"Robert\","
echo "    \"lastName\": \"Johnson Sr.\","
echo "    \"password\": \"ParentPassword123\","
echo "    \"age\": 72,"
echo "    \"relationshipToParent\": \"Parent\""
echo "  }'"

echo -e "\n"

echo "Register Sibling:"
echo "curl -X POST $API_URL/register-family-member \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer YOUR_ACCESS_TOKEN\" \\"
echo "  -d '{"
echo "    \"firstName\": \"David\","
echo "    \"lastName\": \"Johnson\","
echo "    \"email\": \"david.johnson@example.com\","
echo "    \"password\": \"SiblingPassword123\","
echo "    \"age\": 35,"
echo "    \"relationshipToParent\": \"Sibling\""
echo "  }'"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}End of Test Commands${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo "NOTE: Remember to:"
echo "1. Replace YOUR_ACCESS_TOKEN with actual token from login"
echo "2. Replace OTP codes with actual codes from email/logs"
echo "3. Use jq for pretty JSON output (install with: brew install jq)"
echo "4. Adjust API_URL if your server runs on a different port"

