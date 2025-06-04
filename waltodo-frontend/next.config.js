/** @type {import('next').NextConfig} */

// Check if we're building for static export
const isStaticExport = process.env.NEXT_EXPORT === 'true' || process.env.BUILD_MODE === 'static';

// Security headers configuration
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=()'
  }
];

// Content Security Policy
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://vitals.vercel-insights.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https: https://*.walrus.space https://*.sui.io https://vercel.com https://*.vercel.app;
  font-src 'self' https://fonts.gstatic.com data:;
  connect-src 'self' https: wss: https://*.sui.io https://*.walrus.space https://api.suiet.app https://wallet.sui.io https://vercel.live https://vitals.vercel-insights.com;
  media-src 'self' https://*.walrus.space;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  block-all-mixed-content;
  upgrade-insecure-requests;
`;

// Simple Next.js configuration for production build
const nextConfig = {
  reactStrictMode: true,
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\n/g, '')
          }
        ]
      }
    ];
  },
  
  // Static export configuration
  ...(isStaticExport && {
    output: 'export',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    distDir: 'out',
  }),
  
  // Transpile packages that need it (excluding packages in serverExternalPackages)
  transpilePackages: [
    '@mysten/dapp-kit', 
    '@mysten/wallet-standard',
    '@suiet/wallet-sdk', 
    '@wallet-standard/react',
    '@wallet-standard/features',
    '@tanstack/react-query'
  ],
  
  // External packages for server-side (moved from experimental)
  serverExternalPackages: ['@mysten/sui', '@mysten/walrus'],
  
  // ESLint configuration - balanced for development and production
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
    dirs: ['src'],
  },
  
  // TypeScript configuration - balanced for development and production
  typescript: {
    // Allow build errors during development for faster iteration
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
    // Use appropriate config based on environment
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
  
  // Server configuration for Next.js 15
  serverExternalPackages: ['@mysten/sui', '@mysten/walrus'],
  
  // Experimental features for Next.js 15 compatibility
  experimental: {
    // Optimize CSS for production builds
    optimizeCss: true,
    // Optimize package imports for better tree-shaking
    optimizePackageImports: [
      '@mysten/dapp-kit', 
      'lucide-react',
      'recharts',
      'date-fns',
      'framer-motion'
    ],
    // Note: serverComponentsExternalPackages moved to top-level serverExternalPackages
    // Optimize server memory usage
    serverMinification: true,
    // Enable faster refresh in development (turbo mode disabled to prevent loader conflicts)
  },

  // Production and Walrus Sites optimizations
  ...(isStaticExport && {
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
    // Fix for Next.js 15 factory call errors
    config.resolve.fallback = {
      ...config.resolve.fallback,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      util: require.resolve('util'),
      url: require.resolve('url'),
      querystring: require.resolve('querystring-es3'),
      process: require.resolve('process/browser'),
      path: false,
      fs: false,
      net: false,
      tls: false,
    };

    // Provide polyfills for Node.js built-ins
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      })
    );

    // Resolve module issues with packages
    config.resolve.alias = {
      ...config.resolve.alias,
      // Fix for date-fns tree-shaking
      'date-fns': require.resolve('date-fns'),
      // Note: @mysten/sui aliases removed due to serverExternalPackages configuration
    };

    // Module resolution for ESM/CJS compatibility
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.jsx': ['.jsx', '.tsx'],
    };

    // Fix for Dynamic imports and factory calls
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      asyncWebAssembly: true,
      layers: true,
    };

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

    // Tree-shaking optimizations - compatible with Next.js 15
    config.optimization.sideEffects = false;
    config.optimization.usedExports = false; // Disable to prevent conflicts with Next.js 15
    
    // Fix webpack module factory call errors
    config.optimization.moduleIds = 'deterministic';
    config.optimization.chunkIds = 'deterministic';
    config.optimization.providedExports = false; // Prevent factory conflicts
    
    // Add module concatenation for better performance
    config.optimization.concatenateModules = !dev;
    
    // Note: Next.js handles transpilation internally, no need for custom babel-loader

    return config;
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_ENVIRONMENT: process.env.NODE_ENV || 'development',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.1.0',
  },
};

module.exports = nextConfig;