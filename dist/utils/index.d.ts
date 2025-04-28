import { Todo } from '../types';
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
export declare function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number, maxDelay?: number): Promise<T>;
/**
 * Generate a unique ID
 * @returns string A unique ID
 */
export declare function generateId(): string;
/**
 * Format a date to ISO string without milliseconds
 * @param date Date to format
 * @returns string Formatted date
 */
export declare function formatDate(date?: Date): string;
/**
 * Validate a todo list name
 * @param name Name to validate
 * @returns boolean Whether the name is valid
 */
export declare function isValidListName(name: string): boolean;
/**
 * Parse tags string into array
 * @param tags Comma-separated tags string
 * @returns string[] Array of tags
 */
export declare function parseTags(tags: string): string[];
/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Format a todo for display
 * @param todo Todo to format
 * @returns string Formatted todo string
 */
export declare function formatTodo(todo: Todo): string;
export declare function validateDate(date: string): boolean;
export declare function validatePriority(priority: string): boolean;
export declare function formatTodoOutput(todo: Todo): string;
