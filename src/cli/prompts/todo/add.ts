/**
 * Add TODO prompts
 * Interactive prompts for creating new TODOs
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { Priority } from '../../../todos/todo';

/**
 * Prompt for adding a new TODO with interactive fields
 */
export async function promptAddTodo(): Promise<{
  description: string;
  priority: Priority;
  tags: string[];
  dueDate?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'What needs to be done?',
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Description cannot be empty';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('Low'), value: 'low' },
        { name: chalk.yellow('Medium'), value: 'medium' },
        { name: chalk.red('High'), value: 'high' }
      ],
      default: 'medium'
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated, optional):',
      filter: (input: string) => {
        return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      }
    },
    {
      type: 'confirm',
      name: 'hasDueDate',
      message: 'Set a due date?',
      default: false
    },
    {
      type: 'input',
      name: 'dueDate',
      message: 'Due date (YYYY-MM-DD):',
      when: (answers: any) => answers.hasDueDate,
      validate: (input: string) => {
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          return 'Invalid date format. Please use YYYY-MM-DD';
        }
        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
          return 'Due date cannot be in the past';
        }
        return true;
      },
      filter: (input: string) => {
        return input ? new Date(input).toISOString() : undefined;
      }
    }
  ]);

  return {
    description: answers.description,
    priority: answers.priority,
    tags: answers.tags || [],
    dueDate: answers.dueDate
  };
}

/**
 * Enhanced interactive add TODO with autocomplete for tags
 */
export async function promptAddTodoInteractive(existingTags: string[] = []): Promise<{
  description: string;
  priority: Priority;
  tags: string[];
  dueDate?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'What needs to be done?',
      validate: (input: string) => {
        if (input.trim().length === 0) {
          return 'Description cannot be empty';
        }
        if (input.trim().length > 200) {
          return 'Description must be 200 characters or less';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('● Low'), value: 'low' },
        { name: chalk.yellow('● Medium'), value: 'medium' },
        { name: chalk.red('● High'), value: 'high' }
      ],
      default: 'medium'
    },
    {
      type: 'checkbox',
      name: 'existingTags',
      message: 'Select existing tags (optional):',
      choices: existingTags.map(tag => ({ name: tag, value: tag })),
      when: () => existingTags.length > 0
    },
    {
      type: 'input',
      name: 'newTags',
      message: 'Add new tags (comma-separated, optional):',
      filter: (input: string) => {
        return input.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      },
      validate: (input: string[]) => {
        const invalidTags = input.filter(tag => !/^[a-zA-Z0-9_-]+$/.test(tag));
        if (invalidTags.length > 0) {
          return `Invalid tags: ${invalidTags.join(', ')}. Use only letters, numbers, dashes, and underscores.`;
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'hasDueDate',
      message: 'Set a due date?',
      default: false
    },
    {
      type: 'input',
      name: 'dueDate',
      message: 'Due date (YYYY-MM-DD or relative like "tomorrow", "next week"):',
      when: (answers: any) => answers.hasDueDate,
      validate: (input: string) => {
        // Handle relative dates
        if (['today', 'tomorrow', 'next week', 'next month'].includes(input.toLowerCase())) {
          return true;
        }
        
        const date = new Date(input);
        if (isNaN(date.getTime())) {
          return 'Invalid date format. Use YYYY-MM-DD or relative terms like "tomorrow"';
        }
        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
          return 'Due date cannot be in the past';
        }
        return true;
      },
      filter: (input: string) => {
        if (!input) return undefined;
        
        // Handle relative dates
        const now = new Date();
        switch (input.toLowerCase()) {
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
            return new Date(input).toISOString();
        }
      }
    }
  ]);

  // Combine existing and new tags
  const tags = [...(answers.existingTags || []), ...(answers.newTags || [])];

  return {
    description: answers.description,
    priority: answers.priority,
    tags: [...new Set(tags)], // Remove duplicates
    dueDate: answers.dueDate
  };
}

/**
 * Quick add TODO with minimal prompts
 */
export async function promptQuickAdd(): Promise<{
  description: string;
  priority: Priority;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Quick TODO:',
      validate: (input: string) => input.trim().length > 0 || 'Description cannot be empty'
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority:',
      choices: [
        { name: chalk.green('Low'), value: 'low' },
        { name: chalk.yellow('Medium'), value: 'medium' },
        { name: chalk.red('High'), value: 'high' }
      ],
      default: 'medium'
    }
  ]);

  return {
    description: answers.description,
    priority: answers.priority
  };
}