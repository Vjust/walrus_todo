/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

  // Configure runtime to handle client-side operations correctly
  experimental: {
    // Configure server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
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
