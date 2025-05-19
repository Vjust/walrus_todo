// Fix import for chalk with esModuleInterop
import chalkModule from 'chalk';
const chalk = chalkModule;
import { CLIError, isErrorWithMessage, getErrorMessage } from '../types/errors/consolidated';
import { displayFriendlyError, getErrorContext } from './error-messages';


/**
 * Centralized error handler for the application
 * Now uses enhanced error messaging system for better UX
 */
export function handleError(messageOrError: string | unknown, error?: unknown): void {
  // Handle the case where only one parameter is passed
  if (error === undefined) {
    error = messageOrError;
    messageOrError = '';
  }
  
  const contextMessage = typeof messageOrError === 'string' ? messageOrError : '';
  
  // Convert to proper error object if needed
  let actualError: Error;
  if (error instanceof Error) {
    actualError = error;
  } else if (isErrorWithMessage(error)) {
    actualError = new Error(error.message);
  } else {
    actualError = new Error(getErrorMessage(error));
  }
  
  // Add context if provided
  const context = contextMessage ? { operation: contextMessage } : undefined;
  
  // Use enhanced error display
  const friendlyError = displayFriendlyError(actualError, context);
  console.error(friendlyError);
}

/**
 * Wraps an async function with retry logic for transient errors
 * @deprecated Use BaseCommand.executeWithRetry for proper logging and error wrapping
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on network errors or specific transient errors
      if (!isTransientError(error) || attempt >= maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      // Use console.error for retry notices since this is a low-level utility
      // Commands should use BaseCommand.executeWithRetry for proper logging
      console.error(chalk.yellow(`Request failed, retrying (${attempt}/${maxRetries}) after ${delay}ms...`));
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Determines if an error is likely transient and can be retried
 */
function isTransientError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('429')
  );
}

export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// Re-export CLIError for backward compatibility
export { CLIError };