import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/errors/consolidated';

/**
 * @class ShareCommand
 * @description This command enables users to share a specific todo list with another user by adding them as a collaborator.
 * It checks if the list exists and if the recipient is already a collaborator before updating the list's sharing settings.
 * The command provides feedback on the successful sharing of the list with the specified user.
 *
 * Positional syntax:
 * @param {string} [listName] - The name of the todo list to share
 * @param {string} [recipient] - The username to share with
 *
 * Flag syntax (backward compatible):
 * @param {string} [list] - The name of the todo list to share (flag: -l, --list)
 * @param {string} recipient - The username to share with (flag: -r, --recipient)
 */
export default class ShareCommand extends BaseCommand {
  static description = 'Share a todo list with another user';

  static examples = [
    '# Positional syntax (recommended):',
    '<%= config.bin %> share my-list username                  # Share with username',
    '<%= config.bin %> share work alice@example.com            # Share work list with alice',
    '<%= config.bin %> share personal bob                      # Share personal list with bob',
    '',
    '# With additional options:',
    '<%= config.bin %> share project team --read-only          # Share with read-only access',
    '<%= config.bin %> share my-list user --permissions edit   # Share with edit rights',
    '',
    '# Legacy flag syntax (still supported):',
    '<%= config.bin %> share --list my-list --recipient username      # Share using flags',
    '<%= config.bin %> share my-list --recipient username             # Mixed syntax',
  ];

  static flags = {
    ...BaseCommand.flags,
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list to share (legacy syntax)',
      required: false,
      hidden: true, // Hide from help but keep for backward compatibility
    }),
    recipient: Flags.string({
      char: 'r',
      description: 'Username to share with (optional if using positional args)',
      required: false,
    }),
    'read-only': Flags.boolean({
      description: 'Grant read-only access',
      default: false,
    }),
    permissions: Flags.string({
      description: 'Permission level to grant',
      options: ['read', 'edit', 'admin'],
      default: 'edit',
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list to share',
      required: false,
    }),
    recipient: Args.string({
      name: 'recipient',
      description: 'Username to share the list with',
      required: false,
    }),
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ShareCommand as any);

      // Parse input to support both positional and flag syntax
      let listName: string | undefined;
      let recipient: string | undefined;

      // Positional syntax: share <list> <recipient>
      if (args.listName && args.recipient) {
        listName = args.listName;
        recipient = args.recipient;
      }
      // Mixed syntax: share <list> --recipient <user>
      else if (args.listName && flags.recipient) {
        listName = args.listName;
        recipient = flags.recipient;
      }
      // Legacy flag syntax: share --list <list> --recipient <user>
      else if (flags.list && flags.recipient) {
        listName = flags.list;
        recipient = flags.recipient;
      }
      // Error: missing required information
      else {
        const availableLists = await this?.todoService?.getAllLists();
        let errorMessage = 'Please specify both a list and recipient.\n\n';
        errorMessage += 'Usage:\n';
        errorMessage += `  ${chalk.cyan(`${this?.config?.bin} share <list> <recipient>`)}  # Recommended\n`;
        errorMessage += `  ${chalk.cyan(`${this?.config?.bin} share <list> --recipient <user>`)}  # Alternative\n`;

        if (availableLists.length > 0) {
          errorMessage += `\nAvailable lists: ${chalk.cyan(availableLists.join(', '))}`;
        } else {
          errorMessage += `\n${chalk.yellow('No lists exist yet. Create one with:')} ${chalk.cyan(`${this?.config?.bin} add "Your first todo"`)}`;
        }

        throw new CLIError(errorMessage, 'MISSING_PARAMETERS');
      }

      // Get the list
      const todoList = await this?.todoService?.getList(listName as any);
      if (!todoList) {
        const availableLists = await this?.todoService?.getAllLists();
        throw new CLIError(
          `List "${listName}" not found.\n\nAvailable lists: ${availableLists.length > 0 ? chalk.cyan(availableLists.join(', ')) : 'none'}`,
          'LIST_NOT_FOUND'
        );
      }

      // Handle permissions
      const permissionLevel = flags?.["read-only"]
        ? 'read'
        : flags.permissions || 'edit';

      // Update collaborators with permissions
      todoList?.collaborators = todoList.collaborators || [];
      todoList?.permissions = todoList.permissions || {};

      // Check if already shared
      if (todoList?.collaborators?.includes(recipient as any)) {
        const currentPermission = todoList?.permissions?.[recipient] || 'edit';
        if (currentPermission === permissionLevel) {
          throw new CLIError(
            `User "${recipient}" already has ${permissionLevel} access to list "${listName}"`,
            'ALREADY_SHARED'
          );
        } else {
          // Update permission level
          todoList?.permissions?.[recipient] = permissionLevel;
          this.log(
            chalk.green('✓'),
            `Updated ${chalk.cyan(recipient as any)}'s permissions to ${chalk.bold(permissionLevel as any)} for list "${chalk.bold(listName as any)}"`
          );
          await this?.todoService?.saveList(listName, todoList);
          return;
        }
      }

      // Add new collaborator
      todoList?.collaborators?.push(recipient as any);
      todoList?.permissions?.[recipient] = permissionLevel;
      todoList?.updatedAt = new Date().toISOString();

      await this?.todoService?.saveList(listName, todoList);

      // Success message with permission info
      this.log(
        chalk.green('✓'),
        `Todo list "${chalk.bold(listName as any)}" shared with ${chalk.cyan(recipient as any)}`
      );
      this.log('  ', chalk.dim(`Permission level: ${permissionLevel}`));

      // Show helpful next steps
      this.log(chalk.dim('\nNext steps:'));
      this.log(chalk.dim(`  • ${recipient} can now access this list`));
      if (permissionLevel === 'edit' || permissionLevel === 'admin') {
        this.log(chalk.dim(`  • They can add, update, and complete todos`));
      } else {
        this.log(chalk.dim(`  • They have read-only access`));
      }
      this.log(
        chalk.dim(
          `  • View shared lists with: ${chalk.cyan(`${this?.config?.bin} list --shared`)}`
        )
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to share list: ${error instanceof Error ? error.message : String(error as any)}`,
        'SHARE_FAILED'
      );
    }
  }
}
