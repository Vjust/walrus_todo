import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { CLIError } from '../utils/error-handler';

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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(DeleteCommand);
    const todoService = new TodoService();

    try {
      const list = await todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
      }

      if (flags.all) {
        if (!flags.force) {
          const shouldDelete = await confirm({
            message: `Are you sure you want to delete the entire list "${args.listName}"?`,
            default: false
          });
          if (!shouldDelete) {
            console.log(chalk.yellow('Operation cancelled'));
            return;
          }
        }

        await todoService.deleteList(args.listName);
        console.log(chalk.green('✓'), `Deleted list: ${chalk.bold(args.listName)}`);
        console.log(chalk.dim(`Items removed: ${list.todos.length}`));
        return;
      }

      if (!flags.id) {
        throw new CLIError('Either --id or --all must be specified', 'MISSING_ID');
      }

      const todo = list.todos.find(t => t.id === flags.id);
      if (!todo) {
        throw new CLIError(`Todo with ID "${flags.id}" not found`, 'INVALID_TASK_ID');
      }

      if (!flags.force) {
        const shouldDelete = await confirm({
          message: `Are you sure you want to delete todo "${todo.task}"?`,
          default: false
        });
        if (!shouldDelete) {
          console.log(chalk.yellow('Operation cancelled'));
          return;
        }
      }

      list.todos = list.todos.filter(t => t.id !== flags.id);
      await todoService.saveList(args.listName, list);
      
      console.log(chalk.green('✓'), 'Deleted todo:', chalk.bold(todo.task));
      console.log(chalk.dim('List:'), args.listName);
      console.log(chalk.dim('ID:'), flags.id);

    } catch (error) {
      throw error;
    }
  }
}