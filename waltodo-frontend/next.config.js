/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'],
    } : false,
  },
  images: {
    domains: ['localhost', '192.168.8.204'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: process.env.PORT || '3000',
      },
      {
        protocol: 'http',
        hostname: '192.168.8.204',
        port: process.env.PORT || '3000',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },
  // Disable standalone output to fix MIME type issues with static assets
  // output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Increase timeout for static generation
  staticPageGenerationTimeout: 180,

  webpack: (config, { isServer, dev, webpack }) => {
    // Fix for node-fetch encoding issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        encoding: false,
      };
    }

    // Performance optimizations
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\/]node_modules[\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          sui: {
            test: /[\/]node_modules[\/]@mysten[\/]/,
            name: 'sui-vendor',
            chunks: 'all',
            priority: 10,
          },
          wallet: {
            test: /[\/]node_modules[\/](@suiet|@solana)[\/]/,
            name: 'wallet-vendor',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    };

    // Tree shaking and dead code elimination
    if (!dev) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Suppress wallet extension console errors during development
    if (dev && !isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          __SUPPRESS_WALLET_ERRORS__: JSON.stringify(true),
        })
      );
    }

    return config;
  },

  // Skip ESLint during builds
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Skip TypeScript checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },

  // Configure runtime to handle client-side operations correctly
  experimental: {
    // Configure server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Remove PPR for compatibility
    // Optimize font loading
    optimizePackageImports: ['@heroicons/react', 'socket.io-client'],
  },

  // Allow development origins (dynamic port support)
  allowedDevOrigins: (function () {
    const port = process.env.PORT || '3000';
    return [`192.168.8.204:${port}`, `localhost:${port}`];
  })(),

  // Define custom headers to help with caching and security
  async headers() {
    return [
      {
        // Apply to all routes except static assets
        source: '/((?!_next/static|favicon.ico).*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
      {
        // Proper caching for static assets
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache API responses
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },

  // Fix for development server restarts
  onDemandEntries: {
    // Keep pages in memory for longer
    maxInactiveAge: 60 * 60 * 1000, // 1 hour
    pagesBufferLength: 5,
  },
};

module.exports = nextConfig;
