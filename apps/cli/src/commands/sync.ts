import { Args, Flags } from '@oclif/core';
import chalk = require('chalk');
import { confirm } from '@inquirer/prompts';
import { select } from '@inquirer/prompts';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/errors/consolidated';
import { createWalrusStorage } from '../utils/walrus-storage';
import { StorageValidator } from '../utils/storage-validator';
import BaseCommand, { ICONS } from '../base-command';

/**
 * @class SyncCommand
 * @description Synchronizes todos between local and blockchain storage for todos
 * configured with 'both' storage mode. Supports positional syntax for intuitive use:
 * - `waltodo sync` syncs all lists (default)
 * - `waltodo sync <list-name>` syncs specific list
 * - Maintains backward compatibility with flag-based syntax
 * - Detects conflicts and allows user to choose resolution strategies
 */
export default class SyncCommand extends BaseCommand {
  static description = 'Synchronize todos between local and blockchain storage. When no list is specified, syncs all lists.';

  static examples = [
    '<%= config.bin %> sync                                    # Sync all lists (default)',
    '<%= config.bin %> sync my-list                            # Sync specific list',
    '<%= config.bin %> sync work                               # Sync "work" list',
    '<%= config.bin %> sync personal                           # Sync "personal" list',
    '',
    '# Background sync options:',
    '<%= config.bin %> sync --background                       # Run sync in background',
    '<%= config.bin %> sync --background --continuous          # Enable continuous sync daemon',
    '<%= config.bin %> sync --background --continuous --interval 60  # Continuous sync every 60 seconds',
    '<%= config.bin %> sync --background --priority high       # High priority background sync',
    '<%= config.bin %> sync --background --batch-size 5        # Process 5 todos per batch',
    '',
    '# Advanced options:',
    '<%= config.bin %> sync --id task-123                      # Sync specific todo by ID',
    '<%= config.bin %> sync --direction pull                   # Pull changes from blockchain only',
    '<%= config.bin %> sync --direction push                   # Push changes to blockchain only',
    '<%= config.bin %> sync my-list --resolve local            # Always use local version for conflicts',
    '<%= config.bin %> sync --resolve newest                   # Always keep newest version',
    '<%= config.bin %> sync --force                            # Skip confirmation prompts',
    '<%= config.bin %> sync personal --dry-run                 # Preview what would be synced',
    '',
    '# Legacy flag syntax (still supported):',
    '<%= config.bin %> sync --all                              # Explicitly sync all lists',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Specific todo ID to sync',
      exclusive: ['all'],
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Explicitly sync all lists (default behavior)',
      exclusive: ['id'],
    }),
    direction: Flags.string({
      char: 'd',
      description: 'Sync direction',
      options: ['push', 'pull', 'both'],
      default: 'both',
    }),
    resolve: Flags.string({
      char: 'r',
      description: 'Conflict resolution strategy',
      options: ['local', 'blockchain', 'newest', 'oldest', 'ask'],
      default: 'ask',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force sync without confirmations',
    }),
    'dry-run': Flags.boolean({
      description: 'Preview changes without applying them',
    }),
  };

  static args = {
    listName: Args.string({
      description: 'Name of the todo list to sync. If not specified, syncs all lists',
      required: false,
    }),
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false);
  private validator: StorageValidator;

  constructor(argv: string[], config: unknown) {
    super(argv, config);
    this.validator = new StorageValidator(this.walrusStorage);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SyncCommand);

    try {
      let todosToSync: Array<{ todo: Todo; listName: string }> = [];
      const syncAllLists = !args.listName || flags.all;

      // Display what we're about to sync
      if (flags['dry-run']) {
        this.log(chalk.blue(`${ICONS.INFO} Dry run mode - no changes will be made`));
      }

      if (syncAllLists && !flags.id) {
        // Default behavior: sync all lists
        const spinner = this.startSpinner('Scanning all lists for todos to sync...');
        const lists = await this.todoService.getAllLists();
        
        if (lists.length === 0) {
          this.stopSpinner();
          this.log(chalk.yellow(`${ICONS.WARNING} No todo lists found`));
          this.log(chalk.dim('Tip: Create a list first with "waltodo add <todo>"'));
          return;
        }

        let totalLists = 0;
        for (const listName of lists) {
          const list = await this.todoService.getList(listName);
          if (list) {
            const bothStorageTodos = list.todos.filter(
              t => t.storageLocation === 'both'
            );
            if (bothStorageTodos.length > 0) {
              totalLists++;
              todosToSync.push(
                ...bothStorageTodos.map(todo => ({ todo, listName }))
              );
            }
          }
        }

        this.stopSpinnerSuccess(spinner, `Found ${todosToSync.length} todo${todosToSync.length !== 1 ? 's' : ''} to sync across ${totalLists} list${totalLists !== 1 ? 's' : ''}`);
        
        if (todosToSync.length > 0) {
          // Show list breakdown
          const listBreakdown = new Map<string, number>();
          todosToSync.forEach(({ listName }) => {
            listBreakdown.set(listName, (listBreakdown.get(listName) || 0) + 1);
          });
          
          this.log(chalk.blue(`\n${ICONS.INFO} Syncing all lists:`));
          listBreakdown.forEach((count, name) => {
            this.log(chalk.dim(`  • ${name}: ${count} todo${count !== 1 ? 's' : ''}`));
          });
        }
      } else {
        // Sync specific list or todo
        const listName = args.listName || 'default';
        const list = await this.todoService.getList(listName);

        if (!list) {
          const availableLists = await this.todoService.getAllLists();
          throw new CLIError(
            `List "${listName}" not found. Available lists: ${availableLists.length > 0 ? availableLists.join(', ') : 'none'}`,
            'LIST_NOT_FOUND'
          );
        }

        if (flags.id) {
          const todo = await this.todoService.findTodoByIdOrTitle(
            flags.id,
            listName
          );
          if (!todo) {
            throw new CLIError(
              `Todo "${flags.id}" not found in list "${listName}"`,
              'TODO_NOT_FOUND'
            );
          }
          if (todo.storageLocation !== 'both') {
            throw new CLIError(
              `Todo "${todo.title}" is not configured for 'both' storage. Current storage: ${todo.storageLocation}`,
              'INVALID_STORAGE'
            );
          }
          todosToSync = [{ todo, listName }];
          this.log(chalk.blue(`${ICONS.INFO} Syncing specific todo: "${todo.title}" from list "${listName}"`));
        } else {
          const bothStorageTodos = list.todos.filter(
            t => t.storageLocation === 'both'
          );
          todosToSync = bothStorageTodos.map(todo => ({ todo, listName }));
          
          if (bothStorageTodos.length > 0) {
            this.log(chalk.blue(`${ICONS.INFO} Syncing list "${listName}" (${bothStorageTodos.length} todo${bothStorageTodos.length !== 1 ? 's' : ''})`));
          }
        }
      }

      if (todosToSync.length === 0) {
        if (syncAllLists) {
          this.log(chalk.yellow('No todos found with "both" storage mode across any lists'));
          this.log(chalk.dim('Tip: Use "waltodo add --storage both" to create todos that sync with blockchain'));
        } else {
          this.log(chalk.yellow(`No todos found with "both" storage mode in list "${args.listName || 'default'}"`));
          this.log(chalk.dim('Tip: Use "waltodo add --storage both" to create todos that sync with blockchain'));
        }
        return;
      }

      // Early exit for dry run after showing what would be synced
      if (flags['dry-run']) {
        this.log(chalk.blue(`\n${ICONS.INFO} Would sync ${todosToSync.length} todo${todosToSync.length !== 1 ? 's' : ''} with "both" storage mode`));
        return;
      }

      // Connect to blockchain
      const connectSpinner = this.startSpinner('Connecting to blockchain...');
      await this.walrusStorage.connect();
      this.stopSpinnerSuccess(connectSpinner, 'Connected to blockchain');

      // Check sync status for all todos
      const statusSpinner = this.startSpinner('Checking sync status...');
      const syncResults = await this.checkSyncStatus(todosToSync);
      this.stopSpinnerSuccess(statusSpinner, 'Sync status checked');

      // Display sync status
      this.displaySyncStatus(syncResults);

      // Process todos that need syncing
      const needsSync = syncResults.filter(r => !r.synced);

      if (needsSync.length === 0) {
        this.log(chalk.green(`${ICONS.SUCCESS} All todos are synchronized`));
        return;
      }

      // Show sync direction info
      if (flags.direction !== 'both') {
        this.log(chalk.blue(`${ICONS.INFO} Sync direction: ${flags.direction}`));
      }

      // Confirm sync if not forced
      if (!flags.force && needsSync.length > 0) {
        const actionText = flags.direction === 'pull' ? 'Pull changes for' : 
                          flags.direction === 'push' ? 'Push changes for' : 'Sync';
        const shouldSync = await confirm({
          message: `${actionText} ${needsSync.length} todo${needsSync.length !== 1 ? 's' : ''}?`,
          default: true,
        });
        if (!shouldSync) {
          this.log(chalk.yellow('Sync cancelled'));
          return;
        }
      }

      // Perform sync operations
      await this.performSync(needsSync, flags.resolve, flags.direction);
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYNC_FAILED'
      );
    } finally {
      await this.walrusStorage.disconnect();
    }
  }

  private async checkSyncStatus(
    todosToSync: Array<{ todo: Todo; listName: string }>
  ): Promise<
    Array<{
      todo: Todo;
      listName: string;
      synced: boolean;
      localNewer?: boolean;
      blockchainNewer?: boolean;
      error?: string;
    }>
  > {
    const results = [];

    for (const { todo, listName } of todosToSync) {
      const syncStatus = await this.validator.validateSyncStatus(todo);
      results.push({
        todo,
        listName,
        ...syncStatus,
      });
    }

    return results;
  }

  private displaySyncStatus(
    syncResults: Array<{
      todo: Todo;
      listName: string;
      synced: boolean;
      localNewer?: boolean;
      blockchainNewer?: boolean;
      error?: string;
    }>
  ): void {
    const sections = [];

    const synced = syncResults.filter(r => r.synced);
    const needsSync = syncResults.filter(r => !r.synced && !r.error);
    const errors = syncResults.filter(r => r.error);

    if (synced.length > 0) {
      sections.push(
        chalk.green(`${ICONS.SUCCESS} Synchronized: ${synced.length}`)
      );
    }

    if (needsSync.length > 0) {
      const conflicts = needsSync.map(r => {
        const direction = r.localNewer
          ? 'Local newer'
          : r.blockchainNewer
            ? 'Blockchain newer'
            : 'Out of sync';
        return `  ${ICONS.ARROW} "${r.todo.title}" - ${chalk.yellow(direction)}`;
      });
      sections.push(
        chalk.yellow(`${ICONS.WARNING} Needs sync: ${needsSync.length}`),
        ...conflicts
      );
    }

    if (errors.length > 0) {
      const errorList = errors.map(
        r => `  ${ICONS.ERROR} "${r.todo.title}" - ${chalk.red(r.error)}`
      );
      sections.push(
        chalk.red(`${ICONS.ERROR} Errors: ${errors.length}`),
        ...errorList
      );
    }

    this.section('Sync Status', sections.join('\n'));
  }

  private async performSync(
    needsSync: Array<{
      todo: Todo;
      listName: string;
      localNewer?: boolean;
      blockchainNewer?: boolean;
    }>,
    resolveStrategy: string,
    direction: string = 'both'
  ): Promise<void> {
    let successCount = 0;
    let failCount = 0;
    let currentIndex = 0;

    for (const { todo, listName, localNewer, blockchainNewer } of needsSync) {
      currentIndex++;
      const progress = `[${currentIndex}/${needsSync.length}]`;
      this.startSpinner(`${progress} Syncing "${todo.title}"...`);
      try {
        let resolution: 'local' | 'blockchain';

        // Determine resolution strategy based on direction and conflict resolution
        if (direction === 'push') {
          resolution = 'local';
        } else if (direction === 'pull') {
          resolution = 'blockchain';
        } else if (resolveStrategy === 'ask') {
          this.stopSpinner();
          resolution = await this.askResolution(
            todo,
            Boolean(localNewer),
            Boolean(blockchainNewer)
          );
          this.startSpinner(`${progress} Applying resolution...`);
        } else if (resolveStrategy === 'newest') {
          resolution = localNewer ? 'local' : 'blockchain';
        } else if (resolveStrategy === 'oldest') {
          resolution = localNewer ? 'blockchain' : 'local';
        } else {
          resolution = resolveStrategy as 'local' | 'blockchain';
        }

        // Perform sync based on resolution
        if (resolution === 'local') {
          // Update blockchain with local version
          if (todo.walrusBlobId) {
            await this.walrusStorage.updateTodo(todo.walrusBlobId, todo);
          }
        } else {
          // Update local with blockchain version
          if (todo.walrusBlobId) {
            const blockchainTodo = await this.walrusStorage.retrieveTodo(
              todo.walrusBlobId
            );
            await this.todoService.updateTodo(
              listName,
              todo.id,
              blockchainTodo
            );
          }
        }

        this.stopSpinnerSuccess(undefined, `Synced "${todo.title}"`);
        successCount++;
      } catch (error) {
        this.stopSpinner();
        failCount++;
        this.warning(`Failed to sync "${todo.title}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Final summary
    if (successCount > 0 && failCount === 0) {
      this.log(chalk.green(`\n${ICONS.SUCCESS} All todos synced successfully!`));
    } else if (successCount > 0) {
      this.log(chalk.green(`\n${ICONS.SUCCESS} Successfully synced ${successCount} todo${successCount !== 1 ? 's' : ''}`));
    }
    if (failCount > 0) {
      this.log(chalk.red(`${ICONS.ERROR} ${failCount} todo${failCount !== 1 ? 's' : ''} failed to sync`));
    }

    // Display summary
    this.section(
      'Sync Summary',
      [
        `${ICONS.SUCCESS} Successfully synced: ${chalk.green(successCount)}`,
        failCount > 0 ? `${ICONS.ERROR} Failed: ${chalk.red(failCount)}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  private async performBackgroundSync(
    needsSync: Array<{
      todo: Todo;
      listName: string;
      localNewer?: boolean;
      blockchainNewer?: boolean;
    }>,
    flags: any
  ): Promise<void> {
    if (!this.backgroundOps) {
      throw new CLIError('Background operations not initialized', 'BACKGROUND_ERROR');
    }

    const syncJobId = uuidv4();
    this.logger.info(`Starting background sync job: ${syncJobId}`);

    if (flags.continuous) {
      // Start continuous sync mode
      this.continuousSyncJobId = await this.startContinuousSync(flags);
      this.log(chalk.green(`${ICONS.SUCCESS} Continuous sync started in background`));
      this.log(chalk.blue(`${ICONS.INFO} Job ID: ${this.continuousSyncJobId}`));
      this.log(chalk.dim(`Use "waltodo status ${this.continuousSyncJobId}" to check progress`));
      this.log(chalk.dim(`Use "waltodo cancel ${this.continuousSyncJobId}" to stop continuous sync`));
      return;
    }

    // Batch sync operation
    const batches = this.createSyncBatches(needsSync, flags['batch-size']);
    const batchJobIds: string[] = [];

    this.log(chalk.blue(`${ICONS.INFO} Starting ${batches.length} sync batch${batches.length !== 1 ? 'es' : ''} in background...`));

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchJobId = await this.backgroundOps.syncTodosInBackground({
        todos: batch.map(item => item.todo),
        direction: flags.direction,
        resolve: flags.resolve,
        batchSize: flags['batch-size'],
        priority: flags.priority as 'low' | 'normal' | 'high',
        onProgress: (operationId, progress) => {
          this.logger.debug(`Batch ${i + 1} progress: ${progress}%`);
        },
        onComplete: (operationId, result) => {
          this.logger.info(`Batch ${i + 1} completed successfully`);
        },
        onError: (operationId, error) => {
          this.logger.error(`Batch ${i + 1} failed:`, error);
        },
      });
      batchJobIds.push(batchJobId);
    }

    this.log(chalk.green(`${ICONS.SUCCESS} Background sync started`));
    this.log(chalk.blue(`${ICONS.INFO} ${batchJobIds.length} batch job${batchJobIds.length !== 1 ? 's' : ''} queued`));
    
    batchJobIds.forEach((jobId, index) => {
      this.log(chalk.dim(`  Batch ${index + 1}: ${jobId}`));
    });

    this.log(chalk.dim(`\nUse "waltodo jobs" to monitor progress`));
    this.log(chalk.dim(`Use "waltodo status <job-id>" for detailed status`));
  }

  private async startContinuousSync(flags: any): Promise<string> {
    if (!this.backgroundOps) {
      throw new CLIError('Background operations not initialized', 'BACKGROUND_ERROR');
    }

    // Start continuous sync daemon using the dedicated method
    const syncJobId = await this.backgroundOps.startContinuousSyncInBackground({
      interval: flags.interval,
      direction: flags.direction,
      resolve: flags.resolve,
      force: flags.force,
      priority: flags.priority as 'low' | 'normal' | 'high',
      onProgress: (operationId, progress, data) => {
        if (data) {
          this.logger.debug(`Continuous sync cycle ${data.cycles}: ${data.cycleSynced} todos synced`);
        }
      },
      onComplete: (operationId, result) => {
        this.logger.info(`Continuous sync completed after ${result.cycles} cycles`);
      },
      onError: (operationId, error) => {
        this.logger.error('Continuous sync error:', error);
      },
    });
    
    this.logger.info(`Continuous sync started with ${flags.interval}s interval`, {
      jobId: syncJobId,
      interval: flags.interval,
    });

    return syncJobId;
  }

  private createSyncBatches(
    needsSync: Array<{
      todo: Todo;
      listName: string;
      localNewer?: boolean;
      blockchainNewer?: boolean;
    }>,
    batchSize: number
  ): Array<Array<{ todo: Todo; listName: string; localNewer?: boolean; blockchainNewer?: boolean }>> {
    const batches = [];
    
    for (let i = 0; i < needsSync.length; i += batchSize) {
      batches.push(needsSync.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private async askResolution(
    todo: Todo,
    localNewer: boolean,
    blockchainNewer: boolean
  ): Promise<'local' | 'blockchain'> {
    const choices = [
      {
        name: `Use local version ${localNewer ? '(newer)' : ''}`,
        value: 'local',
      },
      {
        name: `Use blockchain version ${blockchainNewer ? '(newer)' : ''}`,
        value: 'blockchain',
      },
    ];

    this.log(`\nConflict detected for "${chalk.bold(todo.title)}"`);
    const resolution = await select({
      message: 'Which version should be used?',
      choices,
    });

    return resolution as 'local' | 'blockchain';
  }

  /**
   * Start sync daemon mode
   */
  private async startSyncDaemon(flags: any): Promise<void> {
    this.log(chalk.blue(`${ICONS.INFO} Starting sync daemon...`));
    
    const config = this.createSyncEngineConfig(flags);
    this.syncEngine = new SyncEngine(config);
    
    // Setup event handlers
    this.setupSyncEngineEvents();
    
    // Initialize and start
    await this.syncEngine.initialize(flags.wallet);
    await this.syncEngine.start();
    
    this.log(chalk.green(`${ICONS.SUCCESS} Sync daemon started`));
    this.log(chalk.blue(`${ICONS.INFO} Watching: ${config.todosDirectory}`));
    this.log(chalk.blue(`${ICONS.INFO} API Server: ${config.apiConfig.baseURL}`));
    this.log(chalk.dim('Press Ctrl+C to stop the daemon'));
    
    // Keep the process running
    process.on('SIGINT', async () => {
      this.log('\n' + chalk.yellow('Stopping sync daemon...'));
      if (this.syncEngine) {
        await this.syncEngine.shutdown();
      }
      process.exit(0);
    });
    
    // Keep alive
    await new Promise(() => {});
  }

  /**
   * Start real-time sync mode (foreground)
   */
  private async startRealTimeSync(flags: any): Promise<void> {
    this.log(chalk.blue(`${ICONS.INFO} Starting real-time sync...`));
    
    const config = this.createSyncEngineConfig(flags);
    this.syncEngine = new SyncEngine(config);
    
    // Setup event handlers with more verbose output
    this.setupSyncEngineEvents(true);
    
    // Initialize and start
    await this.syncEngine.initialize(flags.wallet);
    await this.syncEngine.start();
    
    this.log(chalk.green(`${ICONS.SUCCESS} Real-time sync started`));
    this.log(chalk.blue(`${ICONS.INFO} Watching: ${config.todosDirectory}`));
    this.log(chalk.blue(`${ICONS.INFO} API Server: ${config.apiConfig.baseURL}`));
    this.log(chalk.dim('File changes will be automatically synced. Press Ctrl+C to stop.'));
    
    // Show initial status
    const status = this.syncEngine.getSyncStatus();
    this.displaySyncEngineStatus(status);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      this.log('\n' + chalk.yellow('Stopping real-time sync...'));
      if (this.syncEngine) {
        await this.syncEngine.shutdown();
      }
      process.exit(0);
    });
    
    // Keep alive
    await new Promise(() => {});
  }

  /**
   * Stop sync daemon
   */
  private async stopSyncDaemon(): Promise<void> {
    // This would connect to a running daemon and stop it
    // For now, just show a message
    this.log(chalk.yellow(`${ICONS.WARNING} Daemon stop functionality not yet implemented`));
    this.log(chalk.dim('Use Ctrl+C in the daemon terminal to stop it manually'));
  }

  /**
   * Show sync engine status
   */
  private async showSyncStatus(): Promise<void> {
    if (!this.syncEngine) {
      // Try to connect to a running daemon or show offline status
      this.log(chalk.yellow(`${ICONS.WARNING} No active sync engine`));
      this.log(chalk.dim('Start sync with --daemon or --real-time flags'));
      return;
    }
    
    const status = this.syncEngine.getSyncStatus();
    this.displaySyncEngineStatus(status);
  }

  /**
   * Create sync engine configuration
   */
  private createSyncEngineConfig(flags: any): SyncEngineConfig {
    const todosDir = process.env.WALTODO_TODOS_DIR || join(os.homedir(), 'Todos');
    
    return {
      todosDirectory: todosDir,
      apiConfig: {
        baseURL: flags['api-url'],
        timeout: 30000,
        retryAttempts: 3,
        enableWebSocket: true,
        headers: {
          'X-Client': 'WalTodo-CLI',
          'X-Version': '1.0.0'
        }
      },
      syncInterval: 30000, // 30 seconds
      conflictResolution: flags.resolve,
      enableRealTimeSync: flags['real-time'] || flags.daemon,
      maxConcurrentSyncs: 3,
      syncDebounceMs: 2000
    };
  }

  /**
   * Setup sync engine event handlers
   */
  private setupSyncEngineEvents(verbose = false): void {
    if (!this.syncEngine) return;
    
    this.syncEngine.on('initialized', () => {
      if (verbose) {
        this.log(chalk.green(`${ICONS.SUCCESS} Sync engine initialized`));
      }
    });
    
    this.syncEngine.on('started', () => {
      if (verbose) {
        this.log(chalk.green(`${ICONS.SUCCESS} Sync engine started`));
      }
    });
    
    this.syncEngine.on('file-changed', (event) => {
      if (verbose) {
        this.log(chalk.blue(`${ICONS.ARROW} File ${event.type}: ${event.relativePath}`));
      }
    });
    
    this.syncEngine.on('sync-started', () => {
      if (verbose) {
        this.log(chalk.blue(`${ICONS.INFO} Sync started...`));
      }
    });
    
    this.syncEngine.on('sync-completed', (result) => {
      if (verbose || result.errors.length > 0) {
        this.log(chalk.green(`${ICONS.SUCCESS} Sync completed: ${result.syncedFiles} files`));
        if (result.conflicts.length > 0) {
          this.log(chalk.yellow(`${ICONS.WARNING} ${result.conflicts.length} conflicts detected`));
        }
        if (result.errors.length > 0) {
          this.log(chalk.red(`${ICONS.ERROR} ${result.errors.length} errors occurred`));
        }
      }
    });
    
    this.syncEngine.on('conflict-detected', (conflict) => {
      this.log(chalk.yellow(`${ICONS.WARNING} Conflict detected: ${conflict.itemId}`));
      this.log(chalk.dim(`  Local: ${new Date(conflict.localTimestamp).toLocaleString()}`));
      this.log(chalk.dim(`  Remote: ${new Date(conflict.remoteTimestamp).toLocaleString()}`));
    });
    
    this.syncEngine.on('remote-change-applied', (event) => {
      if (verbose) {
        this.log(chalk.cyan(`${ICONS.ARROW} Remote change applied: ${event.type}`));
      }
    });
    
    this.syncEngine.on('error', (error) => {
      this.log(chalk.red(`${ICONS.ERROR} Sync error: ${error.message}`));
    });
    
    this.syncEngine.on('api-disconnected', () => {
      this.log(chalk.yellow(`${ICONS.WARNING} API connection lost, will retry...`));
    });
  }

  /**
   * Display sync engine status
   */
  private displaySyncEngineStatus(status: any): void {
    this.section('Sync Engine Status', [
      `Active: ${status.isActive ? chalk.green('Yes') : chalk.red('No')}`,
      `Last Sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}`,
      `Pending Changes: ${status.pendingChanges}`,
      `Conflicts: ${status.conflicts.length}`,
      status.conflicts.length > 0 ? '\nConflicts:' : null,
      ...status.conflicts.map((c: any) => `  • ${c.itemId} (${c.type})`)
    ].filter(Boolean).join('\n'));
  }
}
