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
 * Centralized error handler for consistent error display and handling
 * 
 * @param {any} error - The error to handle
 * @returns {void}
 */
export function handleError(error: any): void {
  // Handle Walrus storage errors
  if (error instanceof WalrusError) {
    console.error(chalk.red('\nStorage Error:'), error.message);
    
    // Check if the error has a code property (using type assertion)
    if ((error as any).code) {
      console.log(chalk.dim('Error Code:'), (error as any).code);
    }
    
    // Add recovery suggestions based on error type
    if (error.message.includes('network') || error.message.includes('timeout')) {
      console.log(chalk.yellow('\nSuggestions:'));
      console.log('• Check your internet connection');
      console.log('• Try again later as the service might be temporarily unavailable');
    }
  } 
  // Handle Sui blockchain errors
  else if (error instanceof SuiError) {
    console.error(chalk.red('\nBlockchain Error:'), error.message);
    if (error.txHash) {
      console.log(chalk.dim('Transaction Hash:'), error.txHash);
    }
  } 
  // Handle CLI errors
  else if (error instanceof CLIError) {
    console.error(chalk.red('\nError:'), error.message);
    
    // Add helpful suggestions based on error code
    switch (error.code) {
      case 'INVALID_LIST':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Check if the list name is correct');
        console.log('• Use "waltodo list" to see all available lists');
        console.log('• Create the list first using "waltodo add <list-name> -t <task>"');
        break;
      
      case 'INVALID_TASK_ID':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Check if the task ID is correct');
        console.log('• Use "waltodo list <list-name>" to see all tasks and their IDs');
        break;
      
      case 'INVALID_PRIORITY':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Priority must be one of: high, medium, low');
        console.log('• Example: waltodo add "my-list" -t "task" -p high');
        break;
      
      case 'INVALID_DATE':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Date must be in YYYY-MM-DD format');
        console.log('• Example: waltodo add "my-list" -t "task" -d 2024-12-31');
        break;
      
      case 'NO_TASKS':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Add at least one task using -t flag');
        console.log('• Example: waltodo add "my-list" -t "task1" -t "task2"');
        break;
      
      case 'MISSING_LIST':
        console.log(chalk.yellow('\nSuggestions:'));
        console.log('• Specify a list name using -l flag or as first argument');
        console.log('• Example: waltodo add "my-list" -t "task"');
        console.log('• Or: waltodo add -l "my-list" -t "task"');
        break;
    }
  } 
  // Handle missing required flag errors
  else if (error?.message?.includes('Missing required flag')) {
    console.error(chalk.red('\nError:'), error.message);
    console.log(chalk.yellow('\nExample usage:'));
    console.log('• waltodo add -l "my-list" -t "my task"');
    console.log('• waltodo list -l "my-list"');
  } 
  // Handle unknown command errors
  else if (error?.message?.includes('Unknown command')) {
    console.error(chalk.red('\nError: Unknown command'));
    console.log(chalk.yellow('\nAvailable commands:'));
    console.log('• add      - Add new todo(s)');
    console.log('• list     - List todos or todo lists');
    console.log('• update   - Update a todo');
    console.log('• check    - Mark a todo as complete/incomplete');
    console.log('• delete   - Delete a todo or list');
    console.log('• publish  - Publish list to blockchain');
    console.log('• sync     - Sync with blockchain');
    console.log('• configure- Configure CLI settings');
    console.log('\nRun "waltodo --help" for more information');
  } 
  // Handle unknown option errors
  else if (error?.message?.includes('unknown option')) {
    console.error(chalk.red('\nError:'), error.message);
    console.log(chalk.yellow('\nUse --help to see available options'));
  } 
  // Handle other errors
  else {
    console.error(chalk.red('\nError:'), error?.message || 'An unknown error occurred');
    console.log(chalk.yellow('\nIf this persists, try:'));
    console.log('1. Run "waltodo configure" to check your settings');
    console.log('2. Check your network connection');
    console.log('3. Ensure you have proper permissions');
  }
  
  process.exit(1);
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