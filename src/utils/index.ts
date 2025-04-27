import { RetryOptions, Todo } from '../types';

/**
 * Utility functions
 */

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries - 1) break;
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      // Add some jitter
      const jitter = Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError!;
}

/**
 * Generate a unique ID
 * @returns string A unique ID
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format a date to ISO string without milliseconds
 * @param date Date to format
 * @returns string Formatted date
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('.')[0] + 'Z';
}

/**
 * Validate a todo list name
 * @param name Name to validate
 * @returns boolean Whether the name is valid
 */
export function isValidListName(name: string): boolean {
  return /^[a-zA-Z0-9-_]+$/.test(name);
}

/**
 * Parse tags string into array
 * @param tags Comma-separated tags string
 * @returns string[] Array of tags
 */
export function parseTags(tags: string): string[] {
  return tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format a todo for display
 * @param todo Todo to format
 * @returns string Formatted todo string
 */
export function formatTodo(todo: Todo): string {
  const status = todo.completed ? '✓' : '☐';
  const priority = todo.priority.toUpperCase();
  const dueDate = todo.dueDate ? ` (due: ${todo.dueDate})` : '';
  const tags = todo.tags.length ? ` [${todo.tags.join(', ')}]` : '';
  
  return `${status} ${todo.task} - ${priority}${dueDate}${tags}`;
}

export function validateDate(date: string): boolean {
  const parsedDate = new Date(date);
  return parsedDate.toString() !== 'Invalid Date';
}

export function validatePriority(priority: string): boolean {
  return ['high', 'medium', 'low'].includes(priority.toLowerCase());
}

export function formatTodoOutput(todo: Todo): string {
  const status = todo.completed ? '✓' : '⃞';
  const priority = {
    high: '⚠️',
    medium: '•',
    low: '○'
  }[todo.priority] || '•';

  return `${status} ${priority} ${todo.task}${todo.dueDate ? ` (due: ${todo.dueDate})` : ''}${
    todo.tags.length ? ` [${todo.tags.join(', ')}]` : ''
  }`;
}