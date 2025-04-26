/**
 * Add Command Module
 * Handles the creation and storage of new todo items
 * Supports both local and Walrus storage with encryption options
 */

import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { configService } from '../services/config-service';
import { walrusService } from '../services/walrus-service';
import { generateId } from '../utils';
import { Todo } from '../types';

/**
 * Interface defining the possible options for adding a todo item
 * @interface AddOptions
 */
interface AddOptions {
  list?: string;
  task?: string;
  priority?: string;
  due?: string;
  tags?: string;
  encrypt?: boolean;
  private?: boolean; 
}

/**
 * Adds a new todo item to either local storage or Walrus storage
 * Handles interactive prompts if required options are not provided
 * Supports encryption and private storage options
 * 
 * @param options - Command line options for adding a todo
 * @throws Will throw an error if storage operations fail
 */
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

    // Create todo data with metadata
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

    // Handle storage based on privacy setting
    if (!todo.private) {
      const blobId = await walrusService.storeTodo(listName, todo);
      todo.walrusBlobId = blobId;
    } else {
      await configService.saveLocalTodo(listName, todo);
    }

    // Provide user feedback
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