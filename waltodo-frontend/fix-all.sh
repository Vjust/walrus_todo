#!/bin/bash

# All-in-one fix script for Next.js development issues

echo "🔧 Running complete fix for Next.js application..."

# Make script executable
chmod +x "$(dirname "$0")/fix-all.sh"
chmod +x "$(dirname "$0")/reset-next.sh"
chmod +x "$(dirname "$0")/enable-simple-wallet.sh"

# 1. Stop any running Next.js processes
echo "🛑 Stopping any running Next.js processes..."
pkill -f "node.*next" || true

# 2. Clean caches and artifacts
echo "🧹 Cleaning all caches and artifacts..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next.lock

# 3. Install required dependencies
echo "📦 Installing required dependencies..."
npm install --save-dev style-loader
npm install --save-dev mini-css-extract-plugin@latest

# 4. Create ultrasimple config for Next.js
echo "⚙️ Creating ultrasimple Next.js config..."
cat > .simple-next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
module.exports = {
  output: undefined,
  reactStrictMode: false,
  swcMinify: false,
  images: {
    domains: ['localhost', '192.168.8.204'],
  },
  experimental: {}
};
EOF

# 5. Switch to simple wallet implementation
echo "🔄 Switching to simple wallet implementation..."
./enable-simple-wallet.sh

# 6. Set optimal environment variables
echo "🌍 Setting optimal environment variables..."
export NODE_ENV=development
export NEXT_TELEMETRY_DISABLED=1
export NEXT_RUNTIME=nodejs
export NEXT_CONFIG_FILE=.simple-next.config.js
export NEXT_TURBO=0
export NODE_OPTIONS="--max-old-space-size=8192 --no-warnings"
export PORT=3002

# 7. Start the development server
echo "🚀 Starting Next.js development server..."
npx next dev --port 3002

echo "✅ Server should be running now!"