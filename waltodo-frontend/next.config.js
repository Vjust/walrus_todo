/** @type {import('next').NextConfig} */

// Check if we're building for static export
const isStaticExport = process.env.NEXT_EXPORT === 'true' || process.env.BUILD_MODE === 'static';

// Simple Next.js configuration for production build
const nextConfig = {
  reactStrictMode: true,
  
  // Static export configuration
  ...(isStaticExport && {
    output: 'export',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    distDir: 'out',
  }),
  
  // Transpile packages that need it
  transpilePackages: ['@mysten/dapp-kit', '@suiet/wallet-sdk', '@wallet-standard/react'],
  
  // ESLint configuration - enforce strict linting with zero tolerance
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', '__tests__'],
    // Fail build on any ESLint errors
  },
  
  // TypeScript configuration - strict type checking always enforced
  typescript: {
    // Never ignore build errors - enforce type safety
    ignoreBuildErrors: false,
    // Use development config for less strict checking during development
    tsconfigPath: process.env.NODE_ENV === 'production' ? './tsconfig.json' : './tsconfig.dev.json',
  },
  
  // Image configuration for Walrus domains
  images: {
    // Disable optimized images for static export
    unoptimized: isStaticExport,
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
  trailingSlash: isStaticExport,
  
  // Production and Walrus Sites optimizations
  ...(isStaticExport && {
    // Disable server-side features for static export
    experimental: {
      optimizeCss: true,
      optimizePackageImports: [
        '@mysten/dapp-kit', 
        '@mysten/sui', 
        'lucide-react',
        'recharts',
        'date-fns',
        'framer-motion'
      ],
    },
    // Asset prefix for relative paths
    assetPrefix: '',
    basePath: '',
  }),
  
  // Performance optimizations
  compiler: {
    // Temporarily disable console removal to debug build issues
    removeConsole: false,
  },
  
  // Webpack optimizations for production
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize bundle splitting
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 1,
            reuseExistingChunk: true,
          },
          // Separate chart libraries
          charts: {
            test: /[\\/]node_modules[\\/](recharts|d3-)/,
            chunks: 'all',
            priority: 3,
            name: 'charts',
            reuseExistingChunk: true,
          },
          // Separate blockchain libraries
          blockchain: {
            test: /[\\/]node_modules[\\/](@mysten|@wallet-standard)/,
            chunks: 'all',
            priority: 4,
            name: 'blockchain',
            reuseExistingChunk: true,
          },
          // Separate UI libraries
          ui: {
            test: /[\\/]node_modules[\\/](framer-motion|lucide-react|react-transition-group)/,
            chunks: 'all',
            priority: 2,
            name: 'ui',
            reuseExistingChunk: true,
          },
          // Common utilities
          utils: {
            test: /[\\/]node_modules[\\/](date-fns|fuse\.js|nanoid|zustand)/,
            chunks: 'all',
            priority: 2,
            name: 'utils',
            reuseExistingChunk: true,
          },
        },
      };
    }

    // Tree-shaking optimizations
    config.optimization.usedExports = true;
    config.optimization.sideEffects = false;

    // Module resolution optimizations
    config.resolve.alias = {
      ...config.resolve.alias,
      // Ensure proper tree-shaking for date-fns
      'date-fns': require.resolve('date-fns'),
    };

    return config;
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_ENVIRONMENT: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0',
  },
};

module.exports = nextConfig;