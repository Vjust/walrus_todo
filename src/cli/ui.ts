/**
 * UI helper functions for the Waltodo CLI
 * Provides chalk-styled output functions, table formatting, and progress indicators
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';
import { Todo } from '../todos/todo';

/**
 * Success message (green)
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), chalk.green(message));
}

/**
 * Error message (red)
 */
export function error(message: string): void {
  console.error(chalk.red('✗'), chalk.red(message));
}

/**
 * Warning message (yellow)
 */
export function warning(message: string): void {
  console.log(chalk.yellow('⚠'), chalk.yellow(message));
}

/**
 * Info message (blue)
 */
export function info(message: string): void {
  console.log(chalk.blue('ℹ'), chalk.blue(message));
}

/**
 * Create and start a spinner
 */
export function spinner(text: string): Ora {
  return ora({
    text,
    spinner: 'dots',
  }).start();
}

/**
 * Format priority with color
 */
export function formatPriority(priority: 'low' | 'medium' | 'high'): string {
  switch (priority) {
    case 'high':
      return chalk.red('● High');
    case 'medium':
      return chalk.yellow('● Medium');
    case 'low':
      return chalk.green('● Low');
    default:
      return priority;
  }
}

/**
 * Format status with color
 */
export function formatStatus(status: 'pending' | 'done'): string {
  return status === 'done' 
    ? chalk.green('✓ Done') 
    : chalk.yellow('○ Pending');
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const dateStr = d.toLocaleDateString();
  
  if (diffDays < 0) {
    return chalk.red(`${dateStr} (overdue)`);
  } else if (diffDays === 0) {
    return chalk.yellow(`${dateStr} (today)`);
  } else if (diffDays === 1) {
    return chalk.yellow(`${dateStr} (tomorrow)`);
  } else if (diffDays <= 7) {
    return chalk.blue(`${dateStr} (${diffDays} days)`);
  }
  
  return dateStr;
}

/**
 * Create a formatted table for TODO list display
 */
export function createTodoTable(todos: Todo[]): string {
  if (todos.length === 0) {
    return chalk.gray('No TODOs found');
  }

  const table = new Table({
    head: [
      chalk.gray('ID'),
      chalk.gray('Description'),
      chalk.gray('Priority'),
      chalk.gray('Status'),
      chalk.gray('Tags'),
      chalk.gray('Due Date'),
      chalk.gray('Created'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
  });

  todos.forEach((todo) => {
    table.push([
      chalk.white(todo.id.substring(0, 8)),
      chalk.white(todo.description),
      formatPriority(todo.priority),
      formatStatus(todo.status),
      todo.tags ? chalk.cyan(todo.tags.join(', ')) : chalk.gray('-'),
      todo.dueDate ? formatDate(new Date(todo.dueDate)) : chalk.gray('-'),
      chalk.gray(new Date(todo.createdAt).toLocaleDateString()),
    ]);
  });

  return table.toString();
}

/**
 * Format a single TODO item for display
 */
export function formatTodo(todo: Todo): string {
  const parts: string[] = [];
  
  // Status indicator
  const statusIcon = todo.status === 'done' ? chalk.green('✓') : chalk.yellow('○');
  parts.push(statusIcon);
  
  // ID (shortened)
  parts.push(chalk.gray(`[${todo.id.substring(0, 6)}]`));
  
  // Description (strikethrough if done)
  const description = todo.status === 'done' 
    ? chalk.strikethrough.gray(todo.description)
    : chalk.white(todo.description);
  parts.push(description);
  
  // Priority
  parts.push(formatPriority(todo.priority));
  
  // Tags
  if (todo.tags && todo.tags.length > 0) {
    parts.push(chalk.cyan(todo.tags.map(t => `#${t}`).join(' ')));
  }
  
  // Due date
  if (todo.dueDate) {
    parts.push(formatDate(new Date(todo.dueDate)));
  }
  
  return parts.join(' ');
}

/**
 * Prompt for confirmation
 */
export async function confirm(message: string): Promise<boolean> {
  // TODO: Implement interactive confirmation
  // For now, return true (will be implemented with inquirer or similar)
  console.log(chalk.yellow(`${message} [y/N]`));
  return true;
}