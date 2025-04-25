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