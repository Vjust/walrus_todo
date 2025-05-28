/**
 * Command Executor Utility
 *
 * A secure wrapper around Node.js child_process methods that prevents
 * command injection attacks and ensures safe execution of shell commands.
 */

import { Logger } from './Logger';

const logger = new Logger('command-executor');

import {
  execSync,
  execFileSync,
  spawnSync,
  ExecSyncOptions,
  SpawnSyncOptions,
} from 'child_process';
import { BaseError } from '../types/errors/consolidated';

/**
 * Error thrown by command execution operations
 */
export class CommandExecutionError extends BaseError {
  constructor(
    message: string,
    cause?: Error,
    options?: { command?: string; args?: string[] }
  ) {
    super({
      message: `Command execution error: ${message}`,
      code: 'COMMAND_EXECUTION_ERROR',
      cause,
      context: options,
    });
    this.name = 'CommandExecutionError';
  }
}

/**
 * Configuration for allowlisted commands
 */
export interface CommandAllowlistConfig {
  /**
   * Allowlisted command executables
   */
  allowedCommands: string[];

  /**
   * Whether to throw an error for disallowed commands or just log a warning
   */
  strictMode: boolean;

  /**
   * Path to the log file for command execution (optional)
   */
  logPath?: string;
}

/**
 * Default configuration for command allowlisting
 */
const DEFAULT_ALLOWLIST_CONFIG: CommandAllowlistConfig = {
  allowedCommands: [
    'sui', // Sui CLI
    'node', // Node.js
    'npm', // Node Package Manager
    'pnpm', // Performant Node Package Manager
    'yarn', // Yarn Package Manager
    'ls',
    'dir', // List files
    'cat', // View file contents
    'git', // Git version control
    'echo', // Echo text
    'curl',
    'wget', // Network requests
  ],
  strictMode: false, // Default to warning mode
};

/**
 * Current configuration for command allowlisting
 */
let currentConfig: CommandAllowlistConfig = { ...DEFAULT_ALLOWLIST_CONFIG };

/**
 * Configure the command executor
 * @param config Configuration for command allowlisting
 */
export function configureCommandExecutor(
  config: Partial<CommandAllowlistConfig>
): void {
  currentConfig = {
    ...currentConfig,
    ...config,
  };
}

/**
 * Reset the command executor configuration to defaults
 */
export function resetCommandExecutorConfig(): void {
  currentConfig = { ...DEFAULT_ALLOWLIST_CONFIG };
}

/**
 * Validates if a command is allowed to execute
 * @param command The command to validate
 * @returns True if the command is allowed, false otherwise
 */
function isCommandAllowed(command: string): boolean {
  const normalizedCommand = command.trim().split(' ')[0].toLowerCase();
  return currentConfig.allowedCommands.includes(normalizedCommand);
}

/**
 * Validates and sanitizes a command for execution
 * @param command The command to validate
 * @throws CommandExecutionError if the command is not allowed in strict mode
 */
function validateCommand(command: string): void {
  if (!isCommandAllowed(command)) {
    const message = `Command not allowlisted: ${command}`;

    if (currentConfig.strictMode) {
      throw new CommandExecutionError(message, undefined, { command });
    } else {
      logger.warn(
        `[WARNING] ${message} - This could be a security risk if command injection is possible`
      );
    }
  }
}

/**
 * Sanitizes a string for command-line arguments by removing shell metacharacters
 * @param input The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeCommandInput(input: string): string {
  // Replace potentially dangerous shell characters with their safe equivalents
  return input.replace(/[;&|<>$`\\!]/g, '');
}

/**
 * Validates a command-line address to ensure it matches the expected format
 * @param address The address to validate
 * @returns True if the address is valid, false otherwise
 */
export function isValidSuiAddress(address: string): boolean {
  // Check if the address is in the format 0x followed by hexadecimal characters
  return /^0x[a-fA-F0-9]+$/.test(address);
}

/**
 * Validates a command-line number to ensure it's a valid number string
 * @param value The number string to validate
 * @returns True if the string is a valid number, false otherwise
 */
