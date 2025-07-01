/**
 * Check Command Module
 * Toggles completion status of todo items
 * Supports both local and Walrus-stored items
 */

import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import { TodoService } from '../services/todo';
import { CLIError } from '../types/errors/consolidated';
import chalk = require('chalk');
import dotenv from 'dotenv';

dotenv.config();

/**
 * @class CheckCommand
 * @description This command toggles the completion status of a specific todo item within a given list.
 * Users can mark a todo as complete or incomplete using its ID.
 * It primarily interacts with the local JSON storage for todos.
 *
 * @param {string} listName - The name of the list containing the todo item. (Required argument)
 * @param {string} id - The ID of the todo item to be checked or unchecked. (Required flag: -i, --id)
 * @param {boolean} [uncheck=false] - If true, marks the todo as incomplete; otherwise, marks it as complete. (Optional flag: -u, --uncheck)
 */
export default class CheckCommand extends BaseCommand {
  static description = 'Toggle completion status of a todo item';

  static examples = [
    '<%= config.bin %> check my-list -i task-123              # Mark as checked/in-progress',
    '<%= config.bin %> check my-list -i task-123 --uncheck    # Uncheck/remove in-progress',
    '<%= config.bin %> check work -i "Review PR"              # Check by title',
    '<%= config.bin %> check -i todo-456                      # Check in default list',
    '<%= config.bin %> check personal -i task-789 --toggle    # Toggle check status',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID',
      required: true,
    }),
    uncheck: Flags.boolean({
      char: 'u',
      description: 'Uncheck the todo instead of checking it',
      default: false,
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list',
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CheckCommand);
    const todoService = new TodoService();

    try {
      const list = await todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
      }

      const todo = list?.todos?.find(t => t?.id === flags.id);
      if (!todo) {
        throw new CLIError(
          `Todo with ID "${flags.id}" not found in list "${args.listName}"`,
          'INVALID_TASK_ID'
        );
      }

      todo?.completed = !flags.uncheck;
      todo?.updatedAt = new Date().toISOString();

      await todoService.saveList(args.listName, list);

      const status = todo.completed ? chalk.green('✓') : chalk.yellow('☐');
      this.log(
        `${status} Todo ${chalk.bold(todo.title)} marked as ${todo.completed ? 'complete' : 'incomplete'}`
      );
      this.log(chalk.dim('List: ' + args.listName)); // Changed to double quotes for consistency
      this.log(chalk.dim('ID: ' + flags.id)); // Changed to double quotes for consistency
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
