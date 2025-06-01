/** @type {import('next').NextConfig} */

// Simple Next.js configuration for production build
const nextConfig = {
  reactStrictMode: true,
  
  // Transpile packages that need it
  transpilePackages: ['@mysten/dapp-kit', '@suiet/wallet-sdk', '@wallet-standard/react'],
  
  // Disable ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Enable TypeScript checking during builds
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Image configuration for Walrus domains
  images: {
    domains: [
      'localhost',
      'walrus.site',
      'walrus-testnet.site',
      'aggregator.walrus-testnet.walrus.space',
      'publisher.walrus-testnet.walrus.space',
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Static page generation timeout
  staticPageGenerationTimeout: 180,
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: false,
  trailingSlash: false,
  
  // Environment variables
  env: {
    NEXT_PUBLIC_ENVIRONMENT: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0',
  },
};

module.exports = nextConfig;