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
import { CLIError } from '../utils/error-handler';

/**
 * Interface defining the possible options for adding a todo item
 * @interface AddOptions
 */
interface AddOptions {
  list?: string;
  task?: string[];  // Changed to string[] to support multiple tasks
  priority?: string;
  due?: string;
  tags?: string;
  encrypt?: boolean;
  private?: boolean; 
  test?: boolean;
}

/**
 * Adds new todo items to either local storage or Walrus storage
 * Handles interactive prompts if required options are not provided
 * Supports encryption and private storage options
 * 
 * @param options - Command line options for adding todos
 * @throws Will throw an error if storage operations fail
 */
export async function add(options: AddOptions): Promise<void> {
  try {
    // Get list name if not provided
    const listName = options.list || await input({ 
      message: 'Enter the name of the todo list:',
      validate: (input) => input.length > 0 || 'List name cannot be empty'
    });

    // Get tasks if not provided
    const tasks = options.task || [await input({
      message: 'What do you need to do?',
      validate: (input) => input.length > 0 || 'Task description cannot be empty'
    })];

    // Get todo list
    let todoList = await configService.getLocalTodos(listName);
    if (!todoList) {
      // Initialize new list
      todoList = {
        id: generateId(),
        name: listName,
        owner: configService.getConfig().walletAddress || 'local',
        todos: [],
        version: 1
      };
    }

    // Validate priority if provided
    if (options.priority && !['high', 'medium', 'low'].includes(options.priority.toLowerCase())) {
      throw new CLIError(`Invalid priority level: ${options.priority}`, 'INVALID_PRIORITY');
    }

    // Validate date if provided
    if (options.due) {
      const date = new Date(options.due);
      if (isNaN(date.getTime()) || !options.due.match(/^\d{4}-\d{2}-\d{2}$/)) {
        throw new CLIError(`Invalid date format: ${options.due}. Use YYYY-MM-DD format.`, 'INVALID_DATE');
      }
    }

    // Add each task as a separate todo
    for (const description of tasks) {
      if (!description.trim()) {
        throw new CLIError('Task description cannot be empty', 'INVALID_TASK');
      }

      // Create todo data with metadata
      const todo: Todo = {
        id: generateId(),
        task: description,
        priority: options.priority?.toLowerCase() as Todo['priority'] || 'medium',
        dueDate: options.due,
        tags: options.tags ? options.tags.split(',').map(tag => tag.trim()) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: false,
        private: options.private || false,
        isEncrypted: options.encrypt || false,
        isTest: options.test || false,
        walrusBlobId: ''
      };

      // Add the new todo to the list
      todoList.todos.push(todo);

      // Save the updated list
      if (todo.private || todo.isTest) {
        await configService.saveLocalTodo(listName, todo).catch((error: Error) => {
          throw new CLIError(`Failed to save todo: ${error.message}`, 'SAVE_ERROR');
        });
      } else {
        try {
          // For non-private todos, store in Walrus and get blob ID
          const blobId = await walrusService.storeTodo(listName, todo);
          todo.walrusBlobId = blobId;
          // Also save locally for immediate access
          await configService.saveLocalTodo(listName, todo);
        } catch (error: unknown) {
          if (error instanceof CLIError) {
            throw error;
          }
          const message = error instanceof Error ? error.message : String(error);
          throw new CLIError(`Failed to store todo: ${message}`, 'STORAGE_ERROR');
        }
      }

      // Provide user feedback for each task
      console.log(chalk.green('✔ Todo added successfully'));
      console.log(chalk.dim('Task:'), description);
    }

    // Summary feedback
    console.log(chalk.dim('\nList:'), listName);
    console.log(chalk.dim('Total tasks added:'), tasks.length);
    if (options.private || options.test) {
      console.log(chalk.dim('Storage:'), options.test ? 'Local (Test)' : 'Local only');
    }

  } catch (error: unknown) {
    if (error instanceof CLIError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CLIError(`Failed to add todos: ${message}`);
  }
}