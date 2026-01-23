#!/bin/bash

# Payment API Test Commands
# This file contains test commands for both /create and /intent APIs
# Both APIs are now aligned and provide the same functionality

# ============================================
# Configuration
# ============================================
BASE_URL="http://localhost:8080"
API_VERSION="v1"
TOKEN="YOUR_AUTH_TOKEN_HERE"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================
# Helper Functions
# ============================================
print_header() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# ============================================
# Test 1: Create Payment (Basic)
# ============================================
test_create_payment_basic() {
    print_header "Test 1: Create Payment (Basic)"
    
    print_info "Creating payment with order amount..."
    
    curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/create" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "MOLLIE",
        "returnUrl": "http://localhost:8080/payment/return",
        "cancelUrl": "http://localhost:8080/payment/cancel"
      }' | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 2: Create Payment Intent (Basic)
# ============================================
test_create_payment_intent_basic() {
    print_header "Test 2: Create Payment Intent (Basic)"
    
    print_info "Creating payment intent with order amount..."
    
    curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/intent" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "MOLLIE",
        "returnUrl": "http://localhost:8080/payment/return",
        "cancelUrl": "http://localhost:8080/payment/cancel"
      }' | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 3: Create Payment with Custom Amount
# ============================================
test_create_payment_custom_amount() {
    print_header "Test 3: Create Payment with Custom Amount"
    
    print_info "Creating payment with custom amount..."
    
    curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/create" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "STRIPE",
        "amount": {
          "value": 99.99,
          "currency": "EUR"
        },
        "description": "Custom payment for testing",
        "returnUrl": "http://localhost:8080/payment/return",
        "cancelUrl": "http://localhost:8080/payment/cancel"
      }' | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 4: Create Payment with Metadata
# ============================================
test_create_payment_with_metadata() {
    print_header "Test 4: Create Payment with Metadata"
    
    print_info "Creating payment with metadata..."
    
    curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/create" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "MOLLIE",
        "metadata": {
          "source": "mobile_app",
          "version": "2.0",
          "platform": "ios"
        },
        "returnUrl": "http://localhost:8080/payment/return",
        "cancelUrl": "http://localhost:8080/payment/cancel"
      }' | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 5: Create Subscription Order Payment
# ============================================
test_subscription_order_payment() {
    print_header "Test 5: Create Subscription Order Payment"
    
    print_info "Step 1: Create subscription order..."
    
    ORDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/${API_VERSION}/orders" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "items": [
          {
            "productId": "REPLACE_WITH_PRODUCT_ID",
            "quantity": 1,
            "planDays": 30
          }
        ],
        "shippingAddressId": "REPLACE_WITH_ADDRESS_ID",
        "billingAddressId": "REPLACE_WITH_ADDRESS_ID",
        "isOneTime": false,
        "planType": "SUBSCRIPTION",
        "variantType": "SACHETS",
        "selectedPlanDays": 30
      }')
    
    ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.data._id')
    
    if [ "$ORDER_ID" != "null" ] && [ -n "$ORDER_ID" ]; then
        print_success "Order created: $ORDER_ID"
        
        print_info "Step 2: Create payment for subscription order..."
        
        curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/create" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer ${TOKEN}" \
          -d "{
            \"orderId\": \"${ORDER_ID}\",
            \"paymentMethod\": \"MOLLIE\",
            \"returnUrl\": \"http://localhost:8080/payment/return\",
            \"cancelUrl\": \"http://localhost:8080/payment/cancel\"
          }" | jq '.'
        
        print_success "Payment created - subscription will be auto-created after webhook"
        print_info "Complete payment on gateway, then check subscription creation"
    else
        print_error "Failed to create order"
        echo $ORDER_RESPONSE | jq '.'
    fi
}

# ============================================
# Test 6: Verify Response Format Consistency
# ============================================
test_response_consistency() {
    print_header "Test 6: Verify Response Format Consistency"
    
    print_info "Creating payment via /create API..."
    CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/${API_VERSION}/payments/create" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "MOLLIE",
        "returnUrl": "http://localhost:8080/payment/return"
      }')
    
    print_info "Creating payment via /intent API..."
    INTENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/${API_VERSION}/payments/intent" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "orderId": "REPLACE_WITH_ORDER_ID",
        "paymentMethod": "MOLLIE",
        "returnUrl": "http://localhost:8080/payment/return"
      }')
    
    print_info "Comparing response structures..."
    
    echo -e "\n${YELLOW}CREATE Response Structure:${NC}"
    echo $CREATE_RESPONSE | jq 'keys'
    
    echo -e "\n${YELLOW}INTENT Response Structure:${NC}"
    echo $INTENT_RESPONSE | jq 'keys'
    
    # Check if both have same keys
    CREATE_KEYS=$(echo $CREATE_RESPONSE | jq -r '.data | keys | sort | @json')
    INTENT_KEYS=$(echo $INTENT_RESPONSE | jq -r '.data | keys | sort | @json')
    
    if [ "$CREATE_KEYS" == "$INTENT_KEYS" ]; then
        print_success "Response formats are consistent!"
    else
        print_error "Response formats differ!"
        echo "CREATE keys: $CREATE_KEYS"
        echo "INTENT keys: $INTENT_KEYS"
    fi
}

