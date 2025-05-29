#!/usr/bin/env node

/**
 * Cross-platform script to update an installed CLI
 * This provides an easy way to update the globally installed CLI
 */

import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { Logger } from '../apps/cli/src/utils/Logger.js';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const logger = new Logger('update-cli');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

// Print colored message
function print(color, message) {
  logger.info(`${colors[color]}${message}${colors.reset}`);
}

// Main update function
async function updateCli() {
  print('blue', 'Updating waltodo CLI...');

  // First, ensure the build is up to date (with full clean build)
  print('blue', 'Building the package with a clean build...');
  const buildResult = spawnSync(
    'node',
    ['scripts/run-build.js', '--clean', '--transpile-only'],
    {
      stdio: 'inherit',
      shell: true,
    }
  );

  if (buildResult.status !== 0) {
    print('red', 'Build failed. Cannot update CLI.');
    process.exit(1);
  }

  // Check if the CLI is installed
  const isWindows = os.platform() === 'win32';
  const checkCmd = isWindows ? 'where' : 'which';

  const checkResult = spawnSync(checkCmd, ['waltodo'], {
    shell: true,
    encoding: 'utf8',
  });

  if (checkResult.status !== 0) {
    print(
      'yellow',
      'waltodo CLI is not installed globally. Installing instead of updating...'
    );

    // Forward to the install script
    const installResult = spawnSync('node', ['scripts/install-global.js'], {
      stdio: 'inherit',
      shell: true,
    });

    if (installResult.status !== 0) {
      print('red', 'Installation failed.');
      process.exit(1);
    }

    return;
  }

  // Check for npm or pnpm
  const hasPnpm = spawnSync('which', ['pnpm'], { shell: true }).status === 0;
  const packageManager = hasPnpm ? 'pnpm' : 'npm';

  print('blue', `Using ${packageManager} to update globally...`);

  // Unlink first if needed
  print('blue', 'Unlinking previous version...');
  spawnSync(packageManager, ['unlink', 'waltodo'], {
    stdio: 'inherit',
    shell: true,
  });

  // Perform the update (which is really just a link)
  const updateResult = spawnSync(packageManager, ['link'], {
    stdio: 'inherit',
    shell: true,
  });

  if (updateResult.status !== 0) {
    print('red', 'Update failed.');
    print('yellow', 'Try running the script with elevated privileges.');
    process.exit(1);
  }

  // Verify the update
  print('blue', 'Verifying update...');

  const versionResult = spawnSync('waltodo', ['--version'], {
    shell: true,
    encoding: 'utf8',
  });

  if (versionResult.status === 0) {
    print('green', 'Successfully updated waltodo CLI!');
    print('blue', 'Updated version:');
    logger.info(versionResult.stdout);
  } else {
    print(
      'red',
      "Update verification failed. 'waltodo' command not found after update."
    );
    process.exit(1);
  }
}

// Run the update
updateCli().catch(err => {
  print('red', `Update error: ${err.message}`);
  process.exit(1);
});
