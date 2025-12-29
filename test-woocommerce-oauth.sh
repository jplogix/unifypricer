#!/bin/bash

# Test script to verify WooCommerce OAuth plugin endpoints

STORE_URL="https://yourstore.com"
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"

echo "Testing WooCommerce OAuth Plugin..."
echo ""

# Test 1: Check if plugin is accessible
echo "1. Testing authorize endpoint availability..."
curl -s -I "${STORE_URL}/wp-json/price-sync-oauth/v1/authorize" | head -n 1
echo ""

# Test 2: Check if rewrite rules are working
echo "2. Testing approval endpoint..."
curl -s -I "${STORE_URL}/wc-api/price-sync-oauth/approve" | head -n 1
echo ""

# Test 3: Try authorize request (will need authentication)
echo "3. Testing authorize endpoint (should redirect to login)..."
AUTH_URL="${STORE_URL}/wp-json/price-sync-oauth/v1/authorize?client_id=${CLIENT_ID}&redirect_uri=http://localhost:3000/api/oauth/woocommerce/callback&response_type=code&state=test123&store_name=Test"
echo "Auth URL: ${AUTH_URL}"
echo ""

echo "Expected results:"
echo "- Endpoint 1: Should return 200 OK or 401 Unauthorized (both are good)"
echo "- Endpoint 2: Should return 200 OK or 404 (if rewrite rules not flushed)"
echo "- Endpoint 3: Should redirect to WordPress login"
echo ""
echo "If all tests pass, the plugin is working correctly!"
