import chalk from 'chalk';
import { isErrorWithMessage, getErrorMessage } from '../types/error';

/**
 * Custom CLI error class for application-specific errors
 */
export class CLIError extends Error {
  constructor(message: string, public code: string = 'GENERAL_ERROR') {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Centralized error handler for the application
 */
export function handleError(messageOrError: string | unknown, error?: unknown): void {
  // Handle the case where only one parameter is passed
  if (error === undefined) {
    error = messageOrError;
    messageOrError = '';
  }
  
  const contextMessage = typeof messageOrError === 'string' ? messageOrError : '';
  
  if (error instanceof CLIError) {
    console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}CLI Error: ${error.message}`);
    return;
  }
  
  if (error instanceof Error) {
    console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Error: ${error.message}`);
    return;
  }
  
  // Handle unknown error types with a message
  if (isErrorWithMessage(error)) {
    console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Error: ${error.message}`);
    return;
  }
  
  // Handle completely unknown error types
  console.error(`\n❌ ${contextMessage ? contextMessage + ': ' : ''}Unknown error occurred: ${getErrorMessage(error)}`);
}

/**
 * Wraps an async function with retry logic for transient errors
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
      console.log(chalk.yellow(`Request failed, retrying (${attempt}/${maxRetries}) after ${delay}ms...`));
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