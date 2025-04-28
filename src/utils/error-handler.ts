import chalk from 'chalk';
import { SuiError, WalrusError } from '../types';

/**
 * Custom CLI error class for application-specific errors
 * 
 * @class CLIError
 * @extends {Error}
 */
export class CLIError extends Error {
  /**
   * Creates a new CLIError
   * 
   * @param {string} message - Human-readable error description
   * @param {string} [code='GENERAL_ERROR'] - Error code for programmatic handling
   */
  constructor(message: string, public code: string = 'GENERAL_ERROR') {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Centralized error handler for the application
 * Formats and displays different types of errors appropriately
 * @param error Error object to handle
 */
export function handleError(error: unknown): void {
  // Log the full error to console for debugging
  console.error('Debug error:', error);
  
  // Handle specific error types
  if (error instanceof SuiError) {
    console.error(`\n❌ Sui Blockchain Error: ${error.message}`);
    if (error.txHash) {
      console.error(`Transaction hash: ${error.txHash}`);
    }
    return;
  }
  
  if (error instanceof WalrusError) {
    console.error(`\n❌ Walrus Storage Error: ${error.message}`);
    if (error.code) {
      console.error(`Error code: ${error.code}`);
    }
    return;
  }
  
  if (error instanceof Error) {
    console.error(`\n❌ Error: ${error.message}`);
    return;
  }
  
  // Handle unknown error types
  console.error('\n❌ Unknown error occurred');
}

/**
 * Wraps an async function with retry logic for transient errors
 * 
 * @param {Function} fn - The async function to execute
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay between retries in ms
 * @returns {Promise<T>} - Result of the function execution
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
 * 
 * @param {any} error - The error to evaluate
 * @returns {boolean} - True if the error is likely transient
 */
function isTransientError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('429') // Too many requests
  );
}