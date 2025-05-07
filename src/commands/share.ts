import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

export default class ShareCommand extends Command {
  static description = 'Share a todo list with another user';

  static examples = [
    '<%= config.bin %> share --list my-list --recipient username',
    '<%= config.bin %> share my-list --recipient username'
  ];

  static flags = {
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

    } catch (error) {
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
