import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/errors/consolidated';

/**
 * @class DeleteCommand
 * @description This command allows users to delete either a specific todo item or an entire todo list from local storage.
 * It provides options to bypass confirmation prompts and handles user input for selecting items to delete if not specified.
 * The command offers a safety mechanism with confirmation prompts to prevent accidental deletions unless the force option is used.
 *
 * @param {string} listName - The name of the todo list to delete from or delete entirely. (Required argument)
 * @param {string} [id] - The ID or title of the specific todo item to delete. (Optional flag: -i, --id)
 * @param {boolean} [all=false] - If true, deletes the entire list instead of a specific item. (Optional flag: -a, --all)
 * @param {boolean} [force=false] - If true, skips the confirmation prompt before deletion. (Optional flag: -f, --force)
 */
export default class DeleteCommand extends BaseCommand {
  static description = 'Delete a specific todo item or an entire list';

  static examples = [
    '<%= config.bin %> delete my-list -i task-123              # Delete by ID',
    '<%= config.bin %> delete my-list -i "Buy groceries"      # Delete by title',
    '<%= config.bin %> delete my-list -i task-123 --force     # Force delete without confirmation',
    '<%= config.bin %> delete my-list --all                   # Delete all todos in list',
    '<%= config.bin %> delete -i todo-456                     # Delete from default list',
    '<%= config.bin %> delete work --all --force              # Force delete all work todos'
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to delete',
      exclusive: ['all']
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Delete entire list',
      exclusive: ['id']
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
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

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(DeleteCommand);

      const list = await this.todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'LIST_NOT_FOUND');
      }

      if (flags.all) {
        if (!flags.force) {
          const shouldDelete = await confirm({
            message: `Are you sure you want to delete the entire list "${args.listName}"?`,
            default: false
          });
          if (!shouldDelete) {
            this.log(chalk.yellow('Operation cancelled'));
            return;
          }
        }

        await this.todoService.deleteList(args.listName);
        this.log(chalk.green('✓'), `Deleted list: ${chalk.bold(args.listName)}`);
        this.log(chalk.dim(`Items removed: ${list.todos.length}`));
        return;
      }

      if (!flags.id && !flags.all) {
        // Instead of throwing an error, ask the user what they want to delete
        this.log(chalk.yellow('⚠️'), `You must specify either a todo ID (--id) or --all to delete the entire list`);
        
        // Provide a helpful example
        this.log(chalk.dim('\nExamples:'));
        this.log(chalk.dim(`  ${this.config.bin} delete ${args.listName} --id <todo-id>     # Delete a specific todo`));
        this.log(chalk.dim(`  ${this.config.bin} delete ${args.listName} --all              # Delete the entire list\n`));
        
        const shouldDeleteAll = await confirm({
          message: `Do you want to delete the entire "${args.listName}" list?`,
          default: false
        });
        
        if (shouldDeleteAll) {
          // Rather than recursively calling run() which causes the issue we're seeing,
          // just directly call the delete list function
          await this.todoService.deleteList(args.listName);
          this.log(chalk.green('✓'), `Deleted list: ${chalk.bold(args.listName)}`);
          this.log(chalk.dim(`Items removed: ${list.todos.length}`));
          return;
        } else {
          // Show available todos in the list to help user pick an ID
          this.log(chalk.blue('\nAvailable todos in list:'));
          list.todos.forEach(todo => {
            this.log(`  ${chalk.dim(todo.id)}: ${todo.title}`);
          });
          
          this.log(chalk.yellow('\nPlease run the command again with a specific ID'));
          return;
        }
      }

      // At this point, if flags.id is defined, it should be a string
      // But let's make sure it's not undefined to satisfy TypeScript
      if (!flags.id) {
        throw new CLIError('Todo ID is required', 'MISSING_PARAMETER');
      }

      // Use the new lookup method to find todo by title or ID
      const todo = await this.todoService.getTodoByTitleOrId(flags.id, args.listName);
      if (!todo) {
        throw new CLIError(`Todo "${flags.id}" not found in list "${args.listName}"`, 'TODO_NOT_FOUND');
      }

      if (!flags.force) {
        const shouldDelete = await confirm({
          message: `Are you sure you want to delete todo "${todo.title}"?`,
          default: false
        });
        if (!shouldDelete) {
          this.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      // Use todo.id which is the actual ID (in case user provided a title)
      await this.todoService.deleteTodo(args.listName, todo.id);
      
      this.log(chalk.green('✓'), 'Deleted todo:', chalk.bold(todo.title));
      this.log(chalk.dim('List:'), args.listName);
      this.log(chalk.dim('ID:'), todo.id);

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to delete todo: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_FAILED'
      );
    }
  }
}
