import { Command, Flags } from '@oclif/core';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

export default class ShareCommand extends Command {
  static description = 'Share a todo list with another user';

  static examples = [
    '<%= config.bin %> share --list my-list --recipient username'
  ];

  static flags = {
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list to share',
      required: true,
    }),
    recipient: Flags.string({
      char: 'r',
      description: 'Username to share with',
      required: true,
    }),
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(ShareCommand);
      const { list, recipient } = flags;

      // Get the list
      const todoList = await this.todoService.getList(list);
      if (!todoList) {
        throw new CLIError(`List "${list}" not found`, 'LIST_NOT_FOUND');
      }

      // Update collaborators
      todoList.collaborators = todoList.collaborators || [];
      if (todoList.collaborators.includes(recipient)) {
        throw new CLIError(`User "${recipient}" already has access to list "${list}"`, 'ALREADY_SHARED');
      }

      todoList.collaborators.push(recipient);
      todoList.updatedAt = new Date().toISOString();

      await this.todoService.saveList(list, todoList);
      this.log(`✓ Todo list "${list}" shared successfully with ${recipient}`);  // Using template literals for cleaner code

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