export function isValidNumberString(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

/**
 * Safely execute a command synchronously
 * @param command The command to execute
 * @param options Options for execSync
 * @returns The command output
 * @throws CommandExecutionError if the command fails or is not allowed
 */
export function safeExecSync(
  command: string,
  options?: ExecSyncOptions
): Buffer | string {
  try {
    validateCommand(command);
    return execSync(command, options);
  } catch (error) {
    // Differentiate between validation errors and execution errors
    if (error instanceof CommandExecutionError) {
      throw error;
    }

    throw new CommandExecutionError(
      `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      { command }
    );
  }
}

/**
 * Safely execute a file without shell interpretation
 * @param command The command to execute
 * @param args The arguments to pass to the command
 * @param options Options for execFileSync
 * @returns The command output
 * @throws CommandExecutionError if the command fails or is not allowed
 */
export function safeExecFileSync(
  command: string,
  args: string[],
  options?: ExecSyncOptions
): Buffer | string {
  try {
    validateCommand(command);
    return execFileSync(command, args, options);
  } catch (error) {
    // Differentiate between validation errors and execution errors
    if (error instanceof CommandExecutionError) {
      throw error;
    }

    throw new CommandExecutionError(
      `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      { command, args }
    );
  }
}

/**
 * Safely spawn a process
 * @param command The command to spawn
 * @param args The arguments to pass to the command
 * @param options Options for spawnSync
 * @returns The spawn result
 * @throws CommandExecutionError if the command is not allowed
 */
export function safeSpawnSync(
  command: string,
  args: string[],
  options?: SpawnSyncOptions
): ReturnType<typeof spawnSync> {
  try {
    validateCommand(command);
    return spawnSync(command, args, options);
  } catch (error) {
    // Differentiate between validation errors and execution errors
    if (error instanceof CommandExecutionError) {
      throw error;
    }

    throw new CommandExecutionError(
      `Failed to spawn command: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      { command, args }
    );
  }
}

/**
 * Execute a Sui CLI command safely
 * @param subcommand The Sui subcommand to execute
 * @param args The arguments to pass to the subcommand
 * @param options Options for execFileSync
 * @returns The command output
 * @throws CommandExecutionError if the command fails
 */
export function executeSuiCommand(
  subcommand: string,
  args: string[] = [],
  options: ExecSyncOptions = { encoding: 'utf8' }
): string | Buffer {
  try {
    return safeExecFileSync('sui', [subcommand, ...args], options);
  } catch (error) {
    throw new CommandExecutionError(
      `Failed to execute Sui command: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? error : undefined,
      { command: 'sui', args: [subcommand, ...args] }
    );
  }
}

/**
 * Switch to a specific Sui address
 * @param address The Sui address to switch to
 * @returns The command output
 * @throws CommandExecutionError if the address is invalid or the command fails
 */
export function switchSuiAddress(address: string): string {
  // Validate the address format
  if (!isValidSuiAddress(address)) {
    throw new CommandExecutionError(
      'Invalid Sui address format. Address must start with 0x followed by hexadecimal characters.',
      undefined,
      { args: [address] }
    );
  }

  // Execute the command safely with the validated address
  const result = executeSuiCommand('client', ['switch', '--address', address], {
    encoding: 'utf8',
  });
  return result.toString();
}

/**
 * Get the active Sui address
 * @returns The active Sui address
 * @throws CommandExecutionError if the command fails
 */
export function getActiveSuiAddress(): string {
  const result = executeSuiCommand('client', ['active-address'], {
    encoding: 'utf8',
  });
  return result.toString().trim();
}

/**
 * Publish a Sui package
 * @param packagePath The path to the package to publish
 * @param gasBudget The gas budget for the transaction
 * @param options Additional options
 * @returns The command output
 * @throws CommandExecutionError if the command fails
 */
export function publishSuiPackage(
  packagePath: string,
  gasBudget: string | number,
  options: { skipDependencyVerification?: boolean; json?: boolean } = {}
): string {
  // Validate the gas budget
  const gasBudgetStr = String(gasBudget);
  if (!isValidNumberString(gasBudgetStr)) {
    throw new CommandExecutionError(
      'Invalid gas budget format. Gas budget must be a positive number.',
      undefined,
      { args: [gasBudgetStr] }
    );
  }

  // Build the args array
  const args = ['client', 'publish'];

  if (options.skipDependencyVerification) {
    args.push('--skip-dependency-verification');
  }

  args.push('--gas-budget', gasBudgetStr);

  if (options.json) {
    args.push('--json');
  }

  args.push(packagePath);

  // Execute the command safely with the validated arguments
  const result = executeSuiCommand('client', args.slice(1), {
    encoding: 'utf8',
  });
  return result.toString();
}

/**
 * Execute a custom Sui command safely
 * @param args The arguments to pass to Sui
 * @param options Options for execFileSync
 * @returns The command output
 * @throws CommandExecutionError if the command fails
 */
export function customSuiCommand(
  args: string[],
  options: ExecSyncOptions = { encoding: 'utf8' }
): string | Buffer {
  // All args should be validated before passing
  for (const arg of args) {
    if (
      arg.includes(';') ||
      arg.includes('&') ||
      arg.includes('|') ||
      arg.includes('<') ||
      arg.includes('>')
    ) {
      throw new CommandExecutionError(
        `Invalid argument containing shell metacharacters: ${arg}`,
        undefined,
        { args }
      );
    }
  }

  return safeExecFileSync('sui', args, options);
}
