import { Args, Command, Flags } from '@oclif/core';
// Use require for chalk since it's an ESM module
const chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { validateDate, validatePriority } from '../utils';
import { Todo } from '../types/todo';
import { CLIError } from '../utils/error-handler';

export default class UpdateCommand extends Command {
  static description = 'Update an existing todo item';

  static examples = [
    '<%= config.bin %> update my-list -i task-123 -t "Updated task"',
    '<%= config.bin %> update my-list -i task-123 -p high',
    '<%= config.bin %> update my-list -i task-123 -d 2024-05-01'
  ];

  static flags = {
    id: Flags.string({
      char: 'i',
      description: 'Todo ID to update',
      required: true
    }),
    task: Flags.string({
      char: 't',
      description: 'New task description'
    }),
    priority: Flags.string({
      char: 'p',
      description: 'New priority (high, medium, low)',
      options: ['high', 'medium', 'low']
    }),
    due: Flags.string({
      char: 'd',
      description: 'New due date (YYYY-MM-DD)'
    }),
    tags: Flags.string({
      char: 'g',
      description: 'New comma-separated tags'
    }),
    private: Flags.boolean({
      description: 'Mark todo as private'
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
    const { args, flags } = await this.parse(UpdateCommand);
    const todoService = new TodoService();

    try {
      const list = await todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'INVALID_LIST');
      }

      const todo = list.todos.find(t => t.id === flags.id);
      if (!todo) {
        throw new CLIError(`Todo with ID "${flags.id}" not found`, 'INVALID_TASK_ID');
      }

      let changes = 0;

      // Update task if provided
      if (flags.task) {
        todo.title = flags.task;
        changes++;
      }

      // Update priority if provided
      if (flags.priority) {
        if (!validatePriority(flags.priority)) {
          throw new CLIError('Invalid priority. Must be high, medium, or low', 'INVALID_PRIORITY');
        }
        todo.priority = flags.priority as Todo['priority'];
        changes++;
      }

      // Update due date if provided
      if (flags.due) {
        if (!validateDate(flags.due)) {
          throw new CLIError('Invalid date format. Use YYYY-MM-DD', 'INVALID_DATE');
        }
        todo.dueDate = flags.due;
        changes++;
      }

      // Update tags if provided
      if (flags.tags) {
        todo.tags = flags.tags.split(',').map(tag => tag.trim());
        changes++;
      }

      // Update private flag if provided
      if (flags.private !== undefined) {
        todo.private = flags.private;
        changes++;
      }

      if (changes === 0) {
        this.log(chalk.yellow('No changes specified. Use -h to see available options.'));
        return;
      }

      todo.updatedAt = new Date().toISOString();
      await todoService.saveList(args.listName, list);

      this.log(chalk.green('✓') + ' Updated todo: ' + chalk.bold(todo.title));
      this.log(chalk.dim('List: ') + args.listName);
      this.log(chalk.dim('ID: ') + flags.id);
      this.log(chalk.dim(`Changes made: ${changes}`));

    } catch (error) {
      throw error;
    }
  }
}