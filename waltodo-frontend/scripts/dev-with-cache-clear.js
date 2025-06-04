#!/usr/bin/env node

/**
 * Development server wrapper that clears caches before starting
 * and optionally opens a browser tab to clear service workers
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if we should auto-open browser to clear caches
const AUTO_CLEAR_BROWSER = process.env.AUTO_CLEAR_BROWSER !== 'false';

async function clearCaches() {
  console.log('🚀 Starting WalTodo development server with cache clearing...\n');
  
  // First run the cache clearing script
  const clearCacheScript = path.join(__dirname, 'clear-dev-cache.js');
  await new Promise((resolve) => {
    const clear = spawn('node', [clearCacheScript], {
      stdio: 'inherit'
    });
    clear.on('close', resolve);
  });
}

async function openCacheClearPage(port) {
  if (!AUTO_CLEAR_BROWSER) {
    console.log('ℹ️  Skipping browser cache clear (AUTO_CLEAR_BROWSER=false)\n');
    return;
  }

  const url = `http://localhost:${port}/_dev-clear-cache.html`;
  console.log('🌐 Opening browser to clear service worker caches...\n');
  
  // Detect platform and open browser
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.warn('⚠️  Could not auto-open browser. Please manually clear browser cache if needed.\n');
    }
  });
}

async function startDevServer() {
  // Run the setup config first
  console.log('📋 Setting up configuration...\n');
  await new Promise((resolve) => {
    const setup = spawn('node', ['setup-config.js'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    setup.on('close', resolve);
  });
  
  // Start the dev server with port detection
  console.log('🚀 Starting Next.js development server...\n');
  const startScript = path.join(__dirname, 'start-with-available-port.js');
  
  const devServer = spawn('node', [startScript, 'dev'], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  // Wait a bit for server to start, then open cache clear page
  setTimeout(() => {
    // Try to detect which port was used
    const ports = [3000, 3001, 3002];
    for (const port of ports) {
      fetch(`http://localhost:${port}`)
        .then(() => {
          openCacheClearPage(port);
        })
        .catch(() => {});
    }
  }, 3000);
  
  // Handle process termination
  process.on('SIGINT', () => {
    devServer.kill('SIGINT');
    process.exit();
  });
  
  process.on('SIGTERM', () => {
    devServer.kill('SIGTERM');
    process.exit();
  });
}

// Main execution
(async () => {
  try {
    await clearCaches();
    await startDevServer();
  } catch (error) {
    console.error('❌ Error starting development server:', error);
    process.exit(1);
  }
})();