#!/usr/bin/env node

const { spawn } = require('child_process');
const { default: getPort } = require('get-port');

async function startWithAvailablePort() {
  try {
    // Find an available port starting from 3000
    const port = await getPort({ port: [3000, 3001, 3002, 3003, 3004, 3005] });
    
    console.log(`🚀 Starting Next.js server on available port: ${port}`);
    
    // Set the PORT environment variable
    process.env.PORT = port.toString();
    
    // Resolve the path to Next.js CLI
    const nextPath = require.resolve('next/dist/bin/next');
    
    // Start the Next.js server with the available port
    const nextProcess = spawn(process.execPath, [nextPath, process.argv[2] || 'dev'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: port.toString() }
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      nextProcess.kill('SIGINT');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      nextProcess.kill('SIGTERM');
      process.exit(0);
    });
    
    nextProcess.on('close', (code) => {
      process.exit(code);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startWithAvailablePort();