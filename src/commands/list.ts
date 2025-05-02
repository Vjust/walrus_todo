import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';

const priorityColors: Record<string, (text: string) => string> = {
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue
};

export default class ListCommand extends Command {
  static description = 'List todos or todo lists';

  static examples = [
    '<%= config.bin %> list',
    '<%= config.bin %> list my-list',
    '<%= config.bin %> list my-list --completed',
    '<%= config.bin %> list my-list --pending'
  ];

  static flags = {
    completed: Flags.boolean({
      description: 'Show only completed items',
      exclusive: ['pending']
    }),
    pending: Flags.boolean({
      description: 'Show only pending items',
      exclusive: ['completed']
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

        if (todos.length === 0) {
          this.log(chalk.yellow('No matching todos found'));
        } else {
          todos.forEach((todo: Todo) => {
            const status = todo.completed ? chalk.green('✓') : chalk.yellow('☐');
            const priority = priorityColors[todo.priority]('⚡');

            this.log(`${status} ${priority} ${todo.task}`);
            
            const details = [
              todo.dueDate && `Due: ${todo.dueDate}`,
              todo.tags?.length && `Tags: ${todo.tags.join(', ')}`,
              todo.private && 'Private'
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
      this.log();

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