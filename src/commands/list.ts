import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../utils/error-handler';

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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ListCommand);
    const todoService = new TodoService();

    try {
      if (args.listName) {
        const list = await todoService.getList(args.listName);
        if (!list) {
          throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
        }

        // Display list header
        console.log(chalk.blue('\n📋 List:'), chalk.bold(args.listName));
        const completed = list.todos.filter(t => t.completed).length;
        console.log(chalk.dim(`${completed}/${list.todos.length} completed\n`));

        // Filter and display todos
        let todos = list.todos;
        if (flags.completed) todos = todos.filter(t => t.completed);
        if (flags.pending) todos = todos.filter(t => !t.completed);

        if (todos.length === 0) {
          console.log(chalk.yellow('No matching todos found'));
        } else {
          todos.forEach((todo: Todo) => {
            const status = todo.completed ? chalk.green('✓') : chalk.yellow('☐');
            const priority = {
              high: chalk.red('⚡'),
              medium: chalk.yellow('○'),
              low: chalk.blue('▿')
            }[todo.priority];

            console.log(`${status} ${priority} ${todo.task}`);
            
            const details = [
              todo.dueDate && `Due: ${todo.dueDate}`,
              todo.tags?.length && `Tags: ${todo.tags.join(', ')}`,
              todo.private && 'Private'
            ].filter(Boolean);
            
            if (details.length) {
              console.log(chalk.dim(`   ${details.join(' | ')}`));
            }
          });
        }
      } else {
        // List all todo lists
        const lists = await todoService.getAllLists();
        
        if (lists.length === 0) {
          console.log(chalk.yellow('\nNo todo lists found'));
          console.log(chalk.dim('\nCreate your first list:'));
          console.log(`$ ${this.config.bin} add my-list -t "My first task"`);
          return;
        }

        console.log(chalk.blue('\n📚 Available Lists:'));
        for (const listName of lists) {
          const list = await todoService.getList(listName);
          if (list) {
            const completed = list.todos.filter(t => t.completed).length;
            console.log(`${chalk.white('•')} ${listName} ${chalk.dim(`(${completed}/${list.todos.length} completed)`)}`)
          }
        }
      }
      console.log(); // Add newline at end
    } catch (error) {
      throw error;
    }
  }
}