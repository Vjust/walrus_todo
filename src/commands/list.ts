import { Args, Flags } from '@oclif/core';
import chalk from 'chalk';
import BaseCommand, { ICONS, PRIORITY } from '../base-command';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';

/**
 * @class ListCommand
 * @description This command displays todo items within a specified list or shows all available todo lists if no list is specified.
 * It offers filtering options to show only completed or pending todos and sorting capabilities based on priority or due date.
 * The output is formatted with color-coded status indicators for better readability.
 */
export default class ListCommand extends BaseCommand {
  static description = 'Display todo items or available todo lists (compact view by default)';

  static examples = [
    `<%= config.bin %> list                     # Show all available lists`,
    `<%= config.bin %> list my-list             # Show todos in "my-list" (compact view by default)`,
    `<%= config.bin %> list my-list --detailed  # Show todos with full details`,
    `<%= config.bin %> list my-list --completed # Show only completed todos`,
    `<%= config.bin %> list my-list --pending   # Show only pending todos`,
    `<%= config.bin %> list my-list --sort priority # Sort todos by priority`
  ];

  static flags = {
    ...BaseCommand.flags,
    completed: Flags.boolean({
      description: 'Show only completed items',
      exclusive: ['pending']
    }),
    pending: Flags.boolean({
      description: 'Show only pending items',
      exclusive: ['completed']
    }),
    sort: Flags.string({
      description: 'Sort todos by field',
      options: ['priority', 'dueDate']
    }),
    compact: Flags.boolean({
      description: 'Display in compact format without details (default)',
      char: 'c',
      default: true
    }),
    detailed: Flags.boolean({
      description: 'Display in detailed format with full information',
      char: 'd',
      exclusive: ['compact']
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
  private listName: string = ''; // Property to store the current list name

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ListCommand);
      this.debugLog(`Command parsed with args: ${JSON.stringify(args)}`);

      // If JSON output is requested, handle it separately
      if (await this.isJson()) {
        return this.handleJsonOutput(args, flags);
      }

      if (args.listName) {
        // Store list name in the class property
        this.listName = args.listName;
        // Show specific list
        await this.showSpecificList(args.listName, flags);
      } else {
        // Show all available lists
        await this.showAllLists();
      }

    } catch (error) {
      this.debugLog(`Error: ${error}`);

      if (error instanceof CLIError && error.code === 'LIST_NOT_FOUND') {
        // Provide helpful guidance when a list is not found
        this.errorWithHelp(
          'List not found',
          `List "${this.listName}" not found`,
          `Try running '${this.config.bin} list' to see all available lists`
        );
      }

      if (error instanceof CLIError) {
        throw error;
      }

      throw new CLIError(
        `Failed to list todos: ${error instanceof Error ? error.message : String(error)}`,
        'LIST_FAILED'
      );
    }
  }

  /**
   * Handle JSON output format
   */
  private async handleJsonOutput(args: any, flags: any): Promise<void> {
    if (args.listName) {
      const list = await this.todoService.getList(args.listName);
      if (!list) {
        throw new CLIError(`List "${args.listName}" not found`, 'LIST_NOT_FOUND');
      }

      let todos = list.todos;
      if (flags.completed) todos = todos.filter((t: Todo) => t.completed);
      if (flags.pending) todos = todos.filter((t: Todo) => !t.completed);

      // Apply sorting if needed
      this.applySorting(todos, flags.sort);

      await this.jsonOutput({
        name: list.name,
        totalCount: list.todos.length,
        filteredCount: todos.length,
        completedCount: todos.filter((t: Todo) => t.completed).length,
        todos: todos
      });
    } else {
      const lists = await this.todoService.getAllLists();
      const listsWithDetails = await Promise.all(
        lists.map(async (listName) => {
          const list = await this.todoService.getList(listName);
          if (!list) return null;
          return {
            name: list.name,
            todoCount: list.todos.length,
            completedCount: list.todos.filter(t => t.completed).length
          };
        })
      );

      await this.jsonOutput({
        totalLists: lists.length,
        lists: listsWithDetails.filter(Boolean)
      });
    }
  }

