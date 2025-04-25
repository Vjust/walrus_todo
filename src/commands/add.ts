import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { configService } from '../services/config-service';
import { walrusService } from '../services/walrus-service';
import { generateId } from '../utils';
import { Todo } from '../types';

interface AddOptions {
  list?: string;
  task?: string;
  priority?: string;
  due?: string;
  tags?: string;
  encrypt?: boolean;
  private?: boolean; 
}

export async function add(options: AddOptions): Promise<void> {
  try {
    // Get list name if not provided
    const listName = options.list || await input({ 
      message: 'Enter the name of the todo list:',
      validate: (input) => input.length > 0
    });

    // Get task description if not provided
    const description = options.task || await input({
      message: 'What do you need to do?',
      validate: (input) => input.length > 0
    });

    // Create todo data
    const todo: Todo = {
      id: generateId(),
      description,
      priority: options.priority as Todo['priority'] || 'medium',
      dueDate: options.due,
      tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : [],
      createdAt: new Date().toISOString(),
      completed: false,
      private: options.private || false,
      encrypted: options.encrypt || false,
      walrusBlobId: ''
    };

    // Store in Walrus if not private
    if (!todo.private) {
      const blobId = await walrusService.storeTodo(listName, todo);
      todo.walrusBlobId = blobId;
    } else {

      await configService.saveLocalTodo(listName, todo);
    }

    console.log(chalk.green('✔ Todo added successfully'));
    console.log(chalk.dim('List:'), listName);
    console.log(chalk.dim('Task:'), description);
    if (todo.private) {
      console.log(chalk.dim('Storage:'), 'Local only');
    }

  } catch (error) {
    console.error(chalk.red('Failed to add todo:'), error);
    process.exit(1);
  }
}