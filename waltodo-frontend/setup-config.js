#!/usr/bin/env node

/**
 * Configuration Setup Script for Frontend
 *
 * Copies auto-generated configuration files from src/config to public/config
 * so they can be loaded dynamically at runtime.
 */

const fs = require('fs');
const path = require('path');

const CONFIG_SOURCE_DIR = path.join(__dirname, 'src', 'config');
const CONFIG_PUBLIC_DIR = path.join(__dirname, 'public', 'config');

/**
 * Ensures a directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

/**
 * Copies JSON config files to public directory
 */
function copyConfigFiles() {
  ensureDir(CONFIG_PUBLIC_DIR);

  if (!fs.existsSync(CONFIG_SOURCE_DIR)) {
    console.log(
      'No config directory found - run "waltodo deploy" first to generate configurations'
    );
    return;
  }

  const files = fs.readdirSync(CONFIG_SOURCE_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log(
      'No JSON config files found - run "waltodo deploy" first to generate configurations'
    );
    return;
  }

  jsonFiles.forEach(file => {
    const sourcePath = path.join(CONFIG_SOURCE_DIR, file);
    const destPath = path.join(CONFIG_PUBLIC_DIR, file);

    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to public/config/`);
    } catch (error) {
      console.error(`Failed to copy ${file}:`, error.message);
    }
  });

  console.log(`\nConfiguration setup complete! Found configs for:`);
  jsonFiles.forEach(file => {
    const network = file.replace('.json', '');
    console.log(`  - ${network} network`);
  });
}

/**
 * Main execution
 */
function main() {
  console.log('Setting up frontend configuration...\n');
  copyConfigFiles();
}

if (require.main === module) {
  main();
}

module.exports = { copyConfigFiles };
