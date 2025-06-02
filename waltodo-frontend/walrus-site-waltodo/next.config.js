/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('build');

const nextConfig = {
  // Only use static export for production builds (Next.js 14.x syntax)
  ...(isProduction && {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
  }),
  
  // Image optimization settings for static export compatibility
  images: {
    unoptimized: true, // Required for static export
    domains: [
      'aggregator-testnet.walrus.space',
      'walrus.space',
    ],
  },
  
  // SSR-safe webpack configuration
  webpack: (config, { isServer }) => {
    // Handle browser-only modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    return config;
  },
  
  // Compiler options for better performance
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  // Environment variables that are safe for browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'TodoNFT',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '1.0.0',
  },
  
  // Build-time error handling
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enable strict mode for better SSR compatibility
  reactStrictMode: true,
  
  // PWA and caching headers (only for dev/non-export builds)
  ...(!isProduction && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin',
            },
          ],
        },
        {
          source: '/service-worker.js',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=0, must-revalidate',
            },
          ],
        },
        {
          source: '/manifest.json',
          headers: [
            {
              key: 'Cache-Control',
              value: 'public, max-age=31536000, immutable',
            },
          ],
        },
      ];
    },
  }),
};

module.exports = nextConfig;