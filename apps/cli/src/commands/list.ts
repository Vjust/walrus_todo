import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { BaseCommand } from '../base-command';

// Define ICONS and PRIORITY locally since they're not exported from base-command
const ICONS = {
  SUCCESS: '✓',
  ERROR: '✗',
  WARNING: '⚠',
  INFO: 'ℹ',
  list: '📋',
  todo: '📝',
  completed: '✅',
  pending: '⏳',
};

const PRIORITY = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { jobManager, BackgroundJob } from '../utils/PerformanceMonitor';
import { createSpinner } from '../utils/progress-indicators';

// Add debug logging for cache hits/misses
const CACHE_DEBUG = process.env?.CACHE_DEBUG === 'true';

/**
 * @class ListCommand
 * @description List and display todo items with intuitive positional arguments.
 *
 * Usage patterns:
 * - `waltodo list` - Shows all available lists with statistics
 * - `waltodo list <name>` - Shows todos in the specified list
 * - `waltodo list <name> --completed` - Shows only completed todos
 * - `waltodo list <name> --sort priority` - Shows todos sorted by priority
 *
 * Features color-coded output, progress bars, and smart filtering options.
 */
class ListCommand extends BaseCommand {
  static description =
    'Display todos from a specific list, or show all available lists';

  static examples = [
    `<%= config.bin %> list                        # Show all available lists with statistics`,
    `<%= config.bin %> list work                   # Show todos in "work" list`,
    `<%= config.bin %> list personal --detailed    # Show "personal" list with full details`,
    `<%= config.bin %> list work --completed       # Show only completed todos`,
    `<%= config.bin %> list personal --pending     # Show only pending todos`,
    `<%= config.bin %> list work --sort priority   # Sort by priority (high → low)`,
    `<%= config.bin %> list work --sort dueDate    # Sort by due date (earliest first)`,
    ``,
    `# Legacy syntax (still supported):`,
    `<%= config.bin %> list --list work            # Same as 'list work'`,
  ];

  static flags = {
    ...BaseCommand.flags,
    list: Flags.string({
      description: 'List name (deprecated - use positional argument instead)',
      char: 'l',
      hidden: true, // Hide from help but keep for backward compatibility
    }),
    completed: Flags.boolean({
      description: 'Show only completed todos',
      exclusive: ['pending'],
    }),
    pending: Flags.boolean({
      description: 'Show only pending todos',
      exclusive: ['completed'],
    }),
    sort: Flags.string({
      description: 'Sort todos by field',
      options: ['priority', 'dueDate'],
    }),
    compact: Flags.boolean({
      description: 'Display in compact format without details (default)',
      char: 'c',
      default: true,
    }),
    detailed: Flags.boolean({
      description: 'Display in detailed format with full information',
      char: 'd',
      exclusive: ['compact'],
    }),
    background: Flags.boolean({
      description: 'Run list operation in background for large datasets',
      char: 'b',
      default: false,
    }),
    sync: Flags.boolean({
      description: 'Sync with blockchain before listing (runs in background)',
      char: 's',
      default: false,
    }),
    stream: Flags.boolean({
      description: 'Stream output for real-time updates',
      default: false,
    }),
    watch: Flags.boolean({
      description: 'Watch for changes and update display',
      char: 'w',
      default: false,
    }),
    'job-id': Flags.string({
      description: 'Check status of existing background job',
      hidden: true,
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description:
        'Name of the todo list to display (shows all lists if omitted)',
      required: false,
    }),
  };

