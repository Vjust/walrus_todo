/**
 * Configuration for the unified build system
 * This file centralizes all build configuration options
 */

module.exports = {
  // Default build options
  defaults: {
    transpileOnly: false,    // Full type checking in production builds
    skipTypeCheck: false,    // Don't skip type checking by default
    clean: false,            // Don't clean by default
    verbose: false,          // Not verbose by default
    binPermissionFix: true,  // Fix permissions by default
    manifestOnly: false,     // Don't just generate manifest by default
  },
  
  // Build modes with preset configurations
  modes: {
    // Fast development build without type checking
    dev: {
      transpileOnly: true,
      skipTypeCheck: true,
      clean: false,
      verbose: true,
    },

    // Clean mode
    clean: {
      clean: true,
      manifestOnly: true,
    },
    
    // Just generate the manifest
    manifest: {
      manifestOnly: true,
    }
  },
  
  // File paths configuration
  paths: {
    // Directories
    root: process.cwd(),
    src: 'src',
    dist: 'dist',
    bin: 'bin',
    scripts: 'scripts',
    
    // Files
    tsconfig: 'tsconfig.json',
    manifest: 'oclif.manifest.json',
    packageJson: 'package.json',
  },
  
  // Optimization settings
  optimization: {
    cacheEnabled: true,
    incrementalEnabled: true,
    cacheDirectory: '.build-cache',
    parallelLimit: 4, // Number of files to process in parallel
  },
  
  // Error handling configuration
  errors: {
    // Error severity levels
    levels: {
      ERROR: 'error',     // Fatal errors that should stop the build
      WARNING: 'warning', // Non-fatal issues that should be reported
      INFO: 'info',       // Informational messages
    },
    
    // What to do when errors occur
    onError: 'exit',      // 'exit' or 'continue'
    onWarning: 'log',     // 'log' or 'ignore'
    
    // Known error patterns and their classifications
    patterns: [
      { 
        pattern: 'TS2322', 
        level: 'warning',
        message: 'Type compatibility issue - build will continue'
      },
      { 
        pattern: 'TS2307', 
        level: 'warning',
        message: 'Cannot find module - check your imports'
      },
    ]
  }
};