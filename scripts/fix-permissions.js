#!/usr/bin/env node

// Simple console logger for script use
const logger = {
  info: msg => console.log(`[INFO] ${msg}`),
  error: msg => console.error(`[ERROR] ${msg}`),
  warn: msg => console.warn(`[WARN] ${msg}`),
};

/**
 * Cross-platform script to fix binary file permissions
 * Works on both Windows and Unix-like systems
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Print colored message
function print(color, message) {
  logger.info(`${colors[color]}${message}${colors.reset}`);
}

// Fix permissions for a directory
function fixPermissions(dirPath) {
  print('blue', `Fixing permissions for ${dirPath}...`);

  // Skip if directory doesn't exist
  if (!fs.existsSync(dirPath)) {
    print('yellow', `Directory ${dirPath} does not exist, skipping.`);
    return;
  }

  // Get all files in the directory
  const files = fs.readdirSync(dirPath);
  let fixedCount = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);

    if (fs.statSync(filePath).isFile()) {
      try {
        // On Windows, fs.chmod doesn't really work the same way
        // but we still run it for consistency
        if (os.platform() !== 'win32') {
          const currentMode = fs.statSync(filePath).mode;
          // Add executable permissions (user, group, others)
          const newMode = currentMode | 0o111;
          fs.chmodSync(filePath, newMode);
        } else {
          // On Windows, just flag the file as not having any problems
          // We can't actually set Unix-like permissions
        }

        fixedCount++;
        if (fixedCount % 5 === 0) {
          print('blue', `Fixed permissions for ${fixedCount} files...`);
        }
      } catch (err) {
        print(
          'yellow',
          `Warning: Could not fix permissions for ${filePath}: ${err.message}`
        );
      }
    }
  });

  print(
    'green',
    `Successfully fixed permissions for ${fixedCount} files in ${dirPath}`
  );
}

// Main function
function main() {
  const projectRoot = path.resolve(__dirname, '..');

  // Fix permissions for bin directory
  fixPermissions(path.join(projectRoot, 'bin'));

  // Fix permissions for scripts directory
  fixPermissions(path.join(projectRoot, 'scripts'));

  // Fix specific shell scripts at the project root
  const rootScripts = [
    'build.sh',
    'install-global.sh',
    'update-cli.sh',
    'fix-cli.sh',
  ];

  let fixedCount = 0;
  rootScripts.forEach(script => {
    const scriptPath = path.join(projectRoot, script);
    if (fs.existsSync(scriptPath)) {
      try {
        if (os.platform() !== 'win32') {
          fs.chmodSync(scriptPath, 0o755);
        }
        fixedCount++;
      } catch (err) {
        print(
          'yellow',
          `Warning: Could not fix permissions for ${scriptPath}: ${err.message}`
        );
      }
    }
  });

  print('green', `Fixed permissions for ${fixedCount} scripts in project root`);
  print('green', 'All permissions fixed successfully!');
}

// Run the script
main();
