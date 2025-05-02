import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
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
      const todo: Todo = {
        id: generateId(),
        title: flags.task[0], // Use first task string as title
        task: flags.task.join(' '), // Join all task strings for backward compatibility
        completed: false,
        priority: flags.priority as 'high' | 'medium' | 'low',
        tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
        createdAt: now,
        updatedAt: now,
        private: flags.private
      };

      if (flags.due) {
        todo.dueDate = flags.due;
      }

      await this.todoService.addTodo(args.list, todo);

      // Get priority color
      const priorityColors = {
        high: chalk.red,
        medium: chalk.yellow,
        low: chalk.green
      }[todo.priority];

      // Success message
      this.log(chalk.green('\n✓ Todo added successfully'));
      this.log(chalk.dim('Details:'));
      this.log([
        `  ${chalk.bold(todo.title)}`,
        `  ${priorityColors(`⚡ Priority: ${todo.priority}`)}`,
        flags.due && `  📅 Due: ${flags.due}`,
        todo.tags.length > 0 && `  🏷️  Tags: ${todo.tags.join(', ')}`,
        flags.private && '  🔒 Private'
      ].filter(Boolean).join('\n'));

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