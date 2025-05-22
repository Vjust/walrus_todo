import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

/**
 * @class ShareCommand
 * @description This command enables users to share a specific todo list with another user by adding them as a collaborator.
 * It checks if the list exists and if the recipient is already a collaborator before updating the list's sharing settings.
 * The command provides feedback on the successful sharing of the list with the specified user.
 *
 * @param {string} [listName] - The name of the todo list to share. Can also be provided via the --list flag. (Optional argument)
 * @param {string} [list] - The name of the todo list to share. Alternative to providing it as an argument. (Optional flag: -l, --list)
 * @param {string} recipient - The username of the person to share the list with. (Required flag: -r, --recipient)
 */
export default class ShareCommand extends BaseCommand {
  static description = 'Share a todo list with another user';

  static examples = [
    '<%= config.bin %> share --list my-list --recipient username',
    '<%= config.bin %> share my-list --recipient username'
  ];

  static flags = {
    ...BaseCommand.flags,
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list to share',
      required: false,
    }),
    recipient: Flags.string({
      char: 'r', 
      description: 'Username to share with',
      required: true,
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list to share (alternative to --list flag)',
      required: false
    })
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ShareCommand);
      
      // Use either the listName argument or the list flag
      const listName = args.listName || flags.list;
      
      if (!listName) {
        throw new CLIError('List name is required. Provide it as an argument or with --list flag', 'MISSING_LIST');
      }
      
      const { recipient } = flags;

      // Get the list
      const todoList = await this.todoService.getList(listName);
      if (!todoList) {
        throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
      }

      // Update collaborators
      todoList.collaborators = todoList.collaborators || [];
      if (todoList.collaborators.includes(recipient)) {
        throw new CLIError(`User "${recipient}" already has access to list "${listName}"`, 'ALREADY_SHARED');
      }

      todoList.collaborators.push(recipient);
      todoList.updatedAt = new Date().toISOString();

      await this.todoService.saveList(listName, todoList);
      this.log(chalk.green('✓'), `Todo list "${chalk.bold(listName)}" shared successfully with ${chalk.cyan(recipient)}`);

    } catch (_error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to share list: ${error instanceof Error ? error.message : String(error)}`,
        'SHARE_FAILED'
      );
    }
  }
}
