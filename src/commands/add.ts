import { Args, Command, Flags } from '@oclif/core';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';

export default class AddCommand extends Command {
  static description = 'Add new todo items to a list';

  static examples = [
    '<%= config.bin %> add "Buy groceries"',
    '<%= config.bin %> add "Important task" -p high',
    '<%= config.bin %> add "Meeting" --due 2024-05-01',
    '<%= config.bin %> add my-list -t "Buy groceries"',
    '<%= config.bin %> add -t "Task 1" -t "Task 2"'
  ];

  static flags = {
    task: Flags.string({
      char: 't',
      description: 'Task description (can be used multiple times)',
      required: false,
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
    }),
    list: Flags.string({
      char: 'l',
      description: 'Name of the todo list',
      default: 'default'
    })
  };

  static args = {
    title: Args.string({
      name: 'title',
      description: 'Todo title (alternative to -t flag)',
      required: false
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

      // Determine the list name - either from the list flag or default
      const listName = flags.list || 'default';

      // Determine the todo title - either from the title argument or task flag
      let todoTitle: string;
      if (args.title) {
        // Use the title argument directly
        todoTitle = args.title;
      } else if (flags.task && flags.task.length > 0) {
        // Use the task flag(s)
        todoTitle = flags.task.join(' ');
      } else {
        throw new CLIError('Todo title is required. Provide it as an argument or with -t flag', 'MISSING_TITLE');
      }

      const todo: Partial<Todo> = {
        title: todoTitle,
        priority: flags.priority as 'high' | 'medium' | 'low',
        dueDate: flags.due,
        tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
        private: flags.private
      };

      // Check if list exists first
      const listExists = await this.todoService.getList(listName);

      // If list doesn't exist, create it
      if (!listExists) {
        await this.todoService.createList(listName, 'default-owner');
        this.log(chalk.blue('ℹ') + ' Created new list: ' + chalk.cyan(listName));
      }

      // Add todo to the list
      await this.todoService.addTodo(listName, todo as Todo);

      // Get priority color
      const priorityColor = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[todo.priority || 'medium'];

      // Build output
      const outputLines = [
          chalk.green('✓') + ' Added todo: ' + chalk.bold(todoTitle),
          `  📋 List: ${chalk.cyan(listName)}`,
          `  🔄 Priority: ${priorityColor(todo.priority || 'medium')}`,
      ];
      if (todo.dueDate) {
          outputLines.push(`  📅 Due: ${chalk.blue(todo.dueDate)}`);
      }
      if (todo.tags && todo.tags.length > 0) {
          outputLines.push(`  🏷️  Tags: ${todo.tags.join(', ')}`);
      }
      outputLines.push(`  🔒 Private: ${todo.private ? chalk.yellow('Yes') : chalk.green('No')}`);
      this.log(outputLines.join('\n'));

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
