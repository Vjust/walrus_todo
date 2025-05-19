import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { TodoService } from '../services/todoService';
import { Todo } from '../types/todo';
import { CLIError } from '../types/error';
import { createWalrusStorage } from '../utils/walrus-storage';
import { StorageValidator } from '../utils/storage-validator';
import BaseCommand, { ICONS } from '../base-command';

/**
 * @class SyncCommand
 * @description This command synchronizes todos between local and blockchain storage
 * for todos configured with 'both' storage mode. It detects conflicts and allows
 * the user to choose resolution strategies.
 */
export default class SyncCommand extends BaseCommand {
  static description = 'Synchronize todos between local and blockchain storage';

  static examples = [
    '<%= config.bin %> sync my-list',
    '<%= config.bin %> sync my-list --id task-123',
    '<%= config.bin %> sync my-list --resolve local',
    '<%= config.bin %> sync --all --resolve newest',
  ];

  static flags = {
    ...BaseCommand.flags,
    id: Flags.string({
      char: 'i',
      description: 'Specific todo ID to sync',
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Sync all todos across all lists',
      exclusive: ['id']
    }),
    resolve: Flags.string({
      char: 'r',
      description: 'Conflict resolution strategy',
      options: ['local', 'blockchain', 'newest', 'oldest', 'ask'],
      default: 'ask'
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Force sync without confirmations'
    }),
  };

  static args = {
    listName: Args.string({
      description: 'Name of the todo list',
      required: false
    })
  };

  private todoService = new TodoService();
  private walrusStorage = createWalrusStorage('testnet', false);
  private validator: StorageValidator;

  constructor(argv: string[], config: any) {
    super(argv, config);
    this.validator = new StorageValidator(this.walrusStorage);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SyncCommand);

    try {
      let todosToSync: Array<{ todo: Todo; listName: string }> = [];

      if (flags.all) {
        // Sync all todos from all lists
        const lists = await this.todoService.getAllLists();
        for (const listName of lists) {
          const list = await this.todoService.getList(listName);
          if (list) {
            const bothStorageTodos = list.todos.filter(t => t.storageLocation === 'both');
            todosToSync.push(...bothStorageTodos.map(todo => ({ todo, listName })));
          }
        }
      } else {
        // Sync specific list or todo
        const listName = args.listName || 'default';
        const list = await this.todoService.getList(listName);
        
        if (!list) {
          throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }

        if (flags.id) {
          const todo = await this.todoService.findTodoByIdOrTitle(flags.id, listName);
          if (!todo) {
            throw new CLIError(`Todo "${flags.id}" not found`, 'TODO_NOT_FOUND');
          }
          if (todo.storageLocation !== 'both') {
            throw new CLIError(`Todo "${todo.title}" is not configured for 'both' storage`, 'INVALID_STORAGE');
          }
          todosToSync = [{ todo, listName }];
        } else {
          const bothStorageTodos = list.todos.filter(t => t.storageLocation === 'both');
          todosToSync = bothStorageTodos.map(todo => ({ todo, listName }));
        }
      }

      if (todosToSync.length === 0) {
        this.log(chalk.yellow('No todos found with "both" storage mode to sync'));
        return;
      }

      // Connect to blockchain
      const spinner = this.startSpinner('Connecting to blockchain...');
      await this.walrusStorage.connect();
      this.stopSpinnerSuccess(spinner, 'Connected to blockchain');

      // Check sync status for all todos
      const syncResults = await this.checkSyncStatus(todosToSync);
      
      // Display sync status
      this.displaySyncStatus(syncResults);

      // Process todos that need syncing
      const needsSync = syncResults.filter(r => !r.synced);
      
      if (needsSync.length === 0) {
        this.log(chalk.green('✓ All todos are synchronized'));
        return;
      }

      // Confirm sync if not forced
      if (!flags.force && needsSync.length > 0) {
        const confirm = await this.confirm(
          `Sync ${needsSync.length} todo${needsSync.length !== 1 ? 's' : ''}?`
        );
        if (!confirm) {
          this.log(chalk.yellow('Sync cancelled'));
          return;
        }
      }

      // Perform sync operations
      await this.performSync(needsSync, flags.resolve);

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
  ): Promise<Array<{
    todo: Todo;
    listName: string;
    synced: boolean;
    localNewer?: boolean;
    blockchainNewer?: boolean;
    error?: string;
  }>> {
    const results = [];
    
    for (const { todo, listName } of todosToSync) {
      const syncStatus = await this.validator.validateSyncStatus(todo);
      results.push({
        todo,
        listName,
        ...syncStatus
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
        const direction = r.localNewer ? 'Local newer' : r.blockchainNewer ? 'Blockchain newer' : 'Out of sync';
        return `  ${ICONS.ARROW} "${r.todo.title}" - ${chalk.yellow(direction)}`;
      });
      sections.push(
        chalk.yellow(`${ICONS.WARNING} Needs sync: ${needsSync.length}`),
        ...conflicts
      );
    }
    
    if (errors.length > 0) {
      const errorList = errors.map(r => 
        `  ${ICONS.ERROR} "${r.todo.title}" - ${chalk.red(r.error)}`
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
    resolveStrategy: string
  ): Promise<void> {
    const spinner = this.startSpinner('Syncing todos...');
    let successCount = 0;
    let failCount = 0;

    for (const { todo, listName, localNewer, blockchainNewer } of needsSync) {
      try {
        let resolution: 'local' | 'blockchain';
        
        // Determine resolution strategy
        if (resolveStrategy === 'ask') {
          this.stopSpinner(spinner);
          resolution = await this.askResolution(todo, localNewer!, blockchainNewer!);
          this.startSpinner('Continuing sync...');
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
          await this.walrusStorage.updateTodo(todo.walrusBlobId!, todo);
        } else {
          // Update local with blockchain version
          const blockchainTodo = await this.walrusStorage.retrieveTodo(todo.walrusBlobId!);
          await this.todoService.updateTodo(listName, todo.id, blockchainTodo);
        }
        
        successCount++;
      } catch (error) {
        failCount++;
        this.warning(`Failed to sync "${todo.title}": ${error.message}`);
      }
    }

    this.stopSpinnerSuccess(
      spinner,
      `Synced ${successCount} todo${successCount !== 1 ? 's' : ''}, ${failCount} failed`
    );

    // Display summary
    this.section('Sync Summary', [
      `${ICONS.SUCCESS} Successfully synced: ${chalk.green(successCount)}`,
      failCount > 0 ? `${ICONS.ERROR} Failed: ${chalk.red(failCount)}` : null,
    ].filter(Boolean).join('\n'));
  }

  private async askResolution(
    todo: Todo,
    localNewer: boolean,
    blockchainNewer: boolean
  ): Promise<'local' | 'blockchain'> {
    const choices = [
      {
        name: `Use local version ${localNewer ? '(newer)' : ''}`,
        value: 'local'
      },
      {
        name: `Use blockchain version ${blockchainNewer ? '(newer)' : ''}`,
        value: 'blockchain'
      }
    ];

    this.log(`\nConflict detected for "${chalk.bold(todo.title)}"`);
    const answer = await this.prompt([{
      type: 'list',
      name: 'resolution',
      message: 'Which version should be used?',
      choices
    }]);

    return answer.resolution;
  }
}