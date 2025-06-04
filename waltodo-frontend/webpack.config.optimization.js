/**
 * Webpack optimization configuration for production builds
 * Separates concerns for better maintainability and performance tuning
 */

// Try to load TerserPlugin if available, otherwise use webpack's built-in
let TerserPlugin;
try {
  TerserPlugin = require('terser-webpack-plugin');
} catch (e) {
  // Use webpack's built-in TerserPlugin if the package is not installed
  TerserPlugin = null;
}

function getOptimizationConfig(webpack, isProduction) {
  return {
    // Runtime chunk optimization
    runtimeChunk: {
      name: 'runtime',
    },
    
    // Module and chunk IDs
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    
    // Enable all optimizations in production
    minimize: true,
    minimizer: TerserPlugin ? [
      new TerserPlugin({
        terserOptions: {
          parse: {
            ecma: 8,
          },
          compress: {
            ecma: 5,
            warnings: false,
            comparisons: false,
            inline: 2,
            drop_console: isProduction,
            drop_debugger: true,
            pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
            passes: 2,
            toplevel: true,
            pure_getters: true,
            hoist_funs: true,
            hoist_vars: false,
            if_return: true,
            join_vars: true,
            reduce_vars: true,
            side_effects: true,
            unused: true,
            dead_code: true,
          },
          mangle: {
            safari10: true,
            toplevel: true,
          },
          format: {
            ecma: 5,
            safari10: true,
            comments: false,
            ascii_only: true,
          },
        },
        parallel: true,
        extractComments: false,
      }),
    ] : [
      // Use webpack 5's built-in terser plugin (default minimizer)
      // Will be automatically configured by webpack when minimize: true
    ],
    
    // Advanced chunk splitting strategy
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      maxSize: 244000,
      cacheGroups: {
        // React and core framework
        framework: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
          name: 'framework',
          priority: 40,
          reuseExistingChunk: true,
          enforce: true,
        },
        
        // Next.js internals
        nextjs: {
          test: /[\\/]node_modules[\\/](next|@next)[\\/]/,
          name: 'nextjs',
          priority: 35,
          reuseExistingChunk: true,
        },
        
        // Blockchain libraries - heavyweight, separate bundle
        blockchain: {
          test: /[\\/]node_modules[\\/](@mysten|@wallet-standard|@suiet|@scallop-io)[\\/]/,
          name: 'blockchain',
          priority: 30,
          reuseExistingChunk: true,
          enforce: true,
        },
        
        // UI components and animation libraries
        ui: {
          test: /[\\/]node_modules[\\/](framer-motion|@radix-ui|lucide-react|react-transition-group|@headlessui)[\\/]/,
          name: 'ui',
          priority: 25,
          reuseExistingChunk: true,
        },
        
        // Chart and visualization libraries
        charts: {
          test: /[\\/]node_modules[\\/](recharts|d3-|victory-)[\\/]/,
          name: 'charts',
          priority: 20,
          reuseExistingChunk: true,
        },
        
        // State management and data fetching
        data: {
          test: /[\\/]node_modules[\\/](zustand|@tanstack[\\/]react-query|swr|axios)[\\/]/,
          name: 'data',
          priority: 20,
          reuseExistingChunk: true,
        },
        
        // Utility libraries
        utils: {
          test: /[\\/]node_modules[\\/](date-fns|fuse\.js|nanoid|uuid|lodash|clsx|classnames)[\\/]/,
          name: 'utils',
          priority: 15,
          reuseExistingChunk: true,
        },
        
        // Polyfills and compatibility
        polyfills: {
          test: /[\\/]node_modules[\\/](core-js|regenerator-runtime|@babel[\\/]runtime|buffer|process|crypto-browserify|stream-browserify)[\\/]/,
          name: 'polyfills',
          priority: 30,
          reuseExistingChunk: true,
          enforce: true,
        },
        
        // Default vendor chunk for remaining modules
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            // Get package name for better caching
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendor-${packageName.replace('@', '').replace('/', '-')}`;
          },
          priority: 10,
          reuseExistingChunk: true,
          minChunks: 2,
        },
        
        // Common modules shared between pages
        common: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
          enforce: true,
        },
        
        // Async chunks optimization
        async: {
          test: /[\\/]src[\\/]/,
          chunks: 'async',
          priority: 1,
          reuseExistingChunk: true,
          minChunks: 2,
        },
      },
    },
    
    // Tree shaking and dead code elimination
    usedExports: true,
    sideEffects: false,
    providedExports: true,
    innerGraph: true,
    
    // Module concatenation (scope hoisting)
    concatenateModules: true,
    
    // Remove empty chunks
    removeEmptyChunks: true,
    
    // Merge duplicate chunks
    mergeDuplicateChunks: true,
    
    // Flag chunks as loaded when parent is loaded
    flagIncludedChunks: true,
    
    // Determine used exports for each module
    usedExports: true,
    
    // Generate records for consistent module/chunk ids
    recordsPath: isProduction ? undefined : '.next/records.json',
    
    // Performance hints
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
}

module.exports = {
  getOptimizationConfig,
};