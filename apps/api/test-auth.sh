#!/bin/bash

# Test script for auth endpoints
API_URL="http://localhost:3001"
WALLET="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
SIGNATURE="0x"$(printf '0%.0s' {1..256})
MESSAGE="Sign in to WalTodo"

echo "Testing Auth Endpoints..."
echo "========================"

# Test login
echo -e "\n1. Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"wallet\": \"$WALLET\",
    \"signature\": \"$SIGNATURE\",
    \"message\": \"$MESSAGE\"
  }")

echo "Login response: $LOGIN_RESPONSE"

# Extract tokens
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | grep -o '[^"]*$')
REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"refreshToken":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Error: Failed to get access token"
  exit 1
fi

echo "Access token received: ${ACCESS_TOKEN:0:20}..."

# Test verify
echo -e "\n2. Testing verify endpoint..."
VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Verify response: $VERIFY_RESPONSE"

# Test refresh
echo -e "\n3. Testing refresh endpoint..."
REFRESH_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "Refresh response: $REFRESH_RESPONSE"

# Test logout
echo -e "\n4. Testing logout endpoint..."
LOGOUT_RESPONSE=$(curl -s -X POST "$API_URL/api/v1/auth/logout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Logout response: $LOGOUT_RESPONSE"

# Test verify after logout (should fail)
echo -e "\n5. Testing verify after logout (should fail)..."
VERIFY_AFTER_LOGOUT=$(curl -s -X POST "$API_URL/api/v1/auth/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Verify after logout: $VERIFY_AFTER_LOGOUT"

echo -e "\nAuth endpoint tests completed!"