#!/usr/bin/env node

/**
 * WalTodo API Server Startup Script
 * This script fixes the critical gap where the API server was never started
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const API_DIR = path.join(__dirname, 'apps', 'api');

async function main() {
  console.log('🚀 Starting WalTodo API Server...');
  
  // Check if API directory exists
  if (!fs.existsSync(API_DIR)) {
    console.error('❌ API directory not found:', API_DIR);
    process.exit(1);
  }
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const isDev = args.includes('--dev') || process.env.NODE_ENV === 'development';
  const portArg = args.find(arg => arg.startsWith('--port='));
  
  console.log(`📦 Environment: ${isDev ? 'development' : 'production'}`);
  
  try {
    // Check if dependencies are installed
    const nodeModulesPath = path.join(API_DIR, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('📥 Installing API dependencies...');
      await runCommand('pnpm', ['install'], API_DIR);
    }
    
    // Build if production
    if (!isDev) {
      console.log('🔨 Building API...');
      await runCommand('pnpm', ['build'], API_DIR);
    }
    
    // Start server
    const command = isDev ? 'dev' : 'start';
    const startArgs = [command];
    
    if (portArg) {
      startArgs.push(portArg);
    }
    
    console.log(`🌟 Starting API server in ${isDev ? 'development' : 'production'} mode...`);
    await runCommand('pnpm', startArgs, API_DIR, { inherit: true });
    
  } catch (error) {
    console.error('❌ Failed to start API server:', error.message);
    process.exit(1);
  }
}

function runCommand(command, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    const stdio = options.inherit ? 'inherit' : 'pipe';
    const child = spawn(command, args, { 
      cwd, 
      stdio,
      shell: process.platform === 'win32'
    });
    
    if (!options.inherit) {
      child.stdout?.on('data', (data) => process.stdout.write(data));
      child.stderr?.on('data', (data) => process.stderr.write(data));
    }
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down API server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down API server...');
  process.exit(0);
});

main().catch(error => {
  console.error('💥 Startup failed:', error);
  process.exit(1);
});