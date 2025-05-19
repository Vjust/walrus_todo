import { Hook } from '@oclif/core';
import { initializeConfig } from '../utils/environment-config';
import { validateEnvironment } from '../utils/CommandValidationMiddleware';
import { loadEnvironment } from '../utils/env-loader';
import { validateStartup } from '../utils/startup-validator';
import chalk from 'chalk';
import { commandHistory } from '../utils/CommandHistory';
import { commandRegistry } from '../utils/CommandRegistry';
import { todoGroup } from '../commands/todos';

/**
 * Initialize the application's environment and configuration
 */
const initHook: Hook<'init'> = async function() {
  // Initialize configuration if not already done
  if (typeof process.env.ENV_CONFIG_INITIALIZED === 'undefined') {
    try {
      // Load from .env and config files first
      loadEnvironment({
        loadDefaultEnvInDev: true
      });

      // Initialize and apply environment-specific configurations
      initializeConfig();

      // Perform startup validation with user-friendly output
      try {
        validateStartup({
          throwOnError: false,
          showBanner: true,
          exitOnCritical: false
        });
      } catch (validationError) {
        // Just log validation error but don't fail, individual commands will do more specific validation
        console.warn(
          chalk.yellow('Environment validation warning:'),
          chalk.yellow(validationError instanceof Error ? validationError.message : String(validationError))
        );
      }

      // Mark as initialized to prevent duplicate initialization
      process.env.ENV_CONFIG_INITIALIZED = 'true';
    } catch (error) {
      console.error(
        chalk.red('\nFailed to initialize environment configuration:'),
        chalk.red(error instanceof Error ? error.message : String(error))
      );

      // Output helpful error recovery information
      console.error(chalk.yellow('\nTroubleshooting steps:'));
      console.error(chalk.yellow('1. Check if .env file exists and is properly formatted'));
      console.error(chalk.yellow('2. Ensure required environment variables are set'));
      console.error(chalk.yellow('3. Verify storage directories exist and are writable'));
      console.error(chalk.yellow('4. Run with --debug flag for more detailed error information\n'));

      // Don't throw error here - fail gracefully and let individual commands handle validation
    }
  }
};

/**
 * Command history and registry initialization hook
 */
const commandRegistryHook: Hook<'init'> = async function(opts) {
  // Record command in history
  const command = opts.argv.join(' ');
  if (command) {
    commandHistory.addCommand(command);
  }

  // Register todo commands and groups
  commandRegistry.registerGroup(todoGroup);
  
  // Register all commands in the todo group
  Object.entries(todoGroup.commands).forEach(([cmdName, cmdInfo]) => {
    commandRegistry.registerCommand({
      name: cmdName,
      description: cmdInfo.description,
      aliases: cmdInfo.aliases,
      group: 'todos'
    });
  });

  // Register other common commands
  commandRegistry.registerCommand({
    name: 'help',
    description: 'Display help for WalTodo',
    aliases: ['h', '?']
  });

  commandRegistry.registerCommand({
    name: 'config',
    description: 'Configure WalTodo settings',
    aliases: ['configure', 'cfg']
  });

  commandRegistry.registerCommand({
    name: 'store',
    description: 'Store todo on blockchain',
    aliases: ['save']
  });

  commandRegistry.registerCommand({
    name: 'deploy',
    description: 'Deploy smart contract'
  });

  commandRegistry.registerCommand({
    name: 'sync',
    description: 'Sync todos between local and blockchain',
    aliases: ['synchronize']
  });
};

/**
 * Add hooks in sequence
 */
const hooks: Hook<'init'>[] = [
  initHook,
  validateEnvironment,
  commandRegistryHook
];

export default hooks;