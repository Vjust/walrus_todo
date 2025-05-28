import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import chalk = require('chalk');
import { TodoService } from '../services/todoService';
import { validateDate, validatePriority } from '../utils';
import { Todo } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { jobManager } from '../utils/PerformanceMonitor';
import { createBackgroundOperationsManager } from '../utils/background-operations';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * @class UpdateCommand
 * @description This command allows users to update various properties of an existing todo item within a specified list.
 * It supports both positional syntax for quick updates and flag-based syntax for detailed control.
 * The command ensures that the list and todo exist before applying changes and provides feedback on the updates made.
 *
 * Positional syntax:
 * @param {string} [listName] - The name of the todo list containing the item to update
 * @param {string} [todoId] - The ID or title of the todo item to update
 * @param {string} [newTitle] - The new title for the todo item
 *
 * Flag-based syntax (backward compatible):
 * @param {string} id - The ID or title of the todo item to update. (Flag: -i, --id)
 * @param {string} [task] - The new title or description for the todo item. (Flag: -t, --task)
 * @param {string} [priority] - The new priority level for the todo ('high', 'medium', 'low'). (Flag: -p, --priority)
 * @param {string} [due] - The new due date for the todo in YYYY-MM-DD format. (Flag: -d, --due)
 * @param {string} [tags] - New comma-separated tags to assign to the todo. (Flag: -g, --tags)
 * @param {boolean} [private] - If provided, sets the privacy status of the todo. (Flag: --private)
 */
export default class UpdateCommand extends BaseCommand {
  static description = 'Update properties of an existing todo item';

