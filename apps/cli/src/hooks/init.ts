import { Hook } from '@oclif/core';
import { initializeConfig } from '../utils/environment-config';
import { validateEnvironment } from '../utils/CommandValidationMiddleware';
import { loadEnvironment } from '../utils/env-loader';
import { validateStartup } from '../utils/startup-validator';
// chalk imported but not used
import { commandHistory } from '../utils/CommandHistory';
import { commandRegistry } from '../utils/CommandRegistry';
// import { todoGroup } from '../commands/todos';
import { Logger } from '../utils/Logger';

/**
 * Initialize the application's environment and configuration
 */
const initHook: Hook<'init'> = async function () {
  // Initialize configuration if not already done
  if (typeof process.env?.ENV_CONFIG_INITIALIZED === 'undefined') {
    try {
      // Load from .env and config files first
      loadEnvironment({
        loadDefaultEnvInDev: true,
      });

      // Initialize and apply environment-specific configurations
      initializeConfig();

      // Perform startup validation with user-friendly output
      try {
        validateStartup({
          throwOnError: false,
          showBanner: true,
          exitOnCritical: false,
        });
      } catch (validationError) {
        // Just log validation error but don't fail, individual commands will do more specific validation
        Logger.getInstance().warn(
          `Environment validation warning: ${validationError instanceof Error ? validationError.message : String(validationError)}`
        );
      }

      // Mark as initialized to prevent duplicate initialization
      process.env?.ENV_CONFIG_INITIALIZED = 'true';
    } catch (_error) {
      Logger.getInstance().error(
        `Failed to initialize environment configuration: ${_error instanceof Error ? _error.message : String(_error)}`
      );

      // Output helpful error recovery information
      Logger.getInstance().error('Troubleshooting steps:');
      Logger.getInstance().error(
        '1. Check if .env file exists and is properly formatted'
      );
      Logger.getInstance().error(
        '2. Ensure required environment variables are set'
      );
      Logger.getInstance().error(
        '3. Verify storage directories exist and are writable'
      );
      Logger.getInstance().error(
        '4. Run with --debug flag for more detailed error information'
      );

      // Don't throw error here - fail gracefully and let individual commands handle validation
    }
  }
};

/**
 * Command history and registry initialization hook
 */
const commandRegistryHook: Hook<'init'> = async function (opts) {
  // Record command in history
  const command = opts?.argv?.join(' ');
  if (command) {
    commandHistory.addCommand(command);
  }

  // Register todo commands and groups
  // TODO: Re-enable when todoGroup is available
  // commandRegistry.registerGroup(todoGroup);

  // Register basic commands manually
  const basicCommands = [
    {
      name: 'add',
      description: 'Add a new todo',
      aliases: ['a'],
      group: 'todos',
    },
    {
      name: 'list',
      description: 'List todos',
      aliases: ['ls'],
      group: 'todos',
    },
    {
      name: 'complete',
      description: 'Complete a todo',
      aliases: ['done'],
      group: 'todos',
    },
    {
      name: 'delete',
      description: 'Delete a todo',
      aliases: ['del'],
      group: 'todos',
    },
  ];

  basicCommands.forEach(cmd => {
    commandRegistry.registerCommand(cmd);
  });

  // Register other common commands
  commandRegistry.registerCommand({
    name: 'help',
    description: 'Display help for WalTodo',
    aliases: ['h', '?'],
  });

  commandRegistry.registerCommand({
    name: 'config',
    description: 'Configure WalTodo settings',
    aliases: ['configure', 'cfg'],
  });

  commandRegistry.registerCommand({
    name: 'store',
    description: 'Store todo on blockchain',
    aliases: ['save'],
  });

  commandRegistry.registerCommand({
    name: 'deploy',
    description: 'Deploy smart contract',
  });

  commandRegistry.registerCommand({
    name: 'sync',
    description: 'Sync todos between local and blockchain',
    aliases: ['synchronize'],
  });
};

/**
 * Add hooks in sequence
 */
const hooks: Hook<'init'>[] = [
  initHook,
  validateEnvironment,
  commandRegistryHook,
];

export default hooks;
