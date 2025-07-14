/**
 * Shared helper functions for CLI prompts
 */

import chalk from 'chalk';
import { Priority } from '../../../todos/todo';

/**
 * Validates that a string is not empty
 */
export function validateNotEmpty(input: string, fieldName: string = 'Field'): boolean | string {
  if (input.trim().length === 0) {
    return `${fieldName} cannot be empty`;
  }
  return true;
}

/**
 * Validates a date string and ensures it's not in the past
 */
export function validateDate(input: string, allowPast: boolean = false): boolean | string {
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return 'Invalid date format. Please use YYYY-MM-DD';
  }
  if (!allowPast && date < new Date(new Date().setHours(0, 0, 0, 0))) {
    return 'Due date cannot be in the past';
  }
  return true;
}

/**
 * Validates a description with length constraints
 */
export function validateDescription(input: string, maxLength: number = 200): boolean | string {
  if (input.trim().length === 0) {
    return 'Description cannot be empty';
  }
  if (input.trim().length > maxLength) {
    return `Description must be ${maxLength} characters or less`;
  }
  return true;
}

/**
 * Validates tag format (alphanumeric with dashes and underscores)
 */
export function validateTags(tags: string[]): boolean | string {
  const invalidTags = tags.filter(tag => !/^[a-zA-Z0-9_-]+$/.test(tag));
  if (invalidTags.length > 0) {
    return `Invalid tags: ${invalidTags.join(', ')}. Use only letters, numbers, dashes, and underscores.`;
  }
  return true;
}

/**
 * Parses comma-separated string into array of trimmed, non-empty strings
 */
export function parseCommaSeparated(input: string): string[] {
  return input
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

/**
 * Parses relative date strings into ISO date strings
 */
export function parseRelativeDate(input: string): string | undefined {
  if (!input) return undefined;
  
  const now = new Date();
  const lowerInput = input.toLowerCase();
  
  switch (lowerInput) {
    case 'today':
      return now.toISOString();
    case 'tomorrow':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case 'next week':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'next month':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      return nextMonth.toISOString();
    default:
      // Try to parse as regular date
      const date = new Date(input);
      return isNaN(date.getTime()) ? undefined : date.toISOString();
  }
}

/**
 * Formats priority with color
 */
export function formatPriority(priority: Priority): string {
  switch (priority) {
    case 'high':
      return chalk.red('High');
    case 'medium':
      return chalk.yellow('Medium');
    case 'low':
      return chalk.green('Low');
    default:
      return priority;
  }
}

/**
 * Creates priority choices for inquirer prompts
 */
export function createPriorityChoices(withBullet: boolean = false) {
  const bullet = withBullet ? '● ' : '';
  return [
    { name: chalk.green(`${bullet}Low`), value: 'low' },
    { name: chalk.yellow(`${bullet}Medium`), value: 'medium' },
    { name: chalk.red(`${bullet}High`), value: 'high' }
  ];
}

/**
 * Truncates a string with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Formats a blob ID for display (shows first 12 characters)
 */
export function formatBlobId(blobId: string): string {
  return `${blobId.substring(0, 12)}...`;
}

/**
 * Validates numeric input with optional min/max constraints
 */
export function validateNumber(
  input: string | number,
  options: {
    min?: number;
    max?: number;
    allowEmpty?: boolean;
    fieldName?: string;
  } = {}
): boolean | string {
  const { min, max, allowEmpty = false, fieldName = 'Value' } = options;
  
  if (allowEmpty && (input === '' || input === undefined)) {
    return true;
  }
  
  const num = typeof input === 'string' ? parseInt(input) : input;
  
  if (isNaN(num)) {
    return `${fieldName} must be a number`;
  }
  
  if (min !== undefined && num < min) {
    return `${fieldName} must be at least ${min}`;
  }
  
  if (max !== undefined && num > max) {
    return `${fieldName} must be at most ${max}`;
  }
  
  return true;
}