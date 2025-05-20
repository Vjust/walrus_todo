#!/usr/bin/env node

// Import polyfills first
import './utils/polyfills/aggregate-error';

// Import core dependencies with CommonJS compatibility
import { Command, Flags } from '@oclif/core';
import * as Commands from './commands/index.js';
import { initializeConfig } from './utils/config-loader';

// Initialize environment configuration
initializeConfig();

// Configure environment for AI operations
process.env.FORCE_COLOR = '1';

// Force chalk to use colors even in CI/non-TTY environments
import chalk from 'chalk';
chalk.level = chalk.level > 0 ? chalk.level : 1;

export default class WalTodo extends Command {
  static description = 'A CLI for managing todos with Sui blockchain and Walrus storage';

  static examples = [
    '$ waltodo add -t "Buy groceries"',
    '$ waltodo list',
    '$ waltodo complete 123'
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
    .map(command => typeof command === 'function' && command.prototype instanceof Command ? command : null)
    .filter(Boolean);

  async run(): Promise<void> {
    const { flags } = await this.parse(WalTodo);

    // Enable verbose logging if requested
    if (flags.verbose) {
      process.env.DEBUG = '*';
    }

    // Show help by default
    await this.showHelp();
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
        await WalTodo.run([cmd, '--help']);
        return;
      }
    }
    
    // Special handling for AI commands to ensure proper error handling and output
    if (commandName === 'ai') {
      try {
        // Ensure environment variables are loaded
        if (!process.env.XAI_API_KEY) {
          // Try to find API key in args
          const apiKeyIndex = args.findIndex(arg => arg === '--apiKey' || arg === '-k');
          if (apiKeyIndex === -1 || apiKeyIndex === args.length - 1) {
            console.error(chalk.red('Error: XAI API key is required. Set XAI_API_KEY environment variable or use --apiKey flag.'));
            process.exit(1);
          }
        }
        
        // Force output to be colored
        process.env.FORCE_COLOR = '1';
        
        // Find the AI command
        const AiCommandClass = Object.entries(Commands).find(([name, _]) => 
          name === 'AiCommand'
        )?.[1];
        
        if (!AiCommandClass) {
          console.error(chalk.red('Error: AI command not found in exports.'));
          process.exit(1);
        }
        
        // Run the AI command with the remaining arguments
        await AiCommandClass.run(args.slice(1));
        return;
      } catch (error) {
        console.error(chalk.red(`AI command error: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    }

    // Find the command class for other commands
    const CommandClass = Object.entries(Commands).find(([name, _]) => {
      return name.toLowerCase().replace('command', '') === commandName.toLowerCase();
    })?.[1];

    if (!CommandClass) {
      console.log(`Command not found: ${commandName}`);
      console.log('Available commands:');
      Object.keys(Commands).forEach(name => {
        console.log(`  ${name.replace('Command', '')}`);
      });
      process.exit(1);
    }

    // Run the command with the remaining arguments
    await CommandClass.run(args.slice(1));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Handle common network errors with better messaging
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('connection') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ETIMEDOUT')) {
      console.error(chalk.red(`Network error: ${errorMessage}`));
      console.error(chalk.yellow('Please check your internet connection and try again.'));
    } else {
      console.error(chalk.red('Error running command:'), errorMessage);
    }
    
    // Provide debug info if verbose mode is enabled
    if (process.env.DEBUG) {
      console.error(chalk.gray('Debug info:'), error);
    }
    
    process.exit(1);
  }
};

// Run the CLI if this file is executed directly
// Use ESM-compatible method to detect if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}` || require.main === module;
if (isMainModule) {
  run().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}