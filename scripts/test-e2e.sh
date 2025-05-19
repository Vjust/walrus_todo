#!/bin/bash

echo "🧪 Running E2E tests for store-file command..."

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Build the project if needed
if [ ! -f "bin/dev" ]; then
  echo "📦 Building the project..."
  pnpm run build:dev
fi

# Run the E2E tests
echo "🏃 Starting E2E tests..."
WALRUS_USE_MOCK=true pnpm test:e2e -- store-file.e2e.test.ts

echo "✅ E2E tests completed!"