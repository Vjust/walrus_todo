import chalk = require('chalk');
import { Logger } from './Logger';

const logger = new Logger('error-handler');
import { CLIError } from '../types/errors/consolidated/CLIError';
// Define utility functions directly to avoid import issues
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (error === null) {
    return 'Null error occurred';
  }
  if (error === undefined) {
    return 'Undefined error occurred';
  }
  if (typeof error === 'string') {
    return error || 'Empty string error';
  }
  if (typeof error === 'object') {
    try {
      const stringified = JSON.stringify(error);
      return stringified === '{}' ? 'Empty object error' : `Object error: ${stringified}`;
    } catch {
      return 'Non-serializable object error';
    }
  }
  try {
    return String(error);
  } catch {
    return `Unknown error of type: ${typeof error}`;
  }
};

const isRetryableError = (error: unknown): boolean => {
  // Check if it's a network-related error based on the message
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
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
import { displayFriendlyError } from './error-messages';

/**
 * Centralized error handler for the application
 * Now uses enhanced error messaging system for better UX
 */
export function handleError(
  messageOrError: string | unknown,
  error?: unknown
): void {
  // Handle the case where only one parameter is passed
  if (error === undefined) {
    error = messageOrError;
    messageOrError = '';
  }

  const contextMessage =
    typeof messageOrError === 'string' ? messageOrError : '';

  // Convert to proper error object if needed
  let actualError: Error;
  if (error instanceof Error) {
    actualError = error;
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  ) {
    actualError = new Error(
      (error as Record<string, unknown>).message as string
    );
  } else {
    actualError = new Error(getErrorMessage(error));
  }

  // Add context if provided
  const context = contextMessage ? { operation: contextMessage } : undefined;

  // Use enhanced error display
  const friendlyError = displayFriendlyError(actualError, context);
  logger.error(friendlyError);
}

/**
 * Wraps an async function with retry logic for transient errors
 * @deprecated Use BaseCommand.executeWithRetry for proper logging and error wrapping
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Only retry on network errors or specific transient errors
      if (!isRetryableError(lastError) || attempt >= maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      // Use console.error for retry notices since this is a low-level utility
      // Commands should use BaseCommand.executeWithRetry for proper logging
      logger.error(
        chalk.yellow(
          `Request failed, retrying (${attempt}/${maxRetries}) after ${delay}ms...`
        )
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('withRetry: Operation failed after all retries with no error details available');
}

// Using isRetryableError from consolidated types now

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// Re-export CLIError for backward compatibility
export { CLIError };
