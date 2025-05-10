#!/usr/bin/env node

import { Command, Flags } from '@oclif/core';
import * as Commands from './commands';
import { initializeConfig } from './utils/config-loader';

// Initialize environment configuration
initializeConfig();

// Configure environment for AI operations
process.env.FORCE_COLOR = '1';

// Force chalk to use colors even in CI/non-TTY environments
const chalk = require('chalk');
chalk.level > 0 || (chalk.level = 1);

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
    try {
      const { flags } = await this.parse(WalTodo);

      // Enable verbose logging if requested
      if (flags.verbose) {
        process.env.DEBUG = '*';
      }

      // Print help information
      console.log(WalTodo.description);

      if (flags.help) {
        // Show more detailed help
        console.log('\nCommands:');
        const commandNames = Object.keys(Commands).sort();
        for (const name of commandNames) {
          console.log(`  ${name.padEnd(12)} ${name} command`);
        }

        console.log('\nFlags:');
        console.log('  -v, --verbose  Show verbose output');
        console.log('  -h, --help     Show help information');
      }

      console.log('\nUsage:');
      console.log(WalTodo.examples.join('\n'));
    } catch (error) {
      // Handle parsing errors gracefully
      console.log(WalTodo.description);
      console.log('\nUsage:');
      console.log(WalTodo.examples.join('\n'));

      if (process.argv.includes('--help') || process.argv.includes('-h')) {
        // Show help if --help flag is present
        console.log('\nCommands:');
        const commandNames = Object.keys(Commands).sort();
        for (const name of commandNames) {
          console.log(`  ${name.padEnd(12)} ${name} command`);
        }

        console.log('\nFlags:');
        console.log('  -v, --verbose  Show verbose output');
        console.log('  -h, --help     Show help information');
      }
    }
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
          name.toLowerCase() === 'aicommand'
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
    console.error('Error running command:', error);
    process.exit(1);
  }
};

// Run the CLI if this file is executed directly
if (require.main === module) {
  run().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}