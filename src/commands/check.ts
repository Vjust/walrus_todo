/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */

import { Args, Command, Flags } from '@oclif/core';
import { TodoService } from '../services/todoService';
// Removed unused formatTodoOutput import
import chalk from 'chalk';
import { CLIError } from '../utils/error-handler';
import dotenv from 'dotenv';

dotenv.config();

export default class CheckCommand extends Command {
  static description = 'Mark a todo item as complete/incomplete';

  static examples = [
    '<%= config.bin %> check my-list -i task-123',
    '<%= config.bin %> check my-list -i task-123 --uncheck'
  ];

  static flags = {
    id: Flags.string({
      char: 'i',
      description: 'Todo ID',
      required: true
    }),
    uncheck: Flags.boolean({
      char: 'u',
      description: 'Uncheck the todo instead of checking it',
      default: false
    })
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list',
      required: true
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CheckCommand);
    const todoService = new TodoService();

    try {
      const list = await todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
      }

      const todo = list.todos.find(t => t.id === flags.id);
      if (!todo) {
        throw new CLIError(`Todo with ID "${flags.id}" not found in list "${args.listName}"`, 'INVALID_TASK_ID');
      }

      todo.completed = !flags.uncheck;
      todo.updatedAt = new Date().toISOString();
      
      await todoService.saveList(args.listName, list);

      const status = todo.completed ? chalk.green('✓') : chalk.yellow('☐');
      console.log(`${status} Todo ${chalk.bold(todo.title)} marked as ${todo.completed ? 'complete' : 'incomplete'}`);
      console.log(chalk.dim("List: " + args.listName));  // Changed to double quotes for consistency
      console.log(chalk.dim("ID: " + flags.id));  // Changed to double quotes for consistency

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to check todo: ${error instanceof Error ? error.message : String(error)}`,
        'CHECK_FAILED'
      );
    }
  }
}