  /**
   * Show a specific todo list
   */
  /**
   * Display a specific todo list with its items
   * This method handles the following:
   * 1. Retrieval of the specified list
   * 2. Creation of a formatted header with completion statistics
   * 3. Filtering todos based on completion status (--completed/--pending flags)
   * 4. Sorting todos based on priority or due date (--sort flag)
   * 5. Displaying todos in either compact or detailed view
   *
   * @param listName Name of the list to display
   * @param flags Command flags affecting display format and filtering
   */
  private async showSpecificList(listName: string, flags: any): Promise<void> {
    this.debugLog(`Getting list: ${listName}`);
    const list = await this.todoService.getList(listName);

    if (!list) {
      this.debugLog(`List "${listName}" not found`);
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    // Calculate counts and prepare header
    const completed = list.todos.filter(t => t.completed).length;
    const total = list.todos.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Create a header with list name and progress bar
    const progressBarWidth = 20;
    const filledCount = Math.round((percent / 100) * progressBarWidth);
    const progressBar = chalk.green('█'.repeat(filledCount)) + chalk.gray('░'.repeat(progressBarWidth - filledCount));

    // Construct a formatted box header with list name and completion statistics
    // The header includes:
    // 1. List name in bold
    // 2. Completion ratio (completed/total) with percentage
    // 3. A visual progress bar representing completion percentage
    const headerContent = [
      `${chalk.bold(listName)}`,
      `${chalk.blue(`${completed}/${total} completed`)} ${chalk.dim(`(${percent}%)`)}`
    ].join('\n');

    const headerBox = [
      `${ICONS.BOX_TL}${ICONS.BOX_H.repeat(40)}${ICONS.BOX_TR}`, // Top border
      `${ICONS.BOX_V} ${ICONS.LIST} ${headerContent}${' '.repeat(35 - listName.length)}${ICONS.BOX_V}`, // Content with padding
      `${ICONS.BOX_V} ${progressBar} ${ICONS.BOX_V}`, // Progress bar
      `${ICONS.BOX_BL}${ICONS.BOX_H.repeat(40)}${ICONS.BOX_BR}` // Bottom border
    ].join('\n');

    this.log('\n' + headerBox + '\n');

    // Filter todos based on flags
    let todos = list.todos;
    if (flags.completed) todos = todos.filter(t => t.completed);
    if (flags.pending) todos = todos.filter(t => !t.completed);

    // Apply sorting if sort flag is provided
    this.applySorting(todos, flags.sort);

    // Display todos
    if (todos.length === 0) {
      this.log(chalk.yellow(`${ICONS.INFO} No matching todos found`));

      // Show helpful hint
      if (flags.completed && completed === 0) {
        this.log(chalk.dim(`\nTip: Mark todos as completed with '${this.config.bin} complete --id <todo-id>'`));
      } else if (flags.pending && completed === total) {
        this.log(chalk.dim(`\nTip: Add new todos with '${this.config.bin} add "${listName}" -t "Your todo title"'`));
      } else if (total === 0) {
        this.log(chalk.dim(`\nTip: Add your first todo with '${this.config.bin} add "${listName}" -t "Your todo title"'`));
      }
    } else {
      // Determine display mode: detailed provides comprehensive information,
      // while compact mode (default) shows minimal info for better screen utilization
      const useDetailedView = flags.detailed === true;

      // Display column headers in detailed view for better visual organization
      if (useDetailedView) {
        this.log(chalk.dim(`${' '.repeat(4)}ID${' '.repeat(10)}STATUS${' '.repeat(6)}PRIORITY${' '.repeat(4)}TITLE`));
        this.log(chalk.dim(`${' '.repeat(4)}${ICONS.LINE.repeat(10)}${' '.repeat(2)}${ICONS.LINE.repeat(8)}${' '.repeat(2)}${ICONS.LINE.repeat(10)}${' '.repeat(2)}${ICONS.LINE.repeat(30)}`));
      }

      // Display each todo
      todos.forEach((todo: Todo, index: number) => {
        // Make ID shorter for display but unique enough
        const shortId = todo.id.slice(-6);

        // Format status
        const status = todo.completed
          ? chalk.green(ICONS.SUCCESS)
          : chalk.yellow(ICONS.PENDING);

        // Format priority
        const priority = PRIORITY[todo.priority as keyof typeof PRIORITY] || PRIORITY.medium;
        const priorityDisplay = priority.color(priority.label);

        // Format dueDate
        let dueDateDisplay = '';
        if (todo.dueDate) {
          const dueDate = new Date(todo.dueDate);
          const now = new Date();
          const isOverdue = dueDate < now && !todo.completed;
          dueDateDisplay = isOverdue
            ? chalk.red(`${ICONS.DATE} ${todo.dueDate} (OVERDUE)`)
            : chalk.blue(`${ICONS.DATE} ${todo.dueDate}`);
        }

        // Format tags
        const tagsDisplay = todo.tags?.length
          ? chalk.cyan(`${ICONS.TAG} ${todo.tags.join(', ')}`)
          : '';

        // Format private status
        const privateDisplay = todo.private
          ? chalk.yellow(`${ICONS.SECURE} Private`)
          : '';

        // Choose between compact and detailed view
        if (!useDetailedView) {
          this.log(`${status} [${chalk.dim(shortId)}] ${priorityDisplay} ${todo.title}`);
        } else {
          // Full display with details
          this.log(`${status} [${chalk.dim(shortId)}] ${priorityDisplay.padEnd(12)} ${todo.title}`);

          // Show details if they exist
          const details = [dueDateDisplay, tagsDisplay, privateDisplay].filter(Boolean);
          if (details.length) {
            this.log(chalk.dim(`    ${details.join(' | ')}`));
          }

          // Add a separator between todos for better readability
          if (index < todos.length - 1) {
            this.log(chalk.dim(`    ${ICONS.LINE.repeat(50)}`));
          }
        }
      });

      // Add helpful tips
      if (useDetailedView) {
        this.log('');
        this.log(chalk.dim(`Tip: Compact view is default. To disable use --no-compact`));
      }
    }
  }

  /**
   * Show all available todo lists with summary statistics
   * This method displays:
   * 1. A formatted list of all available todo lists
   * 2. Completion statistics for each list (total, completed, percentage)
   * 3. Priority distribution for each list (counts of high/medium/low priority todos)
   * 4. A mini progress bar for each list
   * 5. Helpful usage tips
   *
   * If no lists exist, displays a quick start guide for creating lists
   */
  private async showAllLists(): Promise<void> {
    this.debugLog("Getting all lists");
    const lists = await this.todoService.getAllLists();
    this.debugLog(`Found ${lists.length} lists`);

    if (lists.length === 0) {
      // No lists found, provide helpful guidance
      this.log(chalk.yellow(`${ICONS.WARNING} No todo lists found`));

      // Show a boxed quick start guide
      const quickStartGuide = [
        `Create your first todo list with:`,
        ``,
        `  ${chalk.cyan(`${this.config.bin} add my-list -t "My first task"`)}`,
        ``,
        `This will create a list named "my-list" with your first task.`,
        `You can then view it with:`,
        ``,
        `  ${chalk.cyan(`${this.config.bin} list my-list`)}`,
      ].join('\n');

      this.section('Quick Start', quickStartGuide);
      return;
    }

    // Format header for lists display
    this.log('');
    this.log(chalk.blue(`${ICONS.LISTS} ${chalk.bold('Available Todo Lists')}`));
    this.log(chalk.dim(`${ICONS.LINE.repeat(50)}`));

    // Process all lists to get more detailed information
    const listDetails = await Promise.all(
      lists.map(async (listName) => {
        const list = await this.todoService.getList(listName);
        if (!list) return null;

        const total = list.todos.length;
        const completed = list.todos.filter(t => t.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const pending = total - completed;

        // Create a mini progress bar
        const progressWidth = 10;
        const filled = Math.round((percent / 100) * progressWidth);
        const progressBar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(progressWidth - filled));

        // Get priority distribution
        const priorities = {
          high: list.todos.filter(t => t.priority === 'high').length,
          medium: list.todos.filter(t => t.priority === 'medium').length,
          low: list.todos.filter(t => t.priority === 'low').length
        };

        return {
          name: listName,
          total,
          completed,
          pending,
          percent,
          progressBar,
          priorities,
          updatedAt: list.updatedAt
        };
      })
    );

    // Filter out any null results
    const validLists = listDetails.filter(list => list !== null) as any[];

    // Sort lists by most recently updated
    validLists.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Display each list with its details
    validLists.forEach((list, index) => {
      // Format list name with a bullet
      this.log(`${chalk.white(ICONS.BULLET)} ${chalk.bold(list.name)}`);

      // Show progress statistics
      this.log(`  ${list.progressBar} ${chalk.blue(`${list.completed}/${list.total} completed`)} ${chalk.dim(`(${list.percent}%)`)}`);

      // Show priority breakdown if there are todos
      if (list.total > 0) {
        const priorityDisplay = [
          list.priorities.high > 0 && chalk.red(`${list.priorities.high} high`),
          list.priorities.medium > 0 && chalk.yellow(`${list.priorities.medium} medium`),
          list.priorities.low > 0 && chalk.green(`${list.priorities.low} low`)
        ].filter(Boolean).join(', ');

        if (priorityDisplay) {
          this.log(`  ${chalk.dim(`Priorities: ${priorityDisplay}`)}`);
        }
      }

      // Add spacer between lists
      if (index < validLists.length - 1) {
        this.log('');
      }
    });

    // Add helpful command tips
    this.log('');
    this.log(chalk.dim(`Tip: View a specific list with '${this.config.bin} list <list-name>'`));
    this.log(chalk.dim(`Tip: Add a new todo with '${this.config.bin} add <list-name> -t "Todo title"'`));
  }

  /**
   * Apply sorting to a list of todos based on specified criteria
   * 1. priority - Sorts by priority level (high → medium → low)
   * 2. dueDate - Sorts by due date (earliest first, todos without due dates at the end)
   *
   * @param todos Array of todos to sort (sorted in-place)
   * @param sortBy Sorting criteria ('priority' or 'dueDate')
   */
  private applySorting(todos: Todo[], sortBy?: string): void {
    if (!sortBy) return;

    switch (sortBy) {
      case 'priority':
        todos.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          const bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          return bVal - aVal;
        });
        break;

      case 'dueDate':
        todos.sort((a, b) => {
          if (!a.dueDate) return 1; // Items without dueDate go to the end
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;
    }
  }
}
