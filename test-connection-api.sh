#!/bin/bash

# Test script for the new hybrid WooCommerce connection API
# This demonstrates the token-based connection flow

echo "=================================="
echo "Testing WooCommerce Connection API"
echo "=================================="
echo ""

# Test 1: Generate Connection Token
echo "1. Testing Token Generation..."
echo "   Endpoint: GET /api/oauth/woocommerce/generate-token"
echo ""

TOKEN_RESPONSE=$(curl -s "http://localhost:3000/api/oauth/woocommerce/generate-token?storeUrl=https://mystore.com&storeName=My%20Store")

echo "Response:"
echo "$TOKEN_RESPONSE" | jq .

TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')
WP_ADMIN_URL=$(echo "$TOKEN_RESPONSE" | jq -r '.wpAdminUrl')

echo ""
echo "✓ Token generated: ${TOKEN:0:16}..."
echo "✓ WordPress Admin URL: $WP_ADMIN_URL"
echo ""

# Test 2: Simulate Plugin Sending Credentials
echo "2. Testing Credential Submission..."
echo "   Endpoint: POST /api/connect/woocommerce"
echo ""

CONNECT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/connect/woocommerce \
  -H 'Content-Type: application/json' \
  -d "{
    \"token\": \"$TOKEN\",
    \"consumer_key\": \"ck_test_$(openssl rand -hex 16)\",
    \"consumer_secret\": \"cs_test_$(openssl rand -hex 32)\",
    \"site_url\": \"https://mystore.com\",
    \"store_name\": \"My Store\",
    \"platform\": \"woocommerce\"
  }")

echo "Response:"
echo "$CONNECT_RESPONSE" | jq .

SUCCESS=$(echo "$CONNECT_RESPONSE" | jq -r '.success')
STORE_ID=$(echo "$CONNECT_RESPONSE" | jq -r '.storeData.storeId')
STORE_NAME=$(echo "$CONNECT_RESPONSE" | jq -r '.storeData.storeName')

echo ""
if [ "$SUCCESS" = "true" ]; then
  echo "✓ Connection successful!"
  echo "✓ Store ID: $STORE_ID"
  echo "✓ Store Name: $STORE_NAME"
else
  echo "✗ Connection failed"
fi

echo ""
echo "=================================="
echo "API Tests Complete!"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Install the woocommerce-connector-plugin on your WordPress site"
echo "2. Access the dashboard at http://localhost:5174"
echo "3. Click 'Add Store' and enter your WooCommerce URL"
echo "4. Watch the step-by-step connection progress!"
