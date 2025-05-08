import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';

const priorityColors: Record<string, (text: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue
};

/**
 * @class ListCommand
 * @description This command displays todo items within a specified list or shows all available todo lists if no list is specified.
 * It offers filtering options to show only completed or pending todos and sorting capabilities based on priority or due date.
 * The output is formatted with color-coded status indicators for better readability.
 *
 * @param {string} [listName] - The name of the specific todo list to display. If not provided, all available lists are shown. (Optional argument)
 * @param {boolean} [completed=false] - If true, displays only completed todo items in the specified list. (Optional flag: --completed)
 * @param {boolean} [pending=false] - If true, displays only pending (not completed) todo items in the specified list. (Optional flag: --pending)
 * @param {string} [sort] - Sorts the todo items by the specified field ('priority' or 'dueDate'). (Optional flag: --sort)
 */
export default class ListCommand extends BaseCommand {
  static description = 'Display todo items or available todo lists';

  static examples = [
    '<%= config.bin %> list',
    '<%= config.bin %> list my-list',
    '<%= config.bin %> list my-list --completed',
    '<%= config.bin %> list my-list --pending'
  ];

  static flags = {
    ...BaseCommand.flags,
    completed: Flags.boolean({
      description: 'Show only completed items',
      exclusive: ['pending', 'sort']
    }),
    pending: Flags.boolean({
      description: 'Show only pending items',
      exclusive: ['completed', 'sort']
    }),
    sort: Flags.string({
      description: 'Sort todos by field (e.g., priority, dueDate)',
      options: ['priority', 'dueDate']
    })
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list to display',
      required: false
    })
  };

  private todoService = new TodoService();

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ListCommand);

      if (args.listName) {
        const list = await this.todoService.getList(args.listName);
        if (!list) {
          throw new CLIError(`List "${args.listName}" not found`, 'LIST_NOT_FOUND');
        }

        this.log(chalk.blue('\n📋 List:'), chalk.bold(args.listName));
        const completed = list.todos.filter(t => t.completed).length;
        this.log(chalk.dim(`${completed}/${list.todos.length} completed\n`));

        let todos = list.todos;
        if (flags.completed) todos = todos.filter(t => t.completed);
        if (flags.pending) todos = todos.filter(t => !t.completed);

        // Apply sorting if sort flag is provided
        if (flags.sort) {
          if (flags.sort === 'priority') {
            todos.sort((a, b) => {
              const priorityOrder = { high: 3, medium: 2, low: 1 };
              return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
          } else if (flags.sort === 'dueDate') {
            todos.sort((a, b) => {
              if (!a.dueDate) return 1; // Items without dueDate go to the end
              if (!b.dueDate) return -1;
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });
          }
        }

        if (todos.length === 0) {
          this.log(chalk.yellow('No matching todos found'));
        } else {
          todos.forEach((todo: Todo) => {
            const status = todo.completed ? chalk.green('✓') : chalk.yellow('☐');
            const priority = priorityColors[todo.priority]('⚡');

            this.log(`${status} ${priority} ${todo.title}`);

            const details = [
              todo.dueDate && `Due: ${todo.dueDate}`,
              todo.tags?.length && `Tags: ${todo.tags.join(', ')}`,
              todo.private && "Private"  // Changed to double quotes for consistency
            ].filter(Boolean);

            if (details.length) {
              this.log(chalk.dim(`   ${details.join(' | ')}`));
            }
          });
        }
      } else {
        const lists = await this.todoService.getAllLists();

        if (lists.length === 0) {
          this.log(chalk.yellow('\nNo todo lists found'));
          this.log(chalk.dim('\nCreate your first list:'));
          this.log(`$ ${this.config.bin} add my-list -t "My first task"`);
          return;
        }

        this.log(chalk.blue('\n📚 Available Lists:'));
        for (const listName of lists) {
          const list = await this.todoService.getList(listName);
          if (list) {
            const completed = list.todos.filter(t => t.completed).length;
            this.log(`${chalk.white('•')} ${listName} ${chalk.dim(`(${completed}/${list.todos.length} completed)`)}`)
          }
        }
      }
      this.log(' ');

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to list todos: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_FAILED'
      );
    }
  }
}