# ============================================
# Test 7: Track Payment Status
# ============================================
test_track_payment() {
    print_header "Test 7: Track Payment Status"
    
    print_info "Tracking payment by order ID..."
    
    curl -X GET "${BASE_URL}/api/${API_VERSION}/payments/track?orderId=REPLACE_WITH_ORDER_ID" \
      -H "Content-Type: application/json" | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 8: Verify Payment Callback
# ============================================
test_verify_callback() {
    print_header "Test 8: Verify Payment Callback"
    
    print_info "Verifying payment via callback..."
    
    curl -X POST "${BASE_URL}/api/${API_VERSION}/payments/verify-callback" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" \
      -d '{
        "paymentId": "REPLACE_WITH_PAYMENT_ID",
        "gatewayTransactionId": "REPLACE_WITH_GATEWAY_ID"
      }' | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 9: Check Subscription After Payment
# ============================================
test_check_subscription() {
    print_header "Test 9: Check Subscription After Payment"
    
    print_info "Fetching user subscriptions..."
    
    curl -X GET "${BASE_URL}/api/${API_VERSION}/subscriptions/user/me" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Test 10: Get Payment by ID
# ============================================
test_get_payment() {
    print_header "Test 10: Get Payment by ID"
    
    print_info "Fetching payment details..."
    
    curl -X GET "${BASE_URL}/api/${API_VERSION}/payments/REPLACE_WITH_PAYMENT_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${TOKEN}" | jq '.'
    
    print_success "Test completed"
}

# ============================================
# Main Menu
# ============================================
show_menu() {
    echo -e "\n${GREEN}Payment API Test Suite${NC}"
    echo -e "${GREEN}=======================${NC}\n"
    echo "1.  Test Create Payment (Basic)"
    echo "2.  Test Create Payment Intent (Basic)"
    echo "3.  Test Create Payment with Custom Amount"
    echo "4.  Test Create Payment with Metadata"
    echo "5.  Test Subscription Order Payment (Full Flow)"
    echo "6.  Test Response Format Consistency"
    echo "7.  Test Track Payment Status"
    echo "8.  Test Verify Payment Callback"
    echo "9.  Test Check Subscription After Payment"
    echo "10. Test Get Payment by ID"
    echo "11. Run All Tests"
    echo "0.  Exit"
    echo ""
}

run_all_tests() {
    print_header "Running All Tests"
    test_create_payment_basic
    test_create_payment_intent_basic
    test_create_payment_custom_amount
    test_create_payment_with_metadata
    test_track_payment
    test_get_payment
    print_success "All tests completed!"
}

# ============================================
# Main Script
# ============================================
main() {
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install it first:"
        echo "  macOS: brew install jq"
        echo "  Ubuntu: sudo apt-get install jq"
        exit 1
    fi
    
    # Check if TOKEN is set
    if [ "$TOKEN" == "YOUR_AUTH_TOKEN_HERE" ]; then
        print_error "Please set your authentication token in the script"
        echo "Edit this file and replace YOUR_AUTH_TOKEN_HERE with your actual token"
        exit 1
    fi
    
    # If arguments provided, run specific test
    if [ $# -gt 0 ]; then
        case $1 in
            1) test_create_payment_basic ;;
            2) test_create_payment_intent_basic ;;
            3) test_create_payment_custom_amount ;;
            4) test_create_payment_with_metadata ;;
            5) test_subscription_order_payment ;;
            6) test_response_consistency ;;
            7) test_track_payment ;;
            8) test_verify_callback ;;
            9) test_check_subscription ;;
            10) test_get_payment ;;
            11) run_all_tests ;;
            *) echo "Invalid test number" ;;
        esac
        exit 0
    fi
    
    # Interactive menu
    while true; do
        show_menu
        read -p "Select test to run (0-11): " choice
        
        case $choice in
            1) test_create_payment_basic ;;
            2) test_create_payment_intent_basic ;;
            3) test_create_payment_custom_amount ;;
            4) test_create_payment_with_metadata ;;
            5) test_subscription_order_payment ;;
            6) test_response_consistency ;;
            7) test_track_payment ;;
            8) test_verify_callback ;;
            9) test_check_subscription ;;
            10) test_get_payment ;;
            11) run_all_tests ;;
            0) 
                print_info "Exiting..."
                exit 0
                ;;
            *) 
                print_error "Invalid choice. Please select 0-11"
                ;;
        esac
        
        read -p "Press Enter to continue..."
    done
}

# Run main function
main "$@"

