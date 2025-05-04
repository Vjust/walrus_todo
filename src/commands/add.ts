import { Args, Command, Flags } from '@oclif/core';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { generateId } from '../utils';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';

export default class AddCommand extends Command {
  static description = 'Add new todo items to a list';

  static examples = [
    '<%= config.bin %> add my-list -t "Buy groceries"',
    '<%= config.bin %> add my-list -t "Important task" -p high',
    '<%= config.bin %> add my-list -t "Meeting" --due 2024-05-01'
  ];

  static flags = {
    task: Flags.string({
      char: 't',
      description: 'Task description',
      required: true,
      multiple: true
    }),
    priority: Flags.string({
      char: 'p',
      description: 'Task priority (high, medium, low)',
      options: ['high', 'medium', 'low'],
      default: 'medium'
    }),
    due: Flags.string({
      char: 'd',
      description: 'Due date (YYYY-MM-DD)'
    }),
    tags: Flags.string({
      char: 'g',
      description: 'Comma-separated tags'
    }),
    private: Flags.boolean({
      description: 'Mark todo as private',
      default: false
    })
  };

  static args = {
    list: Args.string({
      name: 'list',
      description: 'Name of the todo list',
      default: 'default'
    })
  };

  private todoService = new TodoService();

  private validateDate(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;

    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(AddCommand);
      
      if (flags.due && !this.validateDate(flags.due)) {
        throw new CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
      }

      const now = new Date().toISOString();
      const todo: Partial<Todo> = {
        title: flags.task.join(' '), // Join all task strings for backward compatibility
        priority: flags.priority as 'high' | 'medium' | 'low',
        dueDate: flags.due,
        tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
        private: flags.private
      };

      await this.todoService.addTodo(args.list, todo as Todo);

      // Get priority color
      const priorityColor = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[todo.priority || 'medium'];

      // Build output
      this.log(
        chalk.green('✓') + ' Added todo: ' + chalk.bold(flags.task.join(' ')),
        '\n',
        '  📋 List: ' + chalk.cyan(args.list || 'default'),
        '\n',
        todo.dueDate && `  📅 Due: ${chalk.blue(todo.dueDate)}`,
        '\n',
        `  🔄 Priority: ${priorityColor(todo.priority || 'medium')}`,
        '\n',
        (todo.tags && todo.tags.length > 0) && `  🏷️  Tags: ${todo.tags.join(', ')}`,
        '\n',
        `  🔒 Private: ${todo.private ? chalk.yellow('Yes') : chalk.green('No')}`
      );

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to add todo: ${error instanceof Error ? error.message : String(error)}`,
        'ADD_FAILED'
      );
    }
  }
}