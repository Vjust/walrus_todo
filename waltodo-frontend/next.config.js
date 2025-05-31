/** @type {import('next').NextConfig} */

// Production environment detection
const isProd = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV === 'development';

// Walrus domains configuration
const WALRUS_DOMAINS = [
  'walrus.site',
  'walrus-testnet.site',
  'aggregator.walrus-testnet.walrus.space',
  'publisher.walrus-testnet.walrus.space',
  'walrus-testnet-aggregator.nodes.guru',
  'walrus-testnet-publisher.nodes.guru',
  'walrus-testnet.stakin.com',
];

// CDN configuration
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || '';
const ASSET_PREFIX = isProd && CDN_URL ? CDN_URL : '';

const nextConfig = {
  reactStrictMode: true,
  
  // Production optimizations
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  
  // CDN configuration
  assetPrefix: ASSET_PREFIX,
  
  // Output configuration for production
  output: isProd ? 'standalone' : undefined,
  distDir: '.next',
  
  // Transpile packages that need it
  transpilePackages: ['@mysten/dapp-kit', '@suiet/wallet-sdk', '@wallet-standard/react'],
  
  // Enable static optimization
  ...(isProd && {
    experimental: {
      optimizeFonts: true,
      optimizeImages: true,
      scrollRestoration: true,
    },
  }),
  
  // API proxy configuration for development
  async rewrites() {
    // Only apply rewrites in development
    if (process.env.NODE_ENV !== 'development') {
      return [
        // PWA share target
        {
          source: '/share-target',
          destination: '/api/share-target',
        },
      ];
    }
    
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*',
      },
      {
        source: '/healthz',
        destination: 'http://localhost:3001/healthz',
      },
      {
        source: '/health',
        destination: 'http://localhost:3001/health',
      },
      // PWA share target
      {
        source: '/share-target',
        destination: '/api/share-target',
      },
    ];
  },
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  
  images: {
    domains: [
      'localhost',
      '192.168.8.204',
      ...WALRUS_DOMAINS,
      // Add your production domain
      process.env.NEXT_PUBLIC_APP_DOMAIN || 'waltodo.app',
    ].filter(Boolean),
    remotePatterns: [
      // Development patterns
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
      // Walrus patterns
      ...WALRUS_DOMAINS.map(domain => ({
        protocol: 'https',
        hostname: domain,
      })),
      // Production CDN
      ...(CDN_URL ? [{
        protocol: 'https',
        hostname: new URL(CDN_URL).hostname,
      }] : []),
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: isProd ? 86400 : 3600, // 24h in production, 1h in dev
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    loader: CDN_URL ? 'custom' : 'default',
    loaderFile: CDN_URL ? './src/lib/image-loader.js' : undefined,
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
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        util: require.resolve('util'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        path: false,
        os: false,
        http: false,
        https: false,
        child_process: false,
        worker_threads: false,
        // Additional polyfills for Sui SDK and wallet libraries
        url: require.resolve('url/'),
        assert: require.resolve('assert/'),
        zlib: require.resolve('browserify-zlib'),
        querystring: require.resolve('querystring-es3'),
        events: require.resolve('events/'),
        vm: false,
        constants: require.resolve('constants-browserify'),
      };
      
      // Ignore specific warnings for browser builds
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        // Ignore warnings about missing Node.js modules in browser builds
        /Critical dependency: the request of a dependency is an expression/,
        /Module not found: Can't resolve 'encoding'/,
        /Module not found: Can't resolve 'bufferutil'/,
        /Module not found: Can't resolve 'utf-8-validate'/,
      ];
    }

    // Fix module resolution conflicts
    config.resolve.modules = [
      'node_modules',
    ];

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
      // Enable side effects for wallet libraries to prevent call errors
      config.optimization.sideEffects = false;
    }

    // Define environment variables consistently for server and client
    config.plugins.push(
      new webpack.DefinePlugin({
        __SUPPRESS_WALLET_ERRORS__: JSON.stringify(dev),
        __IS_SERVER__: JSON.stringify(isServer),
        __IS_DEV__: JSON.stringify(dev),
      })
    );

    // Add ProvidePlugin for browser compatibility
    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
          global: require.resolve('./src/lib/global-polyfill.js'),
        })
      );
    }

    // Consolidate module resolution to prevent conflicts
    config.resolve.alias = {
      ...config.resolve.alias,
      // Fix get-port version conflicts
      'get-port': require.resolve('get-port'),
      // Add aliases for common Node.js modules used by blockchain libraries
      'node:crypto': require.resolve('crypto-browserify'),
      'node:stream': require.resolve('stream-browserify'),
      'node:buffer': require.resolve('buffer'),
      'node:util': require.resolve('util'),
      'node:process': require.resolve('process/browser'),
      'node:events': require.resolve('events/'),
    };

    return config;
  },

  // Enable ESLint during builds
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Enable TypeScript checking during builds
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configure runtime to handle client-side operations correctly
  experimental: {
    // Configure server actions
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: isProd ? [
        process.env.NEXT_PUBLIC_APP_URL || 'https://waltodo.app',
        ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
      ] : undefined,
    },
    // Optimize font loading
    optimizePackageImports: ['@heroicons/react', 'socket.io-client', '@mysten/dapp-kit', '@mysten/sui'],
    // Production optimizations
    optimizeCss: isProd,
    gzipSize: isProd,
    craCompat: false,
    esmExternals: true,
    // Enable strict hydration checking in development
    strictNextHead: isDev,
    // Memory optimizations
    workerThreads: isProd,
    cpus: isProd ? 4 : 1,
  },
  
  // External packages for server components (moved out of experimental)
  serverExternalPackages: ['@mysten/walrus'],

  // Turbopack configuration (Turbopack is now stable in Next.js 15)
  // For now, using empty config until we need specific turbopack settings
  // turbopack: {},

  // Allow development origins (dynamic port support)
  allowedDevOrigins: (function () {
    const port = process.env.PORT || '3000';
    return [`192.168.8.204:${port}`, `localhost:${port}`, 'localhost:3001'];
  })(),

  // Define custom headers to help with caching and security
  async headers() {
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'X-Frame-Options',
        value: 'SAMEORIGIN',
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block',
      },
      {
        key: 'Referrer-Policy',
        value: 'origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
      },
      {
        key: 'Content-Security-Policy',
        value: isProd
          ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' *.walrus.site *.walrus.space; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: *.walrus.site *.walrus.space; font-src 'self' data:; connect-src 'self' wss: https: *.walrus.site *.walrus.space *.sui.io; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
          : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; font-src 'self' data:; connect-src 'self' ws: wss: http: https:;",
      },
    ];

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Static assets - long cache
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        // Images - moderate cache with revalidation
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // API routes - short cache
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-cache, no-store, must-revalidate'
              : 'public, max-age=60, stale-while-revalidate=300',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        // Walrus content
        source: '/walrus/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        // Font files
        source: '/:all*(woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Service Worker
        source: '/service-worker.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // PWA Manifest
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
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
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0',
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'local',
  },
  
  // Production build optimizations
  ...(isProd && {
    productionBrowserSourceMaps: false,
    modularizeImports: {
      '@heroicons/react/24/outline': {
        transform: '@heroicons/react/24/outline/{{member}}',
      },
      '@heroicons/react/24/solid': {
        transform: '@heroicons/react/24/solid/{{member}}',
      },
      'lodash': {
        transform: 'lodash/{{member}}',
      },
    },
  }),

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
