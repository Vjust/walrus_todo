/**
 * Update Command Module
 * Handles modifications to existing todo items
 * Supports updating both local and Walrus-stored items
 */

import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { walrusService } from '../services/walrus-service';
import { validateDate, validatePriority } from '../utils';
import { Todo } from '../types';

/**
 * Interface for update command options
 * @interface UpdateOptions
 */
interface UpdateOptions {
  list: string;
  id: string;
  description?: string;
  priority?: string;
  due?: string;
  tags?: string;
}

/**
 * Updates an existing todo item
 * @param options - Command line options for updating todo
 */
export async function update(options: UpdateOptions): Promise<void> {
  try {
    const { list, id } = options;
    const todoList = await walrusService.getTodoList(list);
    
    if (!todoList) {
      console.error(chalk.red(`Todo list '${list}' not found`));
      process.exit(1);
    }

    const todo = todoList.todos.find(t => t.id === id);
    if (!todo) {
      console.error(chalk.red(`Todo with id '${id}' not found`));
      process.exit(1);
    }

    // Update description if provided or prompted
    if (options.description) {
      todo.description = options.description;
    }

    // Update priority if provided or prompted
    if (options.priority) {
      if (!validatePriority(options.priority)) {
        console.error(chalk.red('Invalid priority. Must be high, medium, or low'));
        process.exit(1);
      }
      todo.priority = options.priority as Todo['priority'];
    }

    // Update due date if provided
    if (options.due) {
      if (!validateDate(options.due)) {
        console.error(chalk.red('Invalid date format. Use YYYY-MM-DD'));
        process.exit(1);
      }
      todo.dueDate = options.due;
    }

    // Update tags if provided
    if (options.tags) {
      todo.tags = options.tags.split(',').map(tag => tag.trim());
    }

    await walrusService.updateTodo(list, todo);
    console.log(chalk.green('✔ Todo updated successfully'));
    console.log(chalk.dim('List:'), list);
    console.log(chalk.dim('ID:'), id);

  } catch (error) {
    console.error(chalk.red('Failed to update todo:'), error);
    process.exit(1);
  }
}