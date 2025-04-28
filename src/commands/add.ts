import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { generateId, validateDate } from '../utils';
import { Todo } from '../types/todo';
import { CLIError } from '../utils/error-handler';

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
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list',
      required: true
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AddCommand);
    const todoService = new TodoService();

    try {
      // Create or get the list
      let list = await todoService.getList(args.listName);
      if (!list) {
        list = {
          id: args.listName,
          name: args.listName,
          owner: 'local',
          todos: [],
          version: 1
        };
        console.log(chalk.blue('✨ Created new list:'), chalk.bold(args.listName));
      }

      console.log(chalk.blue('\nAdding tasks to:'), chalk.bold(args.listName));

      // Add each task from the -t flags
      for (const taskText of flags.task) {
        const todo: Todo = {
          id: generateId(),
          task: taskText,
          completed: false,
          priority: flags.priority as 'high' | 'medium' | 'low',
          tags: flags.tags ? flags.tags.split(',').map(t => t.trim()) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          private: flags.private
        };

        if (flags.due) {
          if (!validateDate(flags.due)) {
            throw new CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
          }
          todo.dueDate = flags.due;
        }

        list.todos.push(todo);

        // Enhanced feedback with emoji indicators
        const priorityEmoji = {
          high: '⚡',
          medium: '○',
          low: '▿'
        }[todo.priority];

        console.log(chalk.green('✓'), 'Added:', chalk.bold(taskText));
        
        const details = [
          `${priorityEmoji} Priority: ${todo.priority}`,
          flags.due && `📅 Due: ${flags.due}`,
          todo.tags.length > 0 && `🏷️  Tags: ${todo.tags.join(', ')}`,
          flags.private && '🔒 Private'
        ].filter(Boolean);

        if (details.length) {
          console.log(chalk.dim(`  ${details.join(' | ')}`));
        }
      }

      await todoService.saveList(args.listName, list);
      console.log(chalk.blue('\nSummary:'));
      console.log(chalk.dim(`• List: ${args.listName}`));
      console.log(chalk.dim(`• Total items: ${list.todos.length}`));
      console.log(chalk.dim(`• Added: ${flags.task.length} task(s)`));

    } catch (error) {
      throw error;
    }
  }
}