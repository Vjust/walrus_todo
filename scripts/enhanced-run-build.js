#!/usr/bin/env node

// Simple logger for build script
const logger = {
  info: msg => console.log(msg),
  error: msg => console.error(msg),
  warn: msg => console.warn(msg),
};

/**
 * Enhanced build script for waltodo CLI
 * Provides a unified interface for all build operations with better error handling
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const buildConfig = require('./unified-build-config');

// ANSI color codes for nice output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Print a colored message
function print(color, message) {
  logger.info(`${colors[color]}${message}${colors.reset}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { ...buildConfig.defaults };

  // Check for predefined modes
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  if (modeArg) {
    const mode = modeArg.split('=')[1];
    if (buildConfig.modes && buildConfig.modes[mode]) {
      Object.assign(options, buildConfig.modes[mode]);
      print('blue', `Using predefined build mode: ${mode}`);
    } else {
      print('yellow', `Unknown build mode: ${mode}, using defaults`);
    }
  }

  // Process individual args
  args.forEach(arg => {
    if (arg === '--transpile-only') {
      options.transpileOnly = true;
    } else if (arg === '--no-transpile-only') {
      options.transpileOnly = false;
    } else if (arg === '--type-check') {
      options.skipTypeCheck = false;
      options.transpileOnly = false;
    } else if (arg === '--no-type-check' || arg === '--skip-typecheck') {
      options.skipTypeCheck = true;
    } else if (arg === '--clean') {
      options.clean = true;
    } else if (arg === '--clean-only') {
      options.clean = true;
      options.manifestOnly = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--manifest-only') {
      options.manifestOnly = true;
    } else if (arg === '--no-fix-permissions') {
      options.binPermissionFix = false;
    } else if (arg === '--fix-permissions') {
      options.binPermissionFix = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  });

  return options;
}

// Display help information
function printHelp() {
  print('magenta', 'Waltodo Build System - Available Options:');
  logger.info(`
  Build Modes:
    --mode=dev        Fast build for development
    --mode=prod       Production build with full type checking
    --mode=full       Full clean build with type checking
    --mode=clean      Just clean the output directory
    --mode=manifest   Just generate the manifest
  
  Individual Options:
    --transpile-only  Skip type checking (faster build)
    --no-transpile-only | --type-check  
                      Perform full type checking
    --clean           Clean dist directory before build
    --clean-only      Only clean dist directory, don't build
    --verbose         Show detailed build information
    --manifest-only   Only update the manifest file
    --fix-permissions Fix executable permissions for bin files
    --no-fix-permissions  
                      Skip fixing permissions
    
  Examples:
    node scripts/enhanced-run-build.js --mode=dev       
    node scripts/enhanced-run-build.js --clean --transpile-only
    node scripts/enhanced-run-build.js --mode=clean
  `);
}

// Run the TypeScript build script with appropriate options
function runBuild(options) {
  print('magenta', 'Starting build process...');
  print('blue', 'Build configuration:');
  Object.entries(options).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });

  // Map our options to the ts-node arguments
  const tsNodeArgs = ['scripts/unified-build.ts'];

  if (options.transpileOnly) {
    tsNodeArgs.push('--transpile-only');
  }

  if (options.skipTypeCheck) {
    tsNodeArgs.push('--skip-typecheck');
  }

  if (options.clean) {
    tsNodeArgs.push('--clean');
  }

  if (options.verbose) {
    tsNodeArgs.push('--verbose');
  }

  if (options.manifestOnly) {
    tsNodeArgs.push('--manifest-only');
  }

  if (options.binPermissionFix) {
    tsNodeArgs.push('--fix-permissions');
  } else {
    tsNodeArgs.push('--no-fix-permissions');
  }

  print('blue', `Running: npx ts-node ${tsNodeArgs.join(' ')}`);
  console.time('Build completed in');

  try {
    // Run the build script
    const result = spawnSync('npx', ['ts-node', ...tsNodeArgs], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    console.timeEnd('Build completed in');

    if (result.status !== 0) {
      print('red', 'Build failed!');
      return false;
    }

    print('green', 'Build completed successfully!');
    return true;
  } catch (error) {
    print('red', `Error running build: ${error.message}`);
    console.timeEnd('Build completed in');
    return false;
  }
}

// Fix permissions for bin and script files
function fixPermissions() {
  print('blue', 'Fixing file permissions...');

  try {
    const fixResult = spawnSync('node', ['scripts/fix-permissions.js'], {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..'),
    });

    if (fixResult.status !== 0) {
      print('yellow', 'Warning: Permission fix script failed');
      return false;
    }

    return true;
  } catch (error) {
    print('yellow', `Warning: Error running permission fix: ${error.message}`);
    return false;
  }
}

// Create or update the OCLIF manifest file
function updateManifest() {
  print('blue', 'Updating OCLIF manifest...');

  const manifestPath = path.join(
    path.resolve(__dirname, '..'),
    buildConfig.paths.manifest
  );
  const generateScript = path.join(
    path.resolve(__dirname, '..'),
    'scripts/generate-manifest.js'
  );

  try {
    if (fs.existsSync(generateScript)) {
      // Run the improved manifest generator script
      print('blue', 'Running improved manifest generator...');

      const result = spawnSync('node', [generateScript], {
        stdio: 'inherit',
        shell: true,
        cwd: path.resolve(__dirname, '..'),
      });

      if (result.status !== 0) {
        print(
          'yellow',
          'Warning: Manifest generator script failed, using fallback method'
        );
        // Create an empty manifest file if it doesn't exist
        if (!fs.existsSync(manifestPath)) {
          fs.writeFileSync(manifestPath, '{}', 'utf8');
        } else {
          // Touch the file (update timestamp) if it already exists
          const now = new Date();
          fs.utimesSync(manifestPath, now, now);
        }
      }
    } else {
      print(
        'yellow',
        'Warning: Improved manifest generator not found, using fallback method'
      );
      // Create an empty manifest file if it doesn't exist
      if (!fs.existsSync(manifestPath)) {
        fs.writeFileSync(manifestPath, '{}', 'utf8');
      } else {
        // Touch the file (update timestamp) if it already exists
        const now = new Date();
        fs.utimesSync(manifestPath, now, now);
      }
    }

    print('green', 'Manifest file updated successfully');
    return true;
  } catch (error) {
    print(
      'yellow',
      `Warning: Failed to update manifest file: ${error.message}`
    );
    return false;
  }
}

// Clean the dist directory
function cleanDist() {
  print('blue', 'Cleaning dist directory...');

  const distPath = path.join(
    path.resolve(__dirname, '..'),
    buildConfig.paths.dist
  );

  if (fs.existsSync(distPath)) {
    try {
      fs.rmSync(distPath, { recursive: true, force: true });
      print('green', 'Dist directory cleaned successfully');
      return true;
    } catch (error) {
      print('red', `Error cleaning dist directory: ${error.message}`);
      return false;
    }
  } else {
    print('gray', 'Dist directory does not exist, skipping clean');
    return true;
  }
}

// Main function to orchestrate the build process
function main() {
  // Parse command line arguments
  const options = parseArgs();

  // Handle --clean-only separately
  if (options.clean && options.manifestOnly) {
    const cleanResult = cleanDist();
    const manifestResult = updateManifest();

    if (cleanResult && manifestResult) {
      print('green', 'Clean operation completed successfully');
      process.exit(0);
    } else {
      print('red', 'Clean operation failed');
      process.exit(1);
    }
    return;
  }

  // Handle --manifest-only separately
  if (options.manifestOnly) {
    if (updateManifest()) {
      print('green', 'Manifest operation completed successfully');
      process.exit(0);
    } else {
      print('red', 'Manifest operation failed');
      process.exit(1);
    }
    return;
  }

  // Clean if requested
  if (options.clean) {
    if (!cleanDist()) {
      print('red', 'Clean operation failed, aborting build');
      process.exit(1);
    }
  }

  // Run the build
  const buildSuccess = runBuild(options);

  // Fix permissions if requested
  if (buildSuccess && options.binPermissionFix) {
    fixPermissions();
  }

  // Update manifest
  updateManifest();

  // Return appropriate exit code
  if (!buildSuccess) {
    print('red', 'Build process failed');
    process.exit(1);
  }

  print('green', 'Build process completed successfully');
}

// Run the main function
main();
