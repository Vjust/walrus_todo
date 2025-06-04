#!/usr/bin/env node

/**
 * Development server wrapper with optimized startup
 * Usage: 
 *   node dev-with-cache-clear.js [--no-cache] [--no-setup] [--fast] [--no-browser]
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  noCache: args.includes('--no-cache'),
  noSetup: args.includes('--no-setup'),
  fast: args.includes('--fast'),
  noBrowser: args.includes('--no-browser'),
};

// Fast mode implies no-cache, no-setup, and no-browser
if (flags.fast) {
  flags.noCache = true;
  flags.noSetup = true;
  flags.noBrowser = true;
}

// Environment variable overrides
const AUTO_CLEAR_BROWSER = !flags.noBrowser && process.env.AUTO_CLEAR_BROWSER !== 'false';
const SKIP_CACHE_CLEAR = flags.noCache || process.env.SKIP_CACHE_CLEAR === 'true';
const SKIP_SETUP = flags.noSetup || process.env.SKIP_SETUP === 'true';

async function clearCaches() {
  if (SKIP_CACHE_CLEAR) {
    console.log('⚡ Skipping cache clear for faster startup...\n');
    return;
  }
  
  console.log('🧹 Clearing caches...\n');
  
  // First run the cache clearing script
  const clearCacheScript = path.join(__dirname, 'clear-dev-cache.js');
  await new Promise((resolve) => {
    const clear = spawn('node', [clearCacheScript], {
      stdio: 'inherit'
    });
    clear.on('close', resolve);
  });
}

async function setupConfig() {
  if (SKIP_SETUP) {
    console.log('⚡ Skipping configuration setup...\n');
    return;
  }
  
  console.log('📋 Setting up configuration...\n');
  await new Promise((resolve) => {
    const setup = spawn('node', ['setup-config.js'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    setup.on('close', resolve);
  });
}

async function startDevServer() {
  // Start mode message
  if (flags.fast) {
    console.log('🚀 Starting Next.js in FAST mode (minimal setup)...\n');
  } else {
    console.log('🚀 Starting Next.js development server...\n');
  }
  
  const startScript = path.join(__dirname, 'start-with-available-port.js');
  
  const devServer = spawn('node', [startScript, 'dev'], {
    stdio: 'inherit',
    env: { 
      ...process.env,
      // Pass performance flags to Next.js
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: '--max-old-space-size=4096',
    }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    devServer.kill('SIGINT');
    process.exit();
  });
  
  process.on('SIGTERM', () => {
    devServer.kill('SIGTERM');
    process.exit();
  });
  
  return devServer;
}

// Main execution
(async () => {
  try {
    const startTime = Date.now();
    
    // Run setup tasks in parallel when not in fast mode
    if (!flags.fast) {
      await Promise.all([
        clearCaches(),
        setupConfig(),
      ]);
    }
    
    await startDevServer();
    
    const setupTime = Date.now() - startTime;
    console.log(`\n✅ Development server started in ${(setupTime / 1000).toFixed(1)}s\n`);
    
    // Print helpful information
    console.log('📝 Available flags:');
    console.log('  --fast        Skip all setup steps for fastest startup');
    console.log('  --no-cache    Skip cache clearing');
    console.log('  --no-setup    Skip configuration setup');
    console.log('  --no-browser  Don\'t open browser\n');
    
  } catch (error) {
    console.error('❌ Error starting development server:', error);
    process.exit(1);
  }
})();