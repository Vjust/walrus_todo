import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { CLIError } from '../types/error';

export default class DeleteCommand extends Command {
  static description = 'Delete a todo item or list';

  static examples = [
    '<%= config.bin %> delete my-list -i task-123',
    '<%= config.bin %> delete my-list -i task-123 --force',
    '<%= config.bin %> delete my-list --all'
  ];

  static flags = {
    id: Flags.string({
      char: 'i',
      description: 'Todo ID to delete',
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

      if (!flags.id) {
        throw new CLIError('Either --id or --all must be specified', 'MISSING_PARAMETER');
      }

      const todo = list.todos.find(t => t.id === flags.id);
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

      await this.todoService.deleteTodo(args.listName, flags.id);
      
      this.log(chalk.green('✓'), 'Deleted todo:', chalk.bold(todo.title));
      this.log(chalk.dim('List:'), args.listName);
      this.log(chalk.dim('ID:'), flags.id);

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
