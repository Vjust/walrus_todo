#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');

// Fast port checker without external dependencies
async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

async function getAvailablePort(preferredPorts = [3000, 3001, 3002, 3003, 3004, 3005]) {
  // Check preferred ports first
  for (const port of preferredPorts) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  
  // If no preferred port is available, find a random one
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function startWithAvailablePort() {
  try {
    const startTime = Date.now();
    
    // Try to use cached port from previous run if available
    const preferredPort = process.env.PREFERRED_PORT ? parseInt(process.env.PREFERRED_PORT) : 3000;
    const preferredPorts = [preferredPort, 3000, 3001, 3002, 3003, 3004, 3005].filter((p, i, arr) => arr.indexOf(p) === i);
    
    // Find an available port
    const port = await getAvailablePort(preferredPorts);
    
    const portCheckTime = Date.now() - startTime;
    console.log(`✅ Port ${port} available (checked in ${portCheckTime}ms)`);
    
    // Set the PORT environment variable
    process.env.PORT = port.toString();
    
    // Resolve the path to Next.js CLI
    const nextPath = require.resolve('next/dist/bin/next');
    
    // Optimize Next.js startup with additional flags
    const nextArgs = [nextPath, process.argv[2] || 'dev'];
    
    // Add turbo mode for faster dev builds if supported
    if (process.argv[2] === 'dev') {
      // Check if experimental turbo is available (Next.js 13+)
      try {
        const nextConfig = require('../next.config.js');
        if (!nextConfig.experimental?.turbo === false) {
          nextArgs.push('--turbo');
        }
      } catch (e) {
        // Ignore if config can't be loaded
      }
    }
    
    // Start the Next.js server with the available port
    const nextProcess = spawn(process.execPath, nextArgs, {
      stdio: 'inherit',
      env: { 
        ...process.env, 
        PORT: port.toString(),
        // Optimize memory usage
        NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=4096',
        // Disable telemetry for faster startup
        NEXT_TELEMETRY_DISABLED: '1',
      }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server gracefully...');
      nextProcess.kill('SIGINT');
      setTimeout(() => {
        process.exit(0);
      }, 100);
    });
    
    process.on('SIGTERM', () => {
      nextProcess.kill('SIGTERM');
      process.exit(0);
    });
    
    nextProcess.on('close', (code) => {
      process.exit(code || 0);
    });
    
    // Log successful startup
    nextProcess.on('spawn', () => {
      console.log(`\n🌐 Next.js server starting on http://localhost:${port}\n`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startWithAvailablePort();