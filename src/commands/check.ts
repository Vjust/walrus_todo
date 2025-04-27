/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */

import chalk from 'chalk';
import { walrusService } from '../services/walrus-service';
import { Command } from 'commander';
import { TodoService } from '../services/todoService';
import { Todo, TodoList } from '../types';

/**
 * Interface for check command options
 * @interface CheckOptions
 */
interface CheckOptions {
  list: string;
  id: string;
  uncheck?: boolean;
}

/**
 * Toggles or sets the completion status of a todo item
 * @param options - Command line options for checking/unchecking todo
 */
export async function check(options: CheckOptions): Promise<void> {
  try {
    const { list, id, uncheck } = options;
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

    // Toggle or set completion status
    todo.completed = uncheck ? false : true;
    await walrusService.updateTodo(list, todo);
    
    const status = todo.completed ? 'checked' : 'unchecked';
    console.log(chalk.green(`✔ Marked todo as ${status}`));
    console.log(chalk.dim('List:'), list);
    console.log(chalk.dim('Task:'), todo.task);

  } catch (error) {
    console.error(chalk.red('Failed to update todo status:'), error);
    process.exit(1);
  }
}

export function setupCheckCommands(program: Command) {
  // Check command with list subcommand
  program
    .command('check')
    .argument('[list]', 'list command or list name')
    .argument('[listName]', 'name of the list')
    .argument('[itemNumber]', 'number or ID of the item')
    .option('--uncheck', 'uncheck instead of check')
    .description('Check/uncheck a todo item')
    .action(async (list, listName, itemNumber, options) => {
      if (list === 'list') {
        await handleCheckByNumber(listName, parseInt(itemNumber) || itemNumber, !options.uncheck);
      }
    });

  // Uncheck command with list subcommand
  program
    .command('uncheck')
    .argument('[list]', 'list command or list name')
    .argument('[listName]', 'name of the list')
    .argument('[itemNumber]', 'number or ID of the item')
    .description('Uncheck a todo item')
    .action(async (list, listName, itemNumber) => {
      if (list === 'list') {
        await handleCheckByNumber(listName, parseInt(itemNumber) || itemNumber, false);
      }
    });
}

async function handleCheckByNumber(listName: string, itemNumber: number | string, checked: boolean) {
  try {
    const todoService = new TodoService();
    const list = await todoService.getList(listName);
    
    if (!list) {
      throw new Error(`List "${listName}" not found`);
    }

    let item: Todo | undefined;
    if (typeof itemNumber === 'number') {
      // Use array index if number provided
      item = list.todos[itemNumber - 1];
    } else {
      // Use item ID if string provided
      item = list.todos.find((i: Todo) => i.id === itemNumber);
    }

    if (!item) {
      throw new Error(`Item ${itemNumber} not found in list "${listName}"`);
    }

    await todoService.toggleItemStatus(listName, item.id, checked);
    console.log(chalk.green(`Item ${itemNumber} ${checked ? 'checked' : 'unchecked'} ✓`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}