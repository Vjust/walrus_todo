/**
 * @file CLI error class for command-line interface errors
 * Handles errors related to command execution, user input, and CLI operations.
 */

import { BaseError, BaseErrorOptions } from './BaseError';

/**
 * Options for CLIError construction
 */
export interface CLIErrorOptions extends BaseErrorOptions {
  /** Command name */
  command?: string;

  /** Exit code to use when exiting the process */
  exitCode?: number;

  /** Input that caused the error */
  input?: string;

  /** Flags or parameters that were invalid */
  invalidParams?: string[];
}

/**
 * Error thrown for CLI-related failures
 */
export class CLIError extends BaseError {
  /** Command name */
  public readonly command?: string;

  /** Exit code to use when exiting the process */
  public readonly exitCode: number;

  /** Input that caused the error */
  private readonly _input?: string;

  /** Flags or parameters that were invalid */
  public readonly invalidParams?: string[];

  /**
   * Create a new CLIError
   * @param message Error message
   * @param options Options for the error
   */
  constructor(
    message: string,
    codeOrOptions: string | Partial<CLIErrorOptions> = {}
  ) {
    // Support old constructor signature (message, code)
    let options: Partial<CLIErrorOptions>;
    if (typeof codeOrOptions === 'string') {
      options = { code: codeOrOptions, message };
    } else {
      options = { ...codeOrOptions, message };
    }

    const {
      command,
      exitCode = 1,
      input,
      invalidParams,
      code = 'CLI_ERROR',
      ...restOptions
    } = options;

    // Build context with CLI details
    const context = {
      ...(options.context || {}),
      ...(command ? { command } : {}),
      ...(invalidParams ? { invalidParams } : {}),
    };

    // Call BaseError constructor
    super({
      message,
      code,
      context,
      recoverable: false, // CLI errors are generally not recoverable
      shouldRetry: false,
      ...restOptions,
    });

    // Store properties
    this.command = command;
    this.exitCode = exitCode;
    this.invalidParams = invalidParams;

    // Store input privately to avoid leaking sensitive data
    if (input) {
      this._input = input;
    }
  }

  /**
   * Create a CLIError for invalid flag/parameter
   * @param paramName Parameter name
   * @param message Error message
   * @param options Additional options
   * @returns New CLIError instance
   */
  static invalidParameter(
    paramName: string,
    message?: string,
    options: Omit<CLIErrorOptions, 'invalidParams' | 'message'> = {}
  ): CLIError {
    return new CLIError(message || `Invalid parameter: ${paramName}`, {
      ...options,
      invalidParams: [paramName],
      code: 'CLI_INVALID_PARAMETER',
    });
  }

  /**
   * Create a CLIError for missing required parameter
   * @param paramName Parameter name
   * @param options Additional options
   * @returns New CLIError instance
   */
  static missingParameter(
    paramName: string,
    options: Omit<CLIErrorOptions, 'invalidParams' | 'message'> = {}
  ): CLIError {
    return new CLIError(`Missing required parameter: ${paramName}`, {
      ...options,
      invalidParams: [paramName],
      code: 'CLI_MISSING_PARAMETER',
    });
  }

  /**
   * Create a CLIError for command not found
   * @param command Command name
   * @param options Additional options
   * @returns New CLIError instance
   */
  static commandNotFound(
    command: string,
    options: Omit<CLIErrorOptions, 'command' | 'message'> = {}
  ): CLIError {
    return new CLIError(`Command not found: ${command}`, {
      ...options,
      command,
      code: 'CLI_COMMAND_NOT_FOUND',
    });
  }
}
