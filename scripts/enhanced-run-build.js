#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple fallback build script
const args = process.argv.slice(2);
const mode = args.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'production';

console.log(`Building CLI in ${mode} mode...`);

try {
  // Change to CLI directory
  process.chdir(path.join(__dirname, '..', 'apps', 'cli'));
  
  if (mode === 'dev') {
    // Development build - use relaxed configuration
    console.log('Running development build (relaxed type checking)...');
    execSync('tsc -p tsconfig.dev.json', { stdio: 'inherit' });
  } else if (mode === 'clean') {
    // Clean build
    console.log('Cleaning build artifacts...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }
  } else {
    // Production build
    console.log('Running production build...');
    execSync('tsc', { stdio: 'inherit' });
  }
  
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}