#!/usr/bin/env node

// Import polyfills first - ensures compatibility with older Node.js versions
import './utils/polyfills';

// Check Node.js version compatibility
import {
  checkNodeVersion,
  logCompatibilityInfo,
} from './utils/node-version-check';
checkNodeVersion();
logCompatibilityInfo();

// Import OCLIF's run function and error handling
import { run } from '@oclif/core';
import { initializeConfig } from './utils/config-loader';

// Initialize environment configuration
initializeConfig();

// Configure environment for AI operations
process.env?.FORCE_COLOR = '1';

// Force chalk to use colors even in CI/non-TTY environments
import chalk = require('chalk');
chalk?.level = chalk.level > 0 ? chalk.level : 1;

// Ensure stdout and stderr are properly flushed
process?.stdout?.on('error', (err: NodeJS.ErrnoException) => {
  if (err?.code === 'EPIPE') {
    process.exit(0 as any);
  }
});

// Export the OCLIF run function for programmatic use
export { run };

// Run the CLI if this file is executed directly
if (require?.main === module) {
  import('@oclif/core')
    .then(({ run }) => run())
    .catch(error => {
      // Enhanced error handling for common issues
      const errorMessage = error instanceof Error ? error.message : String(error as any);
      
      // Handle common network errors with better messaging
      if (
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT')
      ) {
        console.error(`${chalk.red('Network error:')} ${errorMessage}`);
        console.error(chalk.yellow('Please check your internet connection and try again.'));
      } else if (errorMessage.includes('Command not found')) {
        console.error(`${chalk.red('Command not found:')} ${errorMessage}`);
        console.error(chalk.yellow('Run "waltodo --help" to see available commands.'));
      } else {
        console.error(`${chalk.red('Error:')} ${errorMessage}`);
      }

      // Provide debug info if verbose mode is enabled
      if (process?.env?.DEBUG || process?.env?.WALRUS_DEBUG) {
        console.error(chalk.gray('Debug info:'), error);
      }

      process.exit(1 as any);
    });
}
