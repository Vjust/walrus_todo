import chalk from 'chalk';
import { Todo, Priority } from '../types';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTodoOutput(todo: Todo): string {
  const status = todo.completed ? chalk.green('✔') : chalk.yellow('○');
  const description = todo.completed ? chalk.dim(todo.description) : todo.description;
  
  let output = `${status} ${description}`;
  
  if (todo.priority) {
    const priorityColors: Record<Priority, typeof chalk.red> = {
      high: chalk.red,
      medium: chalk.yellow,
      low: chalk.green,
    };
    output += ` ${priorityColors[todo.priority](`[${todo.priority}]`)}`;
  }

  if (todo.dueDate) {
    output += ` ${chalk.blue(`(due: ${formatDate(todo.dueDate)})`)}`;
  }

  if (todo.tags && todo.tags.length > 0) {
    output += ` ${chalk.cyan(todo.tags.map((tag: string) => `#${tag}`).join(' '))}`;
  }

  return output;
}

export function validateDate(date: string): boolean {
  const parsedDate = new Date(date);
  return parsedDate.toString() !== 'Invalid Date';
}

export function validatePriority(priority: string): boolean {
  return ['high', 'medium', 'low'].includes(priority.toLowerCase());
}

/**
 * Utility to retry an async operation with exponential backoff
 * 
 * @param operation - The async operation to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay in milliseconds between retries
 * @returns The result of the operation
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries}):`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Calculate exponential backoff delay
      const delay = baseDelay * Math.pow(2, attempt);
      // Add some jitter to prevent multiple retries happening at exactly the same time
      const jitter = Math.random() * 100;
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  // If we've reached this point, all retries failed
  throw lastError || new Error('Operation failed after maximum retry attempts');
}