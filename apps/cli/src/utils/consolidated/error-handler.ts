/**
 * @file Centralized error handling utilities
 * Provides consistent error handling, logging, and display throughout the application.
 */

import chalk = require('chalk');
import { BaseError } from '../../types/errors/consolidated/BaseError';
import { CLIError } from '../../types/errors/consolidated/CLIError';
import { Logger } from '../Logger';

// Lazy logger initialization to avoid constructor issues in Jest
let logger: Logger;
const getLogger = () => {
  if (!logger) {
    logger = new Logger('error-handler');
  }
  return logger;
};

/**
 * Options for centralized error handling
 */
interface ErrorHandlerOptions {
  /** Whether to exit the process */
  exit?: boolean;

  /** Exit code to use when exiting (defaults to 1) */
  exitCode?: number;

  /** Whether to log the error stack trace (defaults to false) */
  logStack?: boolean;

  /** Custom prefix for the error message */
  prefix?: string;

  /** Context to include with the error */
  context?: Record<string, unknown>;
}

/**
 * Main error handler function - primary export for Jest compatibility
 * @param err Error to handle
 * @param options Error handler options
 */
export function errorHandler(err: unknown, options: ErrorHandlerOptions = {}): void {
  handleError(err, options);
}

// Import or define error utility functions
const isRetryableError = (error: unknown): boolean => {
  // Check if it's a network-related error based on the message
  if (error instanceof Error) {
    const errorMessage = error?.message?.toLowerCase();
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('retry') ||
      errorMessage.includes('unavailable')
    );
  }
  return false;
};

const toBaseError = (error: unknown): BaseError => {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    return new BaseError({
      message: error.message,
      code: 'ERROR',
      cause: error,
    });
  }

  return new BaseError({
    message: error instanceof Error ? error.message : 'Unknown error',
    code: 'UNKNOWN_ERROR',
  });
};

// Chalk is imported directly above

/**
 * Handle an error consistently across the application
 * @param error Error to handle
 * @param contextOrOptions Context string or error handler options
 * @param options Error handler options if context is a string
 */
export function handleError(
  error: unknown,
  contextOrOptions: string | ErrorHandlerOptions = {},
  options: ErrorHandlerOptions = {}
): void {
  // Handle function overloads
  let context = '';
  let handlerOptions: ErrorHandlerOptions;

  if (typeof contextOrOptions === 'string') {
    context = contextOrOptions;
    handlerOptions = options;
  } else {
    handlerOptions = contextOrOptions;
  }

  const {
    exit = false,
    exitCode: configuredExitCode,
    logStack = false,
    prefix = '',
    context: additionalContext = {}, // Context for future error handling
  } = handlerOptions;

  // Normalize the error
  const baseError = toBaseError(error);

  // Get exit code (CLI errors have their own exit code)
  const exitCode =
    configuredExitCode ?? (error instanceof CLIError ? error.exitCode : 1);

  // Format the context string
  const contextPrefix = context ? `${context}: ` : '';

  // Format the error prefix
  const errorPrefix = prefix || '❌';

  // Display the error
  getLogger().error(
    `\n${errorPrefix} ${contextPrefix}${chalk.red(baseError.message)}`
  );

  // Display additional information for BaseError instances
  if (baseError instanceof BaseError) {
    getLogger().error(`${chalk.dim('Error Code:')} ${chalk.yellow(baseError.code)}`);

    // Display cause if available and requested
    if (baseError.cause && logStack) {
      getLogger().error(
        `${chalk.dim('Caused by:')} ${chalk.red(baseError?.cause?.message)}`
      );
    }

    // Display context if available and requested
    const combinedContext = { ...baseError.context, ...additionalContext };
    if (Object.keys(combinedContext).length > 0) {
      getLogger().error(
        `${chalk.dim('Context:')} ${JSON.stringify(combinedContext, null, 2)}`
      );
    }

    // Display recovery information
    if (baseError.recoverable) {
      getLogger().error(
        `${chalk.green('This error is recoverable.')}${baseError.shouldRetry ? ' You can retry the operation.' : ''}`
      );
    }
  }

  // Display stack trace if requested
  if (logStack && baseError.stack) {
    getLogger().error(
      `\n${chalk.dim('Stack trace:')}\n${chalk.dim(baseError.stack)}`
    );
  }

  // Exit if requested
  if (exit) {
    process.exit(exitCode);
  }
}

/**
 * Assert a condition and throw an error if it fails
 * @param condition Condition to assert
 * @param message Error message if assertion fails
 * @param code Error code if assertion fails
 */
export function assert(
  condition: boolean,
  message: string,
  code = 'ASSERTION_ERROR'
): asserts condition {
  if (!condition) {
    throw new BaseError({
      message,
      code,
    });
  }
}

/**
 * Wrap an async function with retry logic
 * @param fn Function to wrap
 * @param options Retry options
 * @returns Promise resolving to the function result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryIf?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number, delay: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryIf = isRetryableError,
    onRetry = defaultOnRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt > maxRetries || !retryIf(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random()),
        maxDelay
      );

      // Call the onRetry callback
      onRetry(error, attempt, delay);

      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never happen due to the throw in the catch block
  throw lastError;
}

/**
 * Default retry callback
 * @param error Error that occurred
 * @param attempt Current attempt number
 * @param delay Delay before next attempt
 */
function defaultOnRetry(error: unknown, attempt: number, delay: number): void {
  getLogger().info(
    chalk.yellow(`Operation failed, retrying (${attempt}/${delay})...`),
    { error: error instanceof Error ? error.message : String(error) }
  );
}

// Default export for compatibility with existing callers
export default errorHandler;
