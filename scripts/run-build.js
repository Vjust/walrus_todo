#!/usr/bin/env node
import { Logger } from '../src/utils/Logger';

const logger = new Logger('run-build');

/**
 * A simple Node.js wrapper for running the unified-build.ts script
 * This script ensures cross-platform compatibility and provides
 * a simple interface for running builds with different options.
 */

const { spawnSync } = require('child_process');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);

// Map arguments to unified-build.ts options
const mappedArgs = args.map(arg => {
  // Map common aliases to their actual flags
  switch (arg) {
    case '--type-check':
      return '--no-transpile-only';
    case '--full':
      return '--clean --no-transpile-only';
    default:
      return arg;
  }
});

// Add default options if not provided
if (
  !args.includes('--transpile-only') &&
  !args.includes('--no-transpile-only')
) {
  mappedArgs.push('--transpile-only'); // Default to fast build
}

logger.info(`Running build with options: ${mappedArgs.join(' ')}`);

// Run the TypeScript build script using ts-node
const result = spawnSync(
  'npx',
  ['ts-node', 'scripts/unified-build.ts', ...mappedArgs],
  {
    stdio: 'inherit',
    shell: true,
    cwd: path.resolve(__dirname, '..'),
  }
);

// Forward the exit code
process.exit(result.status);