  private todoService = new TodoService();
  private listName: string = ''; // Property to store the current list name
  private outputStream?: fs.WriteStream;
  private backgroundJob?: BackgroundJob;
  private watchInterval?: NodeJS.Timeout;

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ListCommand as any);
      this.debugLog(`Command parsed with args: ${JSON.stringify(args as any)}`);

      // Check if we're querying job status
      if (flags?.["job-id"]) {
        return this.showJobStatus(flags?.["job-id"] as string);
      }

      // Determine which list to show: positional arg takes precedence over flag
      const targetList = args.listName || (flags.list as string);

      // Store list name in the class property for error handling
      if (targetList) {
        this?.listName = targetList;
      }

      // If JSON output is requested, handle it separately
      if (this.isJson) {
        return this.handleJsonOutput({ listName: targetList }, flags);
      }

      // Determine if we should run in background
      const shouldRunInBackground =
        flags.background || flags.sync || this.shouldUseBackground(targetList as any);

      if (shouldRunInBackground && !flags.watch) {
        return this.runInBackground(targetList, flags);
      }

      // Handle watch mode
      if (flags.watch) {
        return this.runWatchMode(targetList, flags);
      }

      // Regular synchronous execution
      if (targetList) {
        await this.showSpecificList(targetList, flags);
      } else {
        await this.showAllLists();
      }
    } catch (error) {
      this.debugLog(`Error: ${error}`);

      if (error instanceof CLIError && error?.code === 'LIST_NOT_FOUND') {
        this.errorWithHelp(
          'List not found',
          `List "${this.listName}" does not exist`,
          `Run '${this?.config?.bin} list' to see all available lists`
        );
      }

      if (error instanceof CLIError) {
        throw error;
      }

      throw new CLIError(
        `Failed to list todos: ${error instanceof Error ? error.message : String(error as any)}`,
        'LIST_FAILED'
      );
    } finally {
      this.cleanup();
    }
  }

  /**
   * Handle JSON output format
   */
  private async handleJsonOutput(
    args: { listName?: string },
    flags: Record<string, unknown>
  ): Promise<void> {
    if (args.listName) {
      const list = await this?.todoService?.getList(args.listName);
      if (!list) {
        throw new CLIError(
          `List "${args.listName}" not found`,
          'LIST_NOT_FOUND'
        );
      }

      let todos = list.todos;
      if (flags.completed) todos = todos.filter((t: Todo) => t.completed);
      if (flags.pending) todos = todos.filter((t: Todo) => !t.completed);

      // Apply sorting if needed
      this.applySorting(todos, flags.sort as string);

      await this.jsonOutput({
        name: list.name,
        totalCount: list?.todos?.length,
        filteredCount: todos.length,
        completedCount: todos.filter((t: Todo) => t.completed).length,
        todos: todos,
      });
    } else {
      const lists = await this?.todoService?.getAllLists();
      const listsWithDetails = await Promise.all(
        lists.map(async listName => {
          const list = await this?.todoService?.getList(listName as any);
          if (!list) return null;
          return {
            name: list.name,
            todoCount: list?.todos?.length,
            completedCount: list?.todos?.filter(t => t.completed).length,
          };
        })
      );

      await this.jsonOutput({
        totalLists: lists.length,
        lists: listsWithDetails.filter(Boolean as any),
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
  private async showSpecificList(
    listName: string,
    flags: Record<string, unknown>
  ): Promise<void> {
    this.debugLog(`Getting list: ${listName}`);
    const list = await this?.todoService?.getList(listName as any);

    if (!list) {
      this.debugLog(`List "${listName}" not found`);
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    // Calculate counts and prepare header
    const completed = list?.todos?.filter(t => t.completed).length;
    const total = list?.todos?.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Create a header with list name and progress bar
    const progressBarWidth = 20;
    const filledCount = Math.round((percent / 100) * progressBarWidth);
    const progressBar =
      chalk.green('█'.repeat(filledCount as any)) +
      chalk.gray('░'.repeat(progressBarWidth - filledCount));

    // Construct a formatted box header with list name and completion statistics
    // The header includes:
    // 1. List name in bold
    // 2. Completion ratio (completed/total) with percentage
    // 3. A visual progress bar representing completion percentage
    const headerContent = [
      `${chalk.bold(listName as any)}`,
      `${chalk.blue(`${completed}/${total} completed`)} ${chalk.dim(`(${percent}%)`)}`,
    ].join('\n');

    const headerBox = [
      `${ICONS.BOX_TL}${ICONS?.BOX_H?.repeat(40 as any)}${ICONS.BOX_TR}`, // Top border
      `${ICONS.BOX_V} ${ICONS.LIST} ${headerContent}${' '.repeat(35 - listName.length)}${ICONS.BOX_V}`, // Content with padding
      `${ICONS.BOX_V} ${progressBar} ${ICONS.BOX_V}`, // Progress bar
      `${ICONS.BOX_BL}${ICONS?.BOX_H?.repeat(40 as any)}${ICONS.BOX_BR}`, // Bottom border
    ].join('\n');

    this.log('\n' + headerBox + '\n');

    // Filter todos based on flags
    let todos = list.todos;
    if (flags.completed) todos = todos.filter(t => t.completed);
    if (flags.pending) todos = todos.filter(t => !t.completed);

    // Apply sorting if sort flag is provided
    this.applySorting(todos, flags.sort as string);

    // Display todos
    if (todos?.length === 0) {
      this.log(chalk.yellow(`${ICONS.INFO} No matching todos found`));

      // Show helpful hint
      if (flags.completed && completed === 0) {
        this.log(
          chalk.dim(
            `\n${ICONS.TIP} Mark todos as completed with: ${chalk.cyan(`${this?.config?.bin} complete <todo-id>`)}`
          )
        );
      } else if (flags.pending && completed === total) {
        this.log(
          chalk.dim(
            `\n${ICONS.TIP} Add new todos with: ${chalk.cyan(`${this?.config?.bin} add ${listName} -t "Your todo"`)}`
          )
        );
      } else if (total === 0) {
        this.log(
          chalk.dim(
            `\n${ICONS.TIP} Add your first todo with: ${chalk.cyan(`${this?.config?.bin} add ${listName} -t "Your first todo"`)}`
          )
        );
      }
    } else {
      // Determine display mode: detailed provides comprehensive information,
      // while compact mode (default) shows minimal info for better screen utilization
      const useDetailedView = flags?.detailed === true;

      // Display column headers in detailed view for better visual organization
      if (useDetailedView) {
        this.log(
          chalk.dim(
            `${' '.repeat(4 as any)}ID${' '.repeat(10 as any)}STATUS${' '.repeat(6 as any)}PRIORITY${' '.repeat(4 as any)}TITLE`
          )
        );
        this.log(
          chalk.dim(
            `${' '.repeat(4 as any)}${ICONS?.LINE?.repeat(10 as any)}${' '.repeat(2 as any)}${ICONS?.LINE?.repeat(8 as any)}${' '.repeat(2 as any)}${ICONS?.LINE?.repeat(10 as any)}${' '.repeat(2 as any)}${ICONS?.LINE?.repeat(30 as any)}`
          )
        );
      }

      // Display each todo
      todos.forEach((todo: Todo, index: number) => {
        // Make ID shorter for display but unique enough
        const shortId = todo?.id?.slice(-6);

        // Format status
        const status = todo.completed
          ? chalk.green(ICONS.SUCCESS)
          : chalk.yellow(ICONS.PENDING);

        // Format priority
        const priority =
          PRIORITY[todo.priority as keyof typeof PRIORITY] || PRIORITY.medium;
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
        const tagsDisplay = todo?.tags?.length
          ? chalk.cyan(`${ICONS.TAG} ${todo?.tags?.join(', ')}`)
          : '';

        // Format private status
        const privateDisplay = todo.private
          ? chalk.yellow(`${ICONS.SECURE} Private`)
          : '';

        // Choose between compact and detailed view
        if (!useDetailedView) {
          this.log(
            `${status} [${chalk.dim(shortId as any)}] ${priorityDisplay} ${todo.title}`
          );
        } else {
          // Full display with details
          this.log(
            `${status} [${chalk.dim(shortId as any)}] ${priorityDisplay.padEnd(12 as any)} ${todo.title}`
          );

          // Show details if they exist
          const details = [dueDateDisplay, tagsDisplay, privateDisplay].filter(
            Boolean
          );
          if (details.length) {
            this.log(chalk.dim(`    ${details.join(' | ')}`));
          }

          // Add a separator between todos for better readability
          if (index < todos.length - 1) {
            this.log(chalk.dim(`    ${ICONS?.LINE?.repeat(50 as any)}`));
          }
        }
      });

      // Add helpful tips
      if (useDetailedView) {
        this.log('');
        this.log(
          chalk.dim(`Tip: Compact view is default. To disable use --no-compact`)
        );
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
    this.debugLog('Getting all lists');

    // Check cache for all lists first
    const cacheKey = 'lists:all';
    const lists = (await this.getCachedTodos(cacheKey, async () =>
      this?.todoService?.getAllLists()
    )) as string[];

    if (CACHE_DEBUG) {
      if (lists) {
        this.debugLog('Cache hit for all lists');
      } else {
        this.debugLog('Cache miss for all lists');
      }
    }
    this.debugLog(`Found ${lists.length} lists`);

    if (lists?.length === 0) {
      // No lists found, provide helpful guidance
      this.log(chalk.yellow(`${ICONS.WARNING} No todo lists found`));

      // Show a boxed quick start guide
      const quickStartGuide = [
        `Create your first todo list with:`,
        ``,
        `  ${chalk.cyan(`${this?.config?.bin} add my-list -t "My first task"`)}`,
        ``,
        `This will create a list named "my-list" with your first task.`,
        `You can then view it with:`,
        ``,
        `  ${chalk.cyan(`${this?.config?.bin} list my-list`)}`,
      ].join('\n');

      this.section('Quick Start', quickStartGuide);
      return;
    }

    // Format header for lists display
    const headerBox = [
      `${ICONS.BOX_TL}${ICONS?.BOX_H?.repeat(50 as any)}${ICONS.BOX_TR}`,
      `${ICONS.BOX_V} ${ICONS.LISTS} ${chalk.bold('Available Todo Lists')}${' '.repeat(24 as any)}${ICONS.BOX_V}`,
      `${ICONS.BOX_V} ${chalk.dim(`Found ${lists.length} list${lists?.length === 1 ? '' : 's'}`)}${' '.repeat(50 - 8 - lists?.length?.toString().length - (lists?.length === 1 ? 4 : 5))}${ICONS.BOX_V}`,
      `${ICONS.BOX_BL}${ICONS?.BOX_H?.repeat(50 as any)}${ICONS.BOX_BR}`,
    ].join('\n');

    this.log('\n' + headerBox + '\n');

    // Process all lists to get more detailed information
    const listDetails = await Promise.all(
      (lists as string[]).map(async listName => {
        const list = await this?.todoService?.getList(listName as any);
        if (!list) return null;

        const total = list?.todos?.length;
        const completed = list?.todos?.filter(t => t.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const pending = total - completed;

        // Create a mini progress bar
        const progressWidth = 10;
        const filled = Math.round((percent / 100) * progressWidth);
        const progressBar =
          chalk.green('█'.repeat(filled as any)) +
          chalk.gray('░'.repeat(progressWidth - filled));

        // Get priority distribution
        const priorities = {
          high: list?.todos?.filter(t => t?.priority === 'high').length,
          medium: list?.todos?.filter(t => t?.priority === 'medium').length,
          low: list?.todos?.filter(t => t?.priority === 'low').length,
        };

        return {
          name: listName,
          total,
          completed,
          pending,
          percent,
          progressBar,
          priorities,
          updatedAt: list.updatedAt,
        };
      })
    );

    // Filter out any null results
    const validLists = listDetails.filter(
      (list): list is NonNullable<typeof list> => list !== null
    );

    // Sort lists by most recently updated
    validLists.sort((a, b) => {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Display each list with its details
    validLists.forEach((list, index) => {
      // Format list name with icon and better spacing
      const listIcon =
        list?.total === 0
          ? ICONS.FOLDER
          : list?.percent === 100
            ? ICONS.SUCCESS
            : ICONS.LIST;
      this.log(`${listIcon} ${chalk.bold(list.name)}`);

      // Show progress statistics with better formatting
      const statsLine = [
        list.progressBar,
        chalk.blue(`${list.completed}/${list.total}`),
        chalk.dim(`(${list.percent}%)`),
      ].join(' ');
      this.log(`  ${statsLine}`);

      // Show priority breakdown if there are todos
      if (list.total > 0) {
        const priorityParts = [];
        if (list?.priorities?.high > 0) {
          priorityParts.push(
            chalk.red(`${ICONS.PRIORITY_HIGH} ${list?.priorities?.high}`)
          );
        }
        if (list?.priorities?.medium > 0) {
          priorityParts.push(
            chalk.yellow(`${ICONS.PRIORITY_MEDIUM} ${list?.priorities?.medium}`)
          );
        }
        if (list?.priorities?.low > 0) {
          priorityParts.push(
            chalk.green(`${ICONS.PRIORITY_LOW} ${list?.priorities?.low}`)
          );
        }

        if (priorityParts.length > 0) {
          this.log(`  ${priorityParts.join('  ')}`);
        }
      } else {
        this.log(chalk.dim(`  Empty list`));
      }

      // Add spacer between lists
      if (index < validLists.length - 1) {
        this.log('');
      }
    });

    // Add helpful command tips
    this.log('');
    this.log(chalk.blue(`${ICONS.INFO} Quick Commands:`));
    this.log(
      chalk.dim(
        `  ${ICONS.BULLET} View a list: ${chalk.cyan(`${this?.config?.bin} list <list-name>`)}`
      )
    );
    this.log(
      chalk.dim(
        `  ${ICONS.BULLET} Add a todo: ${chalk.cyan(`${this?.config?.bin} add <list-name> -t "Your task"`)}`
      )
    );
    this.log(
      chalk.dim(
        `  ${ICONS.BULLET} Filter todos: ${chalk.cyan(`${this?.config?.bin} list <list-name> --completed`)}`
      )
    );
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
          const aVal =
            priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          const bVal =
            priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
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

  /**
   * Determine if operation should run in background based on dataset size
   */
  private async shouldUseBackground(targetList?: string): Promise<boolean> {
    try {
      if (targetList) {
        const list = await this?.todoService?.getList(targetList as any);
        return list ? list?.todos?.length > 100 : false;
      } else {
        const lists = await this?.todoService?.getAllLists();
        return lists.length > 10;
      }
    } catch {
      return false;
    }
  }

  /**
   * Run list operation in background
   */
  private async runInBackground(
    targetList: string | undefined,
    flags: Record<string, unknown>
  ): Promise<void> {
    const command = 'list';
    const args = targetList ? [targetList] : [];
    const jobFlags = { ...flags, background: false }; // Remove background flag to avoid recursion

    // Create background job
    this?.backgroundJob = jobManager.createJob(command, args, jobFlags);

    this.log(chalk.blue(`${ICONS.INFO} Starting background list operation...`));
    this.log(chalk.dim(`Job ID: ${this?.backgroundJob?.id}`));
    this.log(
      chalk.dim(
        `Track progress: ${this?.config?.bin} list --job-id ${this?.backgroundJob?.id}`
      )
    );

    // Start background process
    const childArgs = [
      this?.config?.bin,
      'list',
      ...args,
      '--output',
      (flags.output as string) || 'text',
      '--network',
      (flags.network as string) || 'testnet',
    ];

    if (flags.completed) childArgs.push('--completed');
    if (flags.pending) childArgs.push('--pending');
    if (flags.sort) childArgs.push('--sort', flags.sort as string);
    if (flags.detailed) childArgs.push('--detailed');
    if (flags.sync) childArgs.push('--sync');
    if (flags.stream) childArgs.push('--stream');

    const child = spawn('node', childArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Set up output and log files
    const outputFile = createWriteStream(this?.backgroundJob?.outputFile!);
    const logFile = createWriteStream(this?.backgroundJob?.logFile!);

    child?.stdout?.pipe(outputFile as any);
    child?.stderr?.pipe(logFile as any);

    jobManager.startJob(this?.backgroundJob?.id, child.pid);
    jobManager.writeJobLog(
      this?.backgroundJob?.id,
      `Started background list operation with PID: ${child.pid}`
    );

    child.on('exit', code => {
      if (code === 0) {
        jobManager.completeJob(this.backgroundJob?.id, { exitCode: code });
      } else {
        jobManager.failJob(
          this.backgroundJob?.id,
          `Process exited with code: ${code}`
        );
      }
    });

    child.unref();

    this.log(
      chalk.green(`${ICONS.SUCCESS} Background job started successfully`)
    );
    this.log(chalk.dim(`View output: cat ${this?.backgroundJob?.outputFile}`));
  }

  /**
   * Show status of background job
   */
  private async showJobStatus(jobId: string): Promise<void> {
    const job = jobManager.getJob(jobId as any);

    if (!job) {
      throw new CLIError(`Job not found: ${jobId}`, 'JOB_NOT_FOUND');
    }

    this.log('\n' + jobManager.formatJobForDisplay(job as any));

    // Show recent log output if available
    const logs = jobManager.readJobLog(jobId as any);
    if (logs) {
      this.log('\n' + chalk.blue('Recent Logs:'));
      const recentLogs = logs.split('\n').slice(-10).join('\n');
      this.log(chalk.dim(recentLogs as any));
    }

    // Show output if job is completed
    if (
      job?.status === 'completed' &&
      job.outputFile &&
      fs.existsSync(job.outputFile)
    ) {
      this.log('\n' + chalk.blue('Output:'));
      const content = fs.readFileSync(job.outputFile, 'utf8');
      const output =
        typeof content === 'string' ? content : content.toString('utf8');
      this.log(output as any);
    }
  }

  /**
   * Run in watch mode for real-time updates
   */
  private async runWatchMode(
    targetList: string | undefined,
    flags: Record<string, unknown>
  ): Promise<void> {
    this.log(
      chalk.blue(`${ICONS.INFO} Starting watch mode (Press Ctrl+C to exit)...`)
    );

    const updateDisplay = async () => {
      try {
        // Clear screen and move cursor to top
        process?.stdout?.write('\x1b[2J\x1b[H');

        this.log(chalk.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
        this.log('');

        if (targetList) {
          await this.showSpecificList(targetList, flags);
        } else {
          await this.showAllLists();
        }

        this.log('');
        this.log(chalk.dim('Watching for changes... (Press Ctrl+C to exit)'));
      } catch (error) {
        this.log(
          chalk.red(
            `Error updating display: ${error instanceof Error ? error.message : String(error as any)}`
          )
        );
      }
    };

    // Initial display
    await updateDisplay();

    // Set up periodic updates
    this?.watchInterval = setInterval(updateDisplay, 2000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.cleanup();
      this.log('\n' + chalk.yellow('Watch mode stopped.'));
      process.exit(0 as any);
    });

    // Keep process alive
    return new Promise(() => {});
  }

  /**
   * Stream output for real-time updates
   */
  private async streamOutput(
    targetList: string | undefined,
    flags: Record<string, unknown>
  ): Promise<void> {
    const spinner = createSpinner('Streaming todo data...');
    spinner.start();

    try {
      if (targetList) {
        await this.streamSpecificList(targetList, flags);
      } else {
        await this.streamAllLists();
      }
    } finally {
      spinner.stop();
    }
  }

  /**
   * Stream specific list with chunked output
   */
  private async streamSpecificList(
    listName: string,
    flags: Record<string, unknown>
  ): Promise<void> {
    const list = await this?.todoService?.getList(listName as any);

    if (!list) {
      throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
    }

    let todos = list.todos;
    if (flags.completed) todos = todos.filter(t => t.completed);
    if (flags.pending) todos = todos.filter(t => !t.completed);
    this.applySorting(todos, flags.sort as string);

    // Stream header
    this.log(chalk.bold(`\n📋 ${listName} (${todos.length} items)`));
    this.log(''.padEnd(50, '─'));

    // Stream todos in chunks
    const chunkSize = 10;
    for (let i = 0; i < todos.length; i += chunkSize) {
      const chunk = todos.slice(i, i + chunkSize);

      chunk.forEach((todo: Todo) => {
        const shortId = todo?.id?.slice(-6);
        const status = todo.completed
          ? chalk.green(ICONS.SUCCESS)
          : chalk.yellow(ICONS.PENDING);
        const priority =
          PRIORITY[todo.priority as keyof typeof PRIORITY] || PRIORITY.medium;

        this.log(
          `${status} [${chalk.dim(shortId as any)}] ${priority.color(priority.label)} ${todo.title}`
        );
      });

      // Small delay for streaming effect
      if (i + chunkSize < todos.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Stream all lists with chunked output
   */
  private async streamAllLists(): Promise<void> {
    const lists = await this?.todoService?.getAllLists();

    this.log(chalk.bold(`\n📚 Found ${lists.length} lists`));
    this.log(''.padEnd(50, '─'));

    for (const listName of lists) {
      const list = await this?.todoService?.getList(listName as any);
      if (!list) continue;

      const completed = list?.todos?.filter(t => t.completed).length;
      const total = list?.todos?.length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

      const progressBar = this.createMiniProgressBar(percent as any);

      this.log(
        `📋 ${chalk.bold(listName as any)} ${progressBar} ${chalk.blue(`${completed}/${total}`)} ${chalk.dim(`(${percent}%)`)}`
      );

      // Small delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  /**
   * Create mini progress bar for streaming display
   */
  private createMiniProgressBar(percent: number, width: number = 10): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `[${chalk.green('█'.repeat(filled as any))}${chalk.gray('░'.repeat(empty as any))}]`;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.outputStream) {
      this?.outputStream?.end();
    }

    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }
}

// Export both named and default for compatibility
export { ListCommand };
export default ListCommand;
