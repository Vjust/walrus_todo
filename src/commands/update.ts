import { Args, Flags } from '@oclif/core';
import { BaseCommand } from '../base-command';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { validateDate, validatePriority } from '../utils';
import { Todo } from '../types/todo';
import { CLIError } from '../utils/error-handler';

/**
 * @class UpdateCommand
 * @description This command allows users to update various properties of an existing todo item within a specified list.
 * It supports updating the title, priority, due date, tags, and privacy status of the todo.
 * The command ensures that the list and todo exist before applying changes and provides feedback on the updates made.
 *
 * @param {string} listName - The name of the todo list containing the item to update. (Required argument)
 * @param {string} id - The ID or title of the todo item to update. (Required flag: -i, --id)
 * @param {string} [task] - The new title or description for the todo item. (Optional flag: -t, --task)
 * @param {string} [priority] - The new priority level for the todo ('high', 'medium', 'low'). (Optional flag: -p, --priority)
 * @param {string} [due] - The new due date for the todo in YYYY-MM-DD format. (Optional flag: -d, --due)
 * @param {string} [tags] - New comma-separated tags to assign to the todo. (Optional flag: -g, --tags)
 * @param {boolean} [private] - If provided, sets the privacy status of the todo. (Optional flag: --private)
 */
export default class UpdateCommand extends BaseCommand {
  static description = 'Update properties of an existing todo item';

  static examples = [
    '<%= config.bin %> update my-list -i task-123 -t "Updated task"',
    '<%= config.bin %> update my-list -i "Buy groceries" -p high',
    '<%= config.bin %> update my-list -i task-123 -d 2024-05-01'
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to update',
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

      // Find todo by title or ID
      const todo = await todoService.getTodoByTitleOrId(flags.id, args.listName);
      if (!todo) {
        throw new CLIError(`Todo "${flags.id}" not found in list "${args.listName}"`, 'INVALID_TASK_ID');
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
          throw new CLIError("Invalid priority. Must be high, medium, or low", 'INVALID_PRIORITY');  // Changed to double quotes for consistency
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
      this.log(chalk.dim('ID: ') + todo.id);
      this.log(chalk.dim(`Changes made: ${changes}`));

    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Failed to update todo: ${error instanceof Error ? error.message : String(error)}`,
        'UPDATE_FAILED'
      );
    }
  }
}
