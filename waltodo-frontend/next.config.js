/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Enable proper hydration handling
  poweredByHeader: false,
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
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
  
  // SWC minification is now enabled by default in Next.js 13+
  
  // Configure proper development/production settings for hydration
  trailingSlash: false,
  generateEtags: false,

  webpack: (config, { isServer, dev, webpack }) => {
    // Fix for node-fetch encoding issue and prevent hydration mismatches
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        encoding: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        process: false,
      };
    }

    // Performance optimizations with hydration safety
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

    // Tree shaking and dead code elimination (careful with side effects for SSR)
    if (!dev) {
      config.optimization.usedExports = true;
      // Be more conservative with side effects to prevent hydration issues
      config.optimization.sideEffects = [
        '*.css',
        '*.scss',
        '*.sass',
        '*.less',
        '*.stylus'
      ];
    }

    // Define environment variables consistently for server and client
    config.plugins.push(
      new webpack.DefinePlugin({
        __SUPPRESS_WALLET_ERRORS__: JSON.stringify(dev),
        __IS_SERVER__: JSON.stringify(isServer),
        __IS_DEV__: JSON.stringify(dev),
      })
    );

    // Prevent module resolution issues that can cause hydration mismatches
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ensure consistent module resolution
        'react': require.resolve('react'),
        'react-dom': require.resolve('react-dom'),
      };
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
    // Optimize font loading
    optimizePackageImports: ['@heroicons/react', 'socket.io-client'],
    // Enable optimizations that don't affect hydration
    optimizeCss: false, // Disable CSS optimization that can cause hydration issues
    turbo: {
      // Configure Turbopack for better hydration handling (if using turbo mode)
      loaders: {
        '.svg': ['@svgr/webpack'],
      },
    },
    // Disable features that can cause hydration mismatches
    serverComponentsExternalPackages: ['@mysten/sui', '@mysten/walrus'],
    // Enable strict hydration checking in development
    strictNextHead: process.env.NODE_ENV === 'development',
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

  // Environment variable handling for consistent SSR/CSR behavior
  env: {
    NEXT_PUBLIC_ENVIRONMENT: process.env.NODE_ENV || 'development',
  },

  // Ensure consistent behavior across server and client
  serverRuntimeConfig: {
    // Will only be available on the server side
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    NODE_ENV: process.env.NODE_ENV,
  },
};

module.exports = nextConfig;
