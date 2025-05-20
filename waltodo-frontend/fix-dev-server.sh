#!/bin/bash

# Script to fix Next.js development server issues
# Cleans caches and restarts the server properly

echo "🧹 Cleaning Next.js cache and fixing development server..."

# Make script executable
chmod +x "$(dirname "$0")/fix-dev-server.sh"

# Stop any running Next.js processes
echo "🛑 Stopping any running Next.js processes..."
pkill -f "node.*next" || true

# Clean Next.js cache
echo "🗑️  Removing .next directory..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next.lock

# Handle node_modules problems
echo "🔧 Checking node_modules structure..."
if [ -f "node_modules/.pnpm/style-loader" ]; then
  echo "⚙️  Installing style-loader for CSS MIME type fix..."
  npm install --save-dev style-loader
fi

# Save current Next.js config
echo "📋 Backing up next.config.js..."
if [ -f "next.config.js" ]; then
  cp next.config.js next.config.js.bak
fi

# Check for port conflicts
PORT=3002
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $PORT is already in use. Killing process..."
    lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 || true
fi

# Retry with alternate port if needed
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    PORT=3003
    echo "⚠️  Using alternate port $PORT instead..."
fi

# Make sure node_modules are up to date
echo "📦 Checking for missing dependencies..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.pnpm/lock.yaml" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Fix output configuration in dev mode
echo "⚙️  Setting development-specific environment variables..."
export NODE_ENV="development"
export NEXT_DISABLE_SOURCEMAPS=1
export NEXT_TELEMETRY_DISABLED=1

# Increase Node memory allowance
echo "🔧 Setting increased memory limits..."
export NODE_OPTIONS="--max-old-space-size=8192 --no-warnings"

# Use development mode with turbo disabled
echo "🚀 Starting Next.js dev server in clean mode on port $PORT..."
PORT=$PORT NODE_ENV=development NEXT_TURBO=0 npx next dev --no-lint --port $PORT

echo "✅ Server started successfully!"