  static examples = [
    '# Positional syntax (quick updates):',
    '<%= config.bin %> update mylist 12345 "New title"                        # Update by ID',
    '<%= config.bin %> update mylist "Old title" "New title"                  # Update by title',
    '<%= config.bin %> update 12345 "New title"                               # Search all lists',
    '<%= config.bin %> update "Buy milk" "Buy organic milk"                  # Search all lists by title',
    '',
    '# Combined positional + flags:',
    '<%= config.bin %> update mylist 12345 "New title" -p high -d 2024-05-01  # Update multiple properties',
    '<%= config.bin %> update 12345 "New title" --tags "urgent,important"    # Update with tags',
    '',
    '# Background operations:',
    '<%= config.bin %> update mylist 12345 "New title" --background          # Run in background',
    '<%= config.bin %> update mylist 12345 "New title" -b --sync-storage     # Background with storage sync',
    '<%= config.bin %> update mylist 12345 "New title" -b --ai-enhance       # Background with AI enhancement',
    '<%= config.bin %> update mylist 12345 "New title" -b --batch-size 10    # Background batch processing',
    '',
    '# Flag syntax (backward compatible):',
    '<%= config.bin %> update my-list -i task-123 -t "Updated task"           # Update title',
    '<%= config.bin %> update my-list -i "Buy groceries" -p high              # Update priority',
    '<%= config.bin %> update my-list -i task-123 -d 2024-05-01               # Update due date',
    '<%= config.bin %> update work -i "Old task" -t "Revised task" -g "urgent,important"  # Update with tags',
    '<%= config.bin %> update personal -i todo-789 --private                  # Mark as private',
    '<%= config.bin %> update mylist -i 12345 --clear-due --clear-tags        # Clear properties',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Todo ID or title to update (optional if using positional syntax)',
      required: false,
    }),
    task: Flags.string({
      char: 't',
      description: 'New task description',
    }),
    priority: Flags.string({
      char: 'p',
      description: 'New priority (high, medium, low)',
      options: ['high', 'medium', 'low'],
    }),
    due: Flags.string({
      char: 'd',
      description: 'New due date (YYYY-MM-DD)',
    }),
    tags: Flags.string({
      char: 'g',
      description: 'New comma-separated tags',
    }),
    private: Flags.boolean({
      description: 'Mark todo as private',
    }),
    'clear-due': Flags.boolean({
      description: 'Clear the due date',
    }),
    'clear-tags': Flags.boolean({
      description: 'Clear all tags',
    }),
    background: Flags.boolean({
      char: 'b',
      description: 'Run update operation in background (non-blocking)',
      default: false,
    }),
    'batch-size': Flags.integer({
      description: 'Number of items to process in each batch (for batch updates)',
      default: 5,
      min: 1,
      max: 50,
    }),
    'sync-storage': Flags.boolean({
      description: 'Sync changes to blockchain storage after update',
      default: false,
    }),
    'ai-enhance': Flags.boolean({
      description: 'Use AI to enhance todo updates in background',
      default: false,
    }),
  };

  static args = {
    listName: Args.string({
      name: 'listName',
      description: 'Name of the todo list (or todo ID/title if searching all lists)',
      required: false,
    }),
    todoId: Args.string({
      name: 'todoId',
      description: 'Todo ID or title to update',
      required: false,
    }),
    newTitle: Args.string({
      name: 'newTitle',
      description: 'New title for the todo',
      required: false,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(UpdateCommand);

    // Check if background operation is requested
    if (flags.background) {
      await this.runInBackground(args, flags);
      return;
    }

    // Run normally in foreground
    await this.runUpdate(args, flags);
  }

  /**
   * Execute update operation in background
   */
  private async runInBackground(args: any, flags: any): Promise<void> {
    // Create background job
    const job = jobManager.createJob('update', this.buildArgsArray(args), flags);
    
    this.log(chalk.blue('🔄 Starting background update operation...'));
    this.log(chalk.dim(`Job ID: ${job.id}`));
    
    // Start the background process
    const backgroundProcess = this.startBackgroundProcess(job, args, flags);
    
    // Handle non-blocking output
    this.log(chalk.green('✅ Update job started in background'));
    this.log(chalk.gray(`📋 Use "waltodo jobs" to monitor progress`));
    this.log(chalk.gray(`📋 Use "waltodo status ${job.id}" for detailed status`));
    
    if (flags.verbose) {
      this.log(chalk.dim(`Process PID: ${backgroundProcess.pid}`));
      this.log(chalk.dim(`Log file: ${job.logFile}`));
    }

    // For batch operations, show estimated time
    if (flags['batch-size'] && flags['batch-size'] > 1) {
      this.log(chalk.yellow(`⚡ Batch size: ${flags['batch-size']} items per batch`));
    }

    // Exit immediately, leaving background process running
    process.exit(0);
  }

  /**
   * Execute update operation in foreground (normal mode)
   */
  private async runUpdate(args: any, flags: any): Promise<void> {
    const todoService = new TodoService();

    try {
      let listName: string;
      let todoIdentifier: string;
      let newTitle: string | undefined;
      let searchAllLists = false;

      // Parse positional arguments vs flag-based arguments
      if (args.listName && !args.todoId && !args.newTitle && !flags.id) {
        // Single argument: search all lists for this todo
        searchAllLists = true;
        todoIdentifier = args.listName;
        listName = ''; // Will be determined by search
      } else if (args.listName && args.todoId && !args.newTitle) {
        // Two arguments: could be "listName todoId" or "todoId newTitle" (search all lists)
        // Try to find the list first
        const list = await todoService.getList(args.listName);
        if (list) {
          // First arg is a valid list name
          listName = args.listName;
          todoIdentifier = args.todoId;
        } else {
          // First arg is not a list, assume it's a todo identifier
          searchAllLists = true;
          todoIdentifier = args.listName;
          newTitle = args.todoId;
        }
      } else if (args.listName && args.todoId && args.newTitle) {
        // Three arguments: "listName todoId newTitle"
        listName = args.listName;
        todoIdentifier = args.todoId;
        newTitle = args.newTitle;
      } else if (flags.id) {
        // Flag-based syntax (backward compatible)
        if (!args.listName) {
          throw new CLIError('List name is required when using flag syntax', 'MISSING_LIST');
        }
        listName = args.listName;
        todoIdentifier = flags.id;
        newTitle = flags.task;
      } else {
        throw new CLIError(
          'Please specify a todo to update. Use "waltodo update --help" for examples.',
          'MISSING_TODO_ID'
        );
      }

      // Find the todo
      let todo: Todo | null = null;
      let finalListName = listName;

      if (searchAllLists) {
        // Search across all lists
        const lists = await todoService.getAllListsWithContent();
        for (const [name, list] of Object.entries(lists)) {
          const found = await todoService.getTodoByTitleOrId(todoIdentifier, name);
          if (found) {
            todo = found;
            finalListName = name;
            break;
          }
        }
        if (!todo) {
          throw new CLIError(
            `Todo "${todoIdentifier}" not found in any list`,
            'INVALID_TASK_ID'
          );
        }
      } else {
        // Search in specific list
        const list = await todoService.getList(listName);
        if (!list) {
          throw new CLIError(`List "${listName}" not found`, 'INVALID_LIST');
        }
        todo = await todoService.getTodoByTitleOrId(todoIdentifier, listName);
        if (!todo) {
          throw new CLIError(
            `Todo "${todoIdentifier}" not found in list "${listName}"`,
            'INVALID_TASK_ID'
          );
        }
      }

      // Process the update
      const updatedTodo = await this.processUpdate(todo, flags, newTitle);
      
      // Save the list
      const list = await todoService.getList(finalListName);
      if (!list) {
        throw new CLIError(`List "${finalListName}" not found`, 'INVALID_LIST');
      }

      await todoService.saveList(finalListName, list);

      // Handle post-update operations
      await this.handlePostUpdateOperations(updatedTodo, finalListName, flags);

      // Display results
      this.displayUpdateResults(updatedTodo, finalListName, flags);

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

  /**
   * Process the actual todo update with change tracking
   */
  private async processUpdate(todo: Todo, flags: any, newTitle?: string): Promise<{ todo: Todo; changes: number }> {
    let changes = 0;

    // Update title if provided (from positional args or flags)
    if (newTitle || flags.task) {
      todo.title = newTitle || flags.task || todo.title;
      changes++;
    }

    // Update priority if provided
    if (flags.priority) {
      if (!validatePriority(flags.priority)) {
        throw new CLIError(
          'Invalid priority. Must be high, medium, or low',
          'INVALID_PRIORITY'
        );
      }
      todo.priority = flags.priority as Todo['priority'];
      changes++;
    }

    // Update due date if provided
    if (flags.due) {
      if (!validateDate(flags.due)) {
        throw new CLIError(
          'Invalid date format. Use YYYY-MM-DD',
          'INVALID_DATE'
        );
      }
      todo.dueDate = flags.due;
      changes++;
    }

    // Clear due date if requested
    if (flags['clear-due']) {
      todo.dueDate = undefined;
      changes++;
    }

    // Update tags if provided
    if (flags.tags) {
      todo.tags = flags.tags.split(',').map((tag: string) => tag.trim());
      changes++;
    }

    // Clear tags if requested
    if (flags['clear-tags']) {
      todo.tags = [];
      changes++;
    }

    // Update private flag if provided
    if (flags.private !== undefined) {
      todo.private = flags.private;
      changes++;
    }

    if (changes === 0) {
      throw new CLIError('No changes specified. Use -h to see available options.', 'NO_CHANGES');
    }

    todo.updatedAt = new Date().toISOString();

    return { todo, changes };
  }

  /**
   * Handle post-update operations (storage sync, AI enhancement)
   */
  private async handlePostUpdateOperations(
    updateResult: { todo: Todo; changes: number }, 
    listName: string, 
    flags: any
  ): Promise<void> {
    const { todo } = updateResult;

    // Handle storage synchronization in background if requested
    if (flags['sync-storage']) {
      try {
        const backgroundOps = await createBackgroundOperationsManager();
        const syncJobId = await backgroundOps.uploadTodosInBackground([todo], {
          priority: 'normal',
          onComplete: (operationId: string, result: any) => {
            this.verbose(`Storage sync completed: ${operationId}`);
          },
          onError: (operationId: string, error: Error) => {
            this.warning(`Storage sync failed: ${error.message}`);
          }
        });
        
        this.log(chalk.blue(`🔄 Storage sync queued: ${syncJobId}`));
      } catch (error) {
        this.warning(`Failed to queue storage sync: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Handle AI enhancement if requested
    if (flags['ai-enhance']) {
      try {
        const backgroundOps = await createBackgroundOperationsManager();
        const aiJobId = await backgroundOps.processBatchInBackground([{
          type: 'ai-enhance',
          todo,
          listName,
          operation: 'update'
        }], 'low');
        
        this.log(chalk.magenta(`🤖 AI enhancement queued: ${aiJobId}`));
      } catch (error) {
        this.warning(`Failed to queue AI enhancement: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Display update results
   */
  private displayUpdateResults(
    updateResult: { todo: Todo; changes: number }, 
    listName: string, 
    flags: any
  ): void {
    const { todo, changes } = updateResult;

    this.log(chalk.green('✓') + ' Updated todo: ' + chalk.bold(todo.title));
    this.log(chalk.dim('List: ') + listName);
    this.log(chalk.dim('ID: ') + todo.id);
    this.log(chalk.dim(`Changes made: ${changes}`));
    
    // Show what was updated
    if (flags.task) {
      this.log(chalk.dim('  • Title updated'));
    }
    if (flags.priority) {
      this.log(chalk.dim(`  • Priority set to ${flags.priority}`));
    }
    if (flags.due) {
      this.log(chalk.dim(`  • Due date set to ${flags.due}`));
    }
    if (flags['clear-due']) {
      this.log(chalk.dim('  • Due date cleared'));
    }
    if (flags.tags) {
      this.log(chalk.dim(`  • Tags set to: ${todo.tags?.join(', ')}`));
    }
    if (flags['clear-tags']) {
      this.log(chalk.dim('  • Tags cleared'));
    }
    if (flags.private !== undefined) {
      this.log(chalk.dim(`  • Privacy set to ${flags.private ? 'private' : 'public'}`));
    }
  }

  /**
   * Start background process for update operation
   */
  private startBackgroundProcess(job: any, args: any, flags: any): any {
    const scriptPath = path.join(__dirname, '..', 'utils', 'background-update-worker.js');
    const updateArgs = [
      scriptPath,
      job.id,
      JSON.stringify(args),
      JSON.stringify(flags)
    ];

    const childProcess = spawn('node', updateArgs, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Update job with process ID
    jobManager.updateJob(job.id, { pid: childProcess.pid });

    // Set up logging
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        jobManager.writeJobLog(job.id, `STDOUT: ${data.toString()}`);
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        jobManager.writeJobLog(job.id, `STDERR: ${data.toString()}`);
      });
    }

    // Handle process completion
    childProcess.on('exit', (code, signal) => {
      if (code === 0) {
        jobManager.completeJob(job.id, { exitCode: code });
      } else {
        jobManager.failJob(job.id, `Process exited with code ${code}, signal: ${signal}`);
      }
    });

    // Unref to allow parent process to exit
    childProcess.unref();

    return childProcess;
  }

  /**
   * Build args array for background process
   */
  private buildArgsArray(args: any): string[] {
    const result: string[] = [];
    if (args.listName) result.push(args.listName);
    if (args.todoId) result.push(args.todoId);
    if (args.newTitle) result.push(args.newTitle);
    return result;
  }
}
