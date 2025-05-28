#!/usr/bin/env node

// Import polyfills first
import './utils/polyfills/aggregate-error';

// Import core dependencies with CommonJS compatibility
import { Command, Flags } from '@oclif/core';
import * as Commands from './commands/index';
import { initializeConfig } from './utils/config-loader';

// Initialize environment configuration
initializeConfig();

// Configure environment for AI operations
process.env.FORCE_COLOR = '1';

// Force chalk to use colors even in CI/non-TTY environments
import chalk = require('chalk');
import { Logger } from './utils/Logger';
chalk.level = chalk.level > 0 ? chalk.level : 1;

const logger = new Logger('CLI');

export default class WalTodo extends Command {
  static description =
    'A CLI for managing todos with Sui blockchain and Walrus storage';

  static examples = [
    '$ waltodo add -t "Buy groceries"',
    '$ waltodo list',
    '$ waltodo complete 123',
  ];

  static flags = {
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show verbose output',
      default: false,
    }),
    help: Flags.boolean({
      char: 'h',
      description: 'Show help information',
      default: false,
    }),
  };

  static commandIds = Object.values(Commands)
    .map(command =>
      typeof command === 'function' && command.prototype instanceof Command
        ? command
        : null
    )
    .filter(Boolean);

  async run(): Promise<void> {
    const { flags } = await this.parse(WalTodo);

    // Enable verbose logging if requested
    if (flags.verbose) {
      process.env.DEBUG = '*';
    }

    // Show help by default
    this.log(WalTodo.help);
  }
}

// Ensure stdout and stderr are properly flushed
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
});

// Main entry point for the CLI
export const run = async () => {
  try {
    const args = process.argv.slice(2);

    // If no arguments, show help
    if (args.length === 0) {
      await WalTodo.run([]);
      return;
    }

    // Get the command name (first argument)
    const commandName = args[0];

    // Check if it's a help request
    if (commandName === '--help' || commandName === '-h') {
      await WalTodo.run(['--help']);
      return;
    }

    // Special handling for -h flag when used with a command
    if (args.length > 1 && args.includes('-h')) {
      const cmdIndex = args.findIndex(arg => !arg.startsWith('-'));
      if (cmdIndex !== -1) {
        const cmd = args[cmdIndex];
        if (cmd) {
          await WalTodo.run([cmd, '--help']);
          return;
        }
      }
    }

    // Special handling for AI commands to ensure proper error handling and output
    if (commandName === 'ai') {
      try {
        // Force output to be colored
        process.env.FORCE_COLOR = '1';

        // Find the AI command
        const AiCommandClass = Object.entries(Commands).find(
          ([name, _]) => name === 'AiCommand'
        )?.[1];

        if (!AiCommandClass) {
          logger.error('AI command not found in exports.');
          process.exit(1);
        }

        // Run the AI command with the remaining arguments
        await AiCommandClass.run(args.slice(1));
        return;
      } catch (_error) {
        logger.error(
          'AI command error',
          _error instanceof Error ? _error : new Error(String(_error))
        );
        process.exit(1);
      }
    }

    // Find the command class for other commands
    const CommandClass = Object.entries(Commands).find(([name, _]) => {
      return (
        name.toLowerCase().replace('command', '') === commandName?.toLowerCase()
      );
    })?.[1];

    if (!CommandClass) {
      logger.info(`Command not found: ${commandName}`);
      logger.info('Available commands:');
      Object.keys(Commands).forEach(name => {
        logger.info(`  ${name.replace('Command', '')}`);
      });
      process.exit(1);
    }

    // Run the command with the remaining arguments
    await CommandClass.run(args.slice(1));
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : String(_error);

    // Handle common network errors with better messaging
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      logger.error(`Network error: ${errorMessage}`);
      logger.warn('Please check your internet connection and try again.');
    } else {
      logger.error(
        'Error running command',
        _error instanceof Error ? _error : new Error(errorMessage)
      );
    }

    // Provide debug info if verbose mode is enabled
    if (process.env.DEBUG) {
      logger.debug('Debug info', { error: _error });
    }

    process.exit(1);
  }
};

// Run the CLI if this file is executed directly
// Check if this file is being run directly
if (require.main === module) {
  run().catch(error => {
    logger.error(
      'Unhandled error',
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  });
}
