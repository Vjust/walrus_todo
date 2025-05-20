#!/bin/bash

# Script to reset and restart Next.js dev server when things go wrong
# This fixes common issues with the development server

echo "🧹 Complete Next.js reset..."

# Stop any running Next.js servers
echo "🛑 Stopping current servers..."
pkill -f "node.*next" || true

# Clean caches and build artifacts
echo "🗑️ Cleaning caches and build artifacts..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .next.lock

# Clear NPM cache for Next.js
echo "🧽 Clearing npm cache for Next.js..."
npm cache clean --force next react react-dom

# Install required dev dependencies
echo "📦 Installing essential dev dependencies..."
npm install --save-dev style-loader
npm install --no-save mini-css-extract-plugin@latest

# Set development environment
echo "⚙️ Setting development environment..."
export NODE_ENV="development"
export NEXT_DISABLE_SOURCEMAPS=1
export NEXT_TELEMETRY_DISABLED=1
export NEXT_RUNTIME="nodejs"
export PORT=3002

# Simplify Next.js configuration for development
echo "🔧 Creating simplified development config..."
cat > .next.config.simple.js << 'EOF'
/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '192.168.8.204'],
  },
  webpack: (config) => {
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.fallback) config.resolve.fallback = {};
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      encoding: false,
    };
    
    // Disable code splitting completely
    config.optimization = {
      ...config.optimization,
      splitChunks: false,
      runtimeChunk: false,
    };
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          }
        ],
      }
    ];
  }
};
EOF

# Launch the development server with simplified config
echo "🚀 Starting Next.js server with clean slate..."
NEXT_CONFIG_FILE=.next.config.simple.js NEXT_TURBO=0 NODE_OPTIONS="--max-old-space-size=8192 --no-warnings" npx next dev --port $PORT

echo "✅ Next.js dev server restarted successfully!"