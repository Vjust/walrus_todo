/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { isServer }) => {
    // Fix for node-fetch encoding issue
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        encoding: false,
      };
      
      // Ensure all chunks are properly included
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Important: Create a main chunk for core functionality
          commons: {
            name: 'commons',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 10,
          },
          // Put react and related packages in a dedicated chunk
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-subscription)[\\/]/,
            chunks: 'all',
            priority: 20,
          },
        },
      };
    }
    
    return config;
  },
  
  // IMPORTANT: Configure runtime to handle client-side operations correctly
  // This helps prevent the "Access to storage is not allowed from this context" errors
  experimental: {
    // Configure server actions
    serverActions: {
      // Ensure server actions are working properly
      bodySizeLimit: '2mb',
    },
  },
  
  // Define custom headers to help with caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
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
    ];
  },
}

module.exports = nextConfig