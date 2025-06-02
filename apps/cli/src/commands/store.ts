import { Args, Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { CLIError } from '../types/errors/consolidated';
import * as chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';
import { createCache } from '../utils/performance-cache';
import { Todo } from '../types/todo';
import { BatchUploader } from '../utils/batch-uploader';
import { getGlobalUploadQueue } from '../utils/upload-queue';
import { performanceMonitor, jobManager } from '../utils/PerformanceMonitor';
import {
  createBackgroundOperationsManager,
  BackgroundUtils,
} from '../utils/background-operations';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import pRetry from 'p-retry';

/**
 * @class StoreCommand
 * @description This command stores a todo item on Walrus decentralized storage.
 * It uses the Walrus CLI directly to upload todo data and returns the blob ID.
 * Supports batch processing for uploading multiple todos efficiently.
 */
export default class StoreCommand extends BaseCommand {
  static description =
    'Store todos to Walrus storage with intuitive syntax\n\nNEW SYNTAX:\n  waltodo store <list>             # Store all todos in list (default)\n  waltodo store <list> <todo>      # Store specific todo by ID or title\n  waltodo store <list> --background # Run in background (non-blocking)\n  waltodo store <list> --detach    # Detach process completely\n\nThe new syntax makes storing todos more natural - just specify the list name,\nand optionally a specific todo. Use --background for non-blocking uploads.\n\nBACKGROUND MODE:\nBackground operations run without blocking the CLI. Use "waltodo jobs" to\nmonitor progress and "waltodo status <job-id>" for detailed information.\n\nLEGACY SYNTAX (still supported):\n  waltodo store --list <list> --todo <todo>\n  waltodo store --list <list> --all';

  static examples = [
    '<%= config.bin %> store my-todos                                      # Store all todos in list',
    '<%= config.bin %> store my-todos 123                                  # Store specific todo by ID',
    '<%= config.bin %> store my-todos "Buy groceries"                      # Store specific todo by title',
    '<%= config.bin %> store my-todos --epochs 10                          # Store all with custom epochs',
    '<%= config.bin %> store my-todos 123 --epochs 10                      # Store specific todo with epochs',
    '<%= config.bin %> store my-todos --background                         # Run in background (non-blocking)',
    '<%= config.bin %> store my-todos --detach                             # Detach process completely',
    '<%= config.bin %> store my-todos --background --job-id my-upload      # Custom job ID',
    '<%= config.bin %> store my-todos --mock                               # Test mode (no actual storage)',
    '<%= config.bin %> store my-todos --batch-size 10                      # Custom batch size for all todos',
    '<%= config.bin %> store --todo 456 --list personal                    # Legacy flag syntax still works',
  ];

  static args = {
    list: Args.string({
      name: 'list',
      description: 'Todo list name',
      required: false,
    }),
    todo: Args.string({
      name: 'todo',
      description:
        'Specific todo ID or title to store (optional, stores all if not specified)',
      required: false,
    }),
  };

  static flags = {
    ...BaseCommand.flags,
    mock: Flags.boolean({
      description: 'Use mock mode for testing',
      default: false,
    }),
    todo: Flags.string({
      char: 't',
      description: 'ID or title of the todo to store',
      required: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Store all todos in the list',
      default: false,
    }),
    list: Flags.string({
      char: 'l',
      description: 'Todo list name',
      default: 'default',
    }),
    epochs: Flags.integer({
      char: 'e',
      description: 'Number of epochs to store for',
      default: 5,
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use',
      options: ['testnet', 'mainnet'],
      default: 'testnet',
    }),
    'batch-size': Flags.integer({
      char: 'b',
      description: 'Batch size for concurrent uploads',
      default: 5,
      min: 1,
      max: 20,
    }),
    retry: Flags.boolean({
      char: 'r',
      description: 'Enable retry logic with exponential backoff',
      default: false,
    }),
    reuse: Flags.boolean({
      description: 'Reuse existing blob IDs when possible',
      default: false,
    }),
    background: Flags.boolean({
      description: 'Run operation in background (non-blocking)',
      default: false,
    }),
    wait: Flags.boolean({
      description:
        'Wait for background operation to complete (only with --background)',
      default: false,
    }),
    'show-progress': Flags.boolean({
      description: 'Show progress updates for background operations',
      default: true,
    }),
    queue: Flags.boolean({
      description: 'Use upload queue for asynchronous background processing',
      default: false,
    }),
    priority: Flags.string({
      description: 'Priority for queue uploads (low/medium/high)',
      options: ['low', 'medium', 'high'],
      default: 'medium',
    }),
    'max-retries': Flags.integer({
      description: 'Maximum retries for queue uploads',
      default: 3,
      min: 0,
      max: 10,
    }),
  };

  private todoService = new TodoService();
  private uploadCache = createCache<string>('upload-hashes', {
    strategy: 'TTL',
    ttlMs: 3600000, // 1 hour
    persistenceDir: '.walrus/cache/uploads',
  });
  private uploadQueue = getGlobalUploadQueue();

  async run() {
    const { args, flags } = await this.parse(StoreCommand);

    // Check for background operation
    if (flags.background) {
      return this.runInBackgroundLegacy(args, flags);
    }

    // Smart argument parsing - support both positional and flag syntax
    const listName = args.list || flags.list || 'default';
    const todoIdentifier = args.todo || flags.todo;
    let storeAll = flags.all;

    // If no specific todo is provided and --all isn't explicitly set, default to storing all
    if (!todoIdentifier && !storeAll) {
      storeAll = true;
    }

    // Validate arguments
    if (todoIdentifier && storeAll) {
      throw new CLIError(
        'Cannot specify both a specific todo and --all flag',
        'INVALID_FLAGS'
      );
    }

    // If no list provided, show helpful error
    if (!listName || listName === 'default') {
      const todoService = new TodoService();
      const allLists = await todoService.getAllLists();

      if (allLists.length === 0) {
        throw new CLIError(
          'No todo lists found. Create a list first with: waltodo add <list-name> -t "First todo"',
          'NO_LISTS_FOUND'
        );
      }

      if (!args.list && !flags.list) {
        throw new CLIError(
          `Please specify a list name. Available lists: ${allLists.join(', ')}\n` +
            `Usage: waltodo store <list-name> [todo-id-or-title]`,
          'LIST_REQUIRED'
        );
      }
    }

    try {
      // Step 1: Load configuration
      this.log('');
      const list = await this.withSpinner(
        'Loading configuration...',
        async () => {
          const todoList = await this.todoService.getList(listName);
          if (!todoList) {
            throw new CLIError(
              `List "${listName}" not found`,
              'LIST_NOT_FOUND'
            );
          }
          return todoList;
        }
      );

      // Determine which todos to store
      let todosToStore: Todo[] = [];

      if (storeAll) {
        todosToStore = list.todos;
        if (todosToStore.length === 0) {
          throw new CLIError(
            `No todos found in list "${listName}"`,
            'NO_TODOS_FOUND'
          );
        }
        this.log(
          chalk.cyan(
            `📦 Storing all ${todosToStore.length} todos from list "${listName}"`
          )
        );
      } else {
        const todo = list.todos.find(
          t => t.id === todoIdentifier || t.title === todoIdentifier
        );
        if (!todo) {
          // Show available todos to help user
          const availableTodos = list.todos
            .map(t => `${t.id}: ${t.title}`)
            .join('\n  ');
          throw new CLIError(
            `Todo "${todoIdentifier}" not found in list "${listName}"\n` +
              `Available todos:\n  ${availableTodos}`,
            'TODO_NOT_FOUND'
          );
        }
        todosToStore = [todo];
        this.log(
          chalk.cyan(`📦 Storing todo "${todo.title}" from list "${listName}"`)
        );
      }

      this.success(`Found ${todosToStore.length} todo(s) to store`);

      // Step 2: Initialize Walrus storage
      const walrusStorage = await this.withSpinner(
        'Connecting to Walrus storage...',
        async () => {
          const network = flags.network || 'testnet';
          const storage = createWalrusStorage(network, flags.mock);
          await this.connectToWalrus(storage, network);
          return storage;
        }
      );

      // Step 3: Store todos (single or batch)
      if (todosToStore.length === 1) {
        // Single todo upload
        await this.storeSingleTodo(todosToStore[0], walrusStorage, {
          epochs: flags.epochs,
          json: flags.json,
          reuse: flags.reuse,
          retry: flags.retry,
          mock: flags.mock,
          list: listName,
          network: flags.network,
        });
      } else {
        // Batch upload
        await this.storeBatchTodos(todosToStore, walrusStorage, {
          'batch-size': flags['batch-size'],
          epochs: flags.epochs,
          reuse: flags.reuse,
          list: listName,
          network: flags.network,
        });
      }

      // Cleanup
      await walrusStorage.disconnect();
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Store failed: ${error instanceof Error ? error.message : String(error)}`,
        'STORE_FAILED'
      );
    }
  }


  /**
   * Display results from background operation
   */
  private displayBackgroundResults(result: { uploads?: Array<{ success: boolean; id: string; blobId?: string; error?: string }> }, todoCount: number): void {
    this.log('');
    this.log(chalk.green.bold('🎉 Background Upload Summary:'));
    this.log('');

    if (result.uploads) {
      const successful = result.uploads.filter(u => u.success);
      const failed = result.uploads.filter(u => !u.success);

      this.log(chalk.white(`  Total todos: ${chalk.cyan(todoCount)}`));
      this.log(chalk.white(`  Successful: ${chalk.green(successful.length)}`));
      this.log(chalk.white(`  Failed: ${chalk.red(failed.length)}`));

      if (successful.length > 0) {
        this.log('');
        this.log(chalk.white.bold('Successful uploads:'));
        successful.forEach(upload => {
          this.log(
            chalk.white(`  ✅ ${upload.id}: ${chalk.yellow(upload.blobId)}`)
          );
        });
      }

      if (failed.length > 0) {
        this.log('');
        this.log(chalk.white.bold('Failed uploads:'));
        failed.forEach(upload => {
          this.log(
            chalk.white(`  ❌ ${upload.id}: ${chalk.red(upload.error)}`)
          );
        });
      }
    }

    this.log('');
  }

  /**
   * Connect to Walrus storage with retry
   */
  private async connectToWalrus(
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    _network: string
  ): Promise<void> {
    try {
      const retryManager = new RetryManager([
        'https://walrus-testnet.nodes.guru:443',
      ]);
      await retryManager.retry(() => walrusStorage.connect(), {
        maxRetries: 3,
        retryableErrors: [
          /NETWORK_ERROR/,
          /CONNECTION_REFUSED/,
          /ECONNREFUSED/,
        ],
        onRetry: (error, attempt, _delay) => {
          this.warning(
            `Retry attempt ${attempt} after ${_delay}ms: ${error.message}`
          );
        },
      });
    } catch (error) {
      if (error.code === 'WALRUS_CLI_NOT_FOUND') {
        throw new CLIError(
          'Walrus CLI not found. Please install it from https://docs.wal.app',
          'WALRUS_CLI_NOT_FOUND'
        );
      }
      throw error;
    }
  }

  /**
   * Store a single todo
   */
  private async storeSingleTodo(
    todo: Todo,
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    flags: {
      epochs: number;
      json: boolean;
      reuse: boolean;
      retry?: boolean;
      mock?: boolean;
      list: string;
      network?: string;
    }
  ): Promise<void> {
    let uploadResult: { blobId: string; transactionId?: string; explorerUrl?: string; aggregatorUrl?: string } | string;
    let attemptCount = 0;

    try {
      uploadResult = await this.withSpinner(
        `Storing todo "${todo.title}" on Walrus${flags.mock ? ' (mock mode)' : ''}...`,
        async () => {
          if (flags.retry) {
            // Use p-retry for exponential backoff retry strategy
            return await pRetry(
              async () => {
                attemptCount++;
                try {
                  return await this.uploadTodoWithCacheDetailed(
                    todo,
                    walrusStorage,
                    flags
                  );
                } catch (_error) {
                  this.warning(
                    `Retry attempt ${attemptCount}: ${_error instanceof Error ? _error.message : String(_error)}`
                  );
                  throw _error;
                }
              },
              {
                retries: 3,
                factor: 2,
                minTimeout: 1000,
                maxTimeout: 5000,
                onFailedAttempt: error => {
                  this.warning(
                    `Attempt ${error.attemptNumber} failed: ${error.message}`
                  );
                },
              }
            );
          } else {
            // Use legacy RetryManager for backward compatibility
            const retryManager = new RetryManager([
              'https://walrus-testnet.nodes.guru:443',
            ]);
            return await retryManager.retry(
              () =>
                this.uploadTodoWithCacheDetailed(todo, walrusStorage, flags),
              {
                maxRetries: 5,
                retryableErrors: [
                  /NETWORK_ERROR/,
                  /TIMEOUT/,
                  /Connection timed out/,
                ],
                onRetry: (error, attempt, _delay) => {
                  this.warning(
                    `Retry attempt ${attempt} after ${_delay}ms: ${error.message}`
                  );
                },
              }
            );
          }
        }
      );
    } catch (error) {
      this.handleStorageError(error, flags.network || 'testnet');
    }

    const blobId =
      typeof uploadResult === 'string' ? uploadResult : uploadResult.blobId;

    // Update local todo with blob ID
    await this.updateLocalTodo(todo, flags.list, blobId);

    // Save blob mapping for future reference
    this.saveBlobMapping(todo.id, blobId);

    // Display success information (including retry message if used)
    this.displaySuccessInfoDetailed(todo, uploadResult, flags, attemptCount);
  }

  /**
   * Store multiple todos in batch using sequential uploads with rate limiting
   */
  private async storeBatchTodos(
    todos: Todo[],
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    options: {
      'batch-size': number;
      epochs: number;
      reuse: boolean;
      list: string;
      network?: string;
    }
  ): Promise<void> {
    const startTime = Date.now();

    this.log('');
    this.section('Batch Upload', `Uploading ${todos.length} todos to Walrus`);

    // Use the enhanced BatchUploader with rate limiting
    const batchUploader = new BatchUploader(walrusStorage);

    try {
      const result = await batchUploader.uploadTodos(todos, {
        epochs: options.epochs,
        progressCallback: (current: number, total: number, todoId: string) => {
          // Find the todo to get its title for display
          const todo = todos.find(t => t.id === todoId);
          const title = todo?.title || todoId;
          this.log(`📦 [${current}/${total}] Uploading: ${chalk.cyan(title)}`);
        },
      });

      // Process results and update local storage
      for (const success of result.successful) {
        const todo = todos.find(t => t.id === success.id);
        if (todo) {
          // Update local todo with blob ID
          await this.updateLocalTodo(todo, options.list, success.blobId);

          // Save blob mapping for future reference
          this.saveBlobMapping(todo.id, success.blobId);

          // Cache the result for future use
          const hash = this.getTodoHash(todo);
          await this.uploadCache.set(hash, success.blobId);
        }
      }

      // Display summary
      const duration = Date.now() - startTime;

      this.log('');
      this.section(
        'Batch Upload Summary',
        [
          `Total todos: ${chalk.cyan(todos.length)}`,
          `Successful: ${chalk.green(result.successful.length)}`,
          `Failed: ${chalk.red(result.failed.length)}`,
          `Cache hits: ${chalk.yellow(0)}`, // Cache logic handled by BatchUploader internally
          `Time taken: ${chalk.cyan(this.formatDurationLocal(duration))}`,
          `Network: ${chalk.cyan(options.network || 'testnet')}`,
          `Epochs: ${chalk.cyan(options.epochs || 5)}`,
        ].join('\n')
      );

      // Display successful uploads with transaction details
      if (result.successful.length > 0) {
        this.log('');
        this.log(chalk.white.bold('📋 Successful Uploads:'));
        this.log(chalk.white('─'.repeat(60)));

        for (const success of result.successful) {
          const todo = todos.find(t => t.id === success.id);
          const title = todo?.title || success.id;

          this.log(chalk.white(`✅ ${chalk.cyan(title)}`));
          this.log(chalk.white(`   Blob ID: ${chalk.yellow(success.blobId)}`));

          if (success.transactionId) {
            this.log(
              chalk.white(
                `   Transaction ID: ${chalk.green(success.transactionId)}`
              )
            );
          }

          if (success.explorerUrl) {
            this.log(
              chalk.white(`   Explorer: ${chalk.blue(success.explorerUrl)}`)
            );
          }

          if (success.aggregatorUrl) {
            this.log(
              chalk.white(`   Walrus URL: ${chalk.blue(success.aggregatorUrl)}`)
            );
          } else {
            this.log(
              chalk.white(
                `   Walrus URL: ${chalk.blue(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${success.blobId}`)}`
              )
            );
          }
          this.log('');
        }
      }

      // Display any failures
      if (result.failed.length > 0) {
        this.log('');
        this.log(chalk.red('Failed uploads:'));
        for (const failure of result.failed) {
          const todo = todos.find(t => t.id === failure.id);
          const title = todo?.title || failure.id;
          this.log(`  ❌ ${chalk.red(title)}: ${failure.error}`);
        }
        this.log('');
        this.log(
          chalk.yellow(
            '💡 Tip: Failed uploads can be retried with the same command'
          )
        );
      }

      this.log('');
    } catch (error) {
      throw new CLIError(
        `Batch upload failed: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_UPLOAD_FAILED'
      );
    }
  }

  /**
   * Upload todo with cache check
   */
  private async uploadTodoWithCache(
    todo: Todo,
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    flags: { epochs: number; reuse: boolean }
  ): Promise<string> {
    // Check cache first
    const hash = this.getTodoHash(todo);
    const cachedBlobId = await this.uploadCache.get(hash);

    if (cachedBlobId) {
      this.log(chalk.gray(`Using cached blob ID for "${todo.title}"`));
      return cachedBlobId;
    }

    // Upload to Walrus
    const blobId = await walrusStorage.storeTodo(todo, flags.epochs);

    // Cache the result
    await this.uploadCache.set(hash, blobId);

    return blobId;
  }

  /**
   * Upload todo with cache check and detailed results
   */
  private async uploadTodoWithCacheDetailed(
    todo: Todo,
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    flags: { epochs: number; reuse: boolean }
  ): Promise<{ blobId: string; transactionId?: string; explorerUrl?: string; aggregatorUrl?: string }> {
    // Check cache first
    const hash = this.getTodoHash(todo);
    const cachedBlobId = await this.uploadCache.get(hash);

    if (cachedBlobId) {
      this.log(chalk.gray(`Using cached blob ID for "${todo.title}"`));
      return { blobId: cachedBlobId };
    }

    // Try to use detailed storage method if available
    if (typeof (walrusStorage as any).storeTodoWithDetails === 'function') {
      const result = await (walrusStorage as any).storeTodoWithDetails(
        todo,
        flags.epochs
      ) as { blobId: string; transactionId?: string; explorerUrl?: string; aggregatorUrl?: string };
      // Cache the result
      await this.uploadCache.set(hash, result.blobId);
      return result;
    } else {
      // Fallback to basic method
      const blobId = await walrusStorage.storeTodo(todo, flags.epochs);
      // Cache the result
      await this.uploadCache.set(hash, blobId);
      return { blobId };
    }
  }

  /**
   * Update local todo with blob ID
   */
  private async updateLocalTodo(
    todo: Todo,
    listName: string,
    blobId: string
  ): Promise<void> {
    try {
      await this.withSpinner(
        'Updating local todo with blob ID...',
        async () => {
          await this.todoService.updateTodo(listName, todo.id, {
            walrusBlobId: blobId,
            storageLocation: 'blockchain',
            updatedAt: new Date().toISOString(),
          });
        }
      );
    } catch (_error) {
      this.warning('Todo was stored on Walrus but local update failed');
    }
  }

  /**
   * Display success information for single todo
   */
  private displaySuccessInfo(
    todo: Todo,
    blobId: string,
    flags: {
      json: boolean;
      retry?: boolean;
      mock?: boolean;
      network?: string;
      epochs?: number;
    },
    attemptCount?: number
  ): void {
    this.log('');

    // Display retry success message if retries were used
    if (flags.retry && attemptCount && attemptCount > 1) {
      this.log(
        chalk.green(`Storage successful after ${attemptCount} attempts`)
      );
    }

    this.log(chalk.green.bold('✅ Todo stored successfully on Walrus!'));
    this.log('');
    this.log(chalk.white.bold('Storage Details:'));
    this.log(chalk.white(`  Todo: ${chalk.cyan(todo.title)}`));
    this.log(chalk.white(`  Blob ID: ${chalk.yellow(blobId)}`));
    this.log(
      chalk.white(`  Network: ${chalk.cyan(flags.network || 'testnet')}`)
    );
    this.log(chalk.white(`  Epochs: ${chalk.cyan(flags.epochs || 5)}`));

    if (!flags.mock) {
      this.log('');
      this.log(chalk.white.bold('Access your todo:'));
      this.log(
        chalk.white(
          `  Walrus URL: ${chalk.cyan(`https://blob.wal.app/${blobId}`)}`
        )
      );
    }

    this.log('');
  }

  /**
   * Display enhanced success information for single todo with transaction details
   */
  private displaySuccessInfoDetailed(
    todo: Todo,
    uploadResult: { blobId: string; transactionId?: string; explorerUrl?: string; aggregatorUrl?: string } | string,
    flags: {
      json: boolean;
      retry?: boolean;
      mock?: boolean;
      network?: string;
      epochs?: number;
    },
    attemptCount?: number
  ): void {
    this.log('');

    // Display retry success message if retries were used
    if (flags.retry && attemptCount && attemptCount > 1) {
      this.log(
        chalk.green(`Storage successful after ${attemptCount} attempts`)
      );
    }

    this.log(chalk.green.bold('✅ Todo stored successfully on Walrus!'));
    this.log('');
    this.log(chalk.white.bold('📋 Storage Details:'));
    this.log(chalk.white('─'.repeat(50)));
    this.log(chalk.white(`  Todo: ${chalk.cyan(todo.title)}`));

    const blobId =
      typeof uploadResult === 'string' ? uploadResult : uploadResult.blobId;
    this.log(chalk.white(`  Blob ID: ${chalk.yellow(blobId)}`));

    if (uploadResult.transactionId) {
      this.log(
        chalk.white(
          `  Transaction ID: ${chalk.green(uploadResult.transactionId)}`
        )
      );
    }

    this.log(
      chalk.white(`  Network: ${chalk.cyan(flags.network || 'testnet')}`)
    );
    this.log(chalk.white(`  Epochs: ${chalk.cyan(flags.epochs || 5)}`));

    if (!flags.mock) {
      this.log('');
      this.log(chalk.white.bold('🔗 Access Links:'));
      this.log(chalk.white('─'.repeat(50)));
      if (uploadResult.aggregatorUrl) {
        this.log(
          chalk.white(`  Walrus URL: ${chalk.blue(uploadResult.aggregatorUrl)}`)
        );
      } else {
        const network = flags.network || 'testnet';
        const aggregatorBase =
          network === 'mainnet'
            ? 'https://aggregator.walrus-mainnet.walrus.space'
            : 'https://aggregator.walrus-testnet.walrus.space';
        this.log(
          chalk.white(
            `  Walrus URL: ${chalk.blue(`${aggregatorBase}/v1/blobs/${blobId}`)}`
          )
        );
      }

      if (uploadResult.explorerUrl) {
        this.log(
          chalk.white(`  Explorer: ${chalk.blue(uploadResult.explorerUrl)}`)
        );
      }
    }

    this.log('');
  }


  /**
   * Format duration in human-readable format
   */
  private formatDurationLocal(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Generate hash for todo content (for caching)
   */
  private getTodoHash(todo: Todo): string {
    const content = JSON.stringify({
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      dueDate: todo.dueDate,
      tags: todo.tags,
      completed: todo.completed,
    });

    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Handle storage errors
   */
  private handleStorageError(error: unknown, network: string): never {
    const errorObj = error as { message?: string };
    if (errorObj?.message?.includes('could not find WAL coins')) {
      throw new CLIError(
        `Insufficient WAL balance. Run "walrus --context ${network} get-wal" to acquire WAL tokens.`,
        'INSUFFICIENT_WAL'
      );
    }
    throw error;
  }

  /**
   * Save a mapping between todo ID and blob ID
   * @param todoId Todo ID
   * @param blobId Blob ID
   */
  private saveBlobMapping(todoId: string, blobId: string): void {
    try {
      const configDir = this.getConfigDir();
      const blobMappingsFile = path.join(configDir, 'blob-mappings.json');

      // Read existing mappings or create empty object
      let mappings: Record<string, string> = {};
      if (fs.existsSync(blobMappingsFile)) {
        try {
          const content = fs.readFileSync(blobMappingsFile, 'utf8');
          mappings = JSON.parse(content);
        } catch (error) {
          this.warning(
            `Error reading blob mappings file: ${error instanceof Error ? error.message : String(error)}`
          );
          // Continue with empty mappings
        }
      }

      // Add or update mapping
      mappings[todoId] = blobId;

      // Write mappings back to file using centralized method (handles directory creation)
      this.writeFileSafe(
        blobMappingsFile,
        JSON.stringify(mappings, null, 2),
        'utf8'
      );
      this.debugLog(`Saved blob mapping: ${todoId} -> ${blobId}`);
    } catch (error) {
      this.warning(
        `Failed to save blob mapping: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run store operation in background (non-blocking)
   */
  private async runInBackgroundLegacy(args: { list?: string; todo?: string }, flags: Record<string, unknown>): Promise<void> {
    // Create background job
    const commandArgs = [];

    // Add positional arguments
    if (args.list) commandArgs.push(args.list);
    if (args.todo) commandArgs.push(args.todo);

    // Convert flags to arguments
    Object.entries(flags).forEach(([key, value]) => {
      if (key === 'background' || key === 'detach' || key === 'job-id') return;

      if (value === true) {
        commandArgs.push(`--${key}`);
      } else if (value !== false && value !== undefined) {
        commandArgs.push(`--${key}`, String(value));
      }
    });

    const job = jobManager.createJob('store', commandArgs, flags);

    if (flags.detach) {
      // Spawn detached process
      const child = spawn(
        process.execPath,
        [require.resolve('../../index.js'), 'store', ...commandArgs],
        {
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, WALTODO_JOB_ID: job.id },
        }
      );

      // Redirect output to job files
      if (child.stdout && job.outputFile) {
        child.stdout.pipe(fs.createWriteStream(job.outputFile));
      }
      if (child.stderr && job.logFile) {
        child.stderr.pipe(fs.createWriteStream(job.logFile, { flags: 'a' }));
      }

      child.unref();
      jobManager.startJob(job.id, child.pid);

      this.log(chalk.green(`🚀 Background job started: ${chalk.bold(job.id)}`));
      this.log(chalk.gray(`   Use 'waltodo jobs' to monitor progress`));
      this.log(chalk.gray(`   Use 'waltodo status ${job.id}' for details`));

      return;
    } else {
      // Run in background but keep terminal attached
      this.log(chalk.yellow(`🔄 Running store operation in background...`));
      this.log(chalk.gray(`   Job ID: ${job.id}`));

      try {
        jobManager.startJob(job.id);

        // Execute the actual store operation
        await this.executeStoreOperation(args, flags, job.id);

        jobManager.completeJob(job.id, {
          completedAt: new Date().toISOString(),
          itemsProcessed: flags.all ? 'all' : '1',
        });

        this.log(chalk.green(`✅ Background operation completed: ${job.id}`));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        jobManager.failJob(job.id, errorMessage);
        this.log(chalk.red(`❌ Background operation failed: ${job.id}`));
        this.log(chalk.red(`   Error: ${errorMessage}`));
      }
    }
  }

  /**
   * Execute the actual store operation (extracted for background use)
   */
  private async executeStoreOperation(
    args: { list?: string; todo?: string },
    flags: Record<string, unknown>,
    jobId?: string
  ): Promise<void> {
    const updateProgress = (progress: number, message?: string) => {
      if (jobId) {
        jobManager.updateProgress(jobId, progress);
        if (message) jobManager.writeJobLog(jobId, message);
      }
    };

    // Smart argument parsing - support both positional and flag syntax
    const listName = args.list || flags.list || 'default';
    const todoIdentifier = args.todo || flags.todo;
    let storeAll = flags.all;

    // If no specific todo is provided and --all isn't explicitly set, default to storing all
    if (!todoIdentifier && !storeAll) {
      storeAll = true;
    }

    updateProgress(10, 'Loading configuration...');

    try {
      // Step 1: Load configuration
      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
      }

      updateProgress(20, 'Determining todos to store...');

      // Determine which todos to store
      let todosToStore: Todo[] = [];

      if (storeAll) {
        todosToStore = list.todos;
        if (todosToStore.length === 0) {
          throw new CLIError(
            `No todos found in list "${listName}"`,
            'NO_TODOS_FOUND'
          );
        }
        updateProgress(30, `Found ${todosToStore.length} todos to store`);
      } else {
        const todo = list.todos.find(
          t => t.id === todoIdentifier || t.title === todoIdentifier
        );
        if (!todo) {
          throw new CLIError(
            `Todo "${todoIdentifier}" not found in list "${listName}"`,
            'TODO_NOT_FOUND'
          );
        }
        todosToStore = [todo];
        updateProgress(30, `Found todo "${todo.title}" to store`);
      }

      updateProgress(40, 'Connecting to Walrus storage...');

      // Step 2: Initialize Walrus storage
      const walrusStorage = createWalrusStorage(
        flags.network || 'testnet',
        flags.mock
      );
      await this.connectToWalrus(walrusStorage, flags.network || 'testnet');

      updateProgress(50, 'Starting upload process...');

      // Step 3: Store todos (single or batch)
      if (todosToStore.length === 1) {
        // Single todo upload
        await this.storeSingleTodoWithProgress(
          todosToStore[0],
          walrusStorage,
          {
            epochs: flags.epochs,
            json: flags.json,
            reuse: flags.reuse,
            retry: flags.retry,
            mock: flags.mock,
            list: listName,
            network: flags.network,
          },
          updateProgress
        );
      } else {
        // Batch upload
        await this.storeBatchTodosWithProgress(
          todosToStore,
          walrusStorage,
          {
            'batch-size': flags['batch-size'],
            epochs: flags.epochs,
            reuse: flags.reuse,
            list: listName,
            network: flags.network,
          },
          updateProgress
        );
      }

      updateProgress(100, 'Operation completed successfully');

      // Cleanup
      await walrusStorage.disconnect();
    } catch (error) {
      if (jobId) {
        jobManager.writeJobLog(
          jobId,
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      throw error;
    }
  }

  /**
   * Store single todo with progress tracking
   */
  private async storeSingleTodoWithProgress(
    todo: Todo,
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    flags: {
      epochs: number;
      json: boolean;
      reuse: boolean;
      retry?: boolean;
      mock?: boolean;
      list: string;
      network?: string;
    },
    updateProgress: (progress: number, message?: string) => void
  ): Promise<void> {
    updateProgress(60, `Uploading todo "${todo.title}"...`);

    let blobId: string;
    try {
      blobId = await this.uploadTodoWithCache(todo, walrusStorage, flags);
      updateProgress(80, `Upload completed, blob ID: ${blobId}`);
    } catch (error) {
      this.handleStorageError(error, flags.network || 'testnet');
    }

    updateProgress(90, 'Updating local todo...');
    await this.updateLocalTodo(todo, flags.list, blobId);
    this.saveBlobMapping(todo.id, blobId);

    updateProgress(100, `Todo "${todo.title}" stored successfully`);
  }

  /**
   * Store batch todos with progress tracking
   */
  private async storeBatchTodosWithProgress(
    todos: Todo[],
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    options: {
      'batch-size': number;
      epochs: number;
      reuse: boolean;
      list: string;
      network?: string;
    },
    updateProgress: (progress: number, message?: string) => void
  ): Promise<void> {
    updateProgress(60, `Starting batch upload of ${todos.length} todos...`);

    const batchUploader = new BatchUploader(walrusStorage);

    try {
      const result = await batchUploader.uploadTodos(todos, {
        epochs: options.epochs,
        progressCallback: (current: number, total: number, todoId: string) => {
          const progress = 60 + (current / total) * 30; // Progress from 60% to 90%
          const todo = todos.find(t => t.id === todoId);
          const title = todo?.title || todoId;
          updateProgress(progress, `[${current}/${total}] Uploading: ${title}`);
        },
      });

      updateProgress(90, 'Processing upload results...');

      // Process results and update local storage
      for (const success of result.successful) {
        const todo = todos.find(t => t.id === success.id);
        if (todo) {
          await this.updateLocalTodo(todo, options.list, success.blobId);
          this.saveBlobMapping(todo.id, success.blobId);

          // Cache the result for future use
          const hash = this.getTodoHash(todo);
          await this.uploadCache.set(hash, success.blobId);
        }
      }

      updateProgress(
        100,
        `Batch upload completed: ${result.successful.length}/${todos.length} successful`
      );

      // Log any failures
      if (result.failed.length > 0) {
        updateProgress(100, `Failed uploads: ${result.failed.length}`);
        for (const failure of result.failed) {
          const todo = todos.find(t => t.id === failure.id);
          const title = todo?.title || failure.id;
          updateProgress(100, `Failed: ${title} - ${failure.error}`);
        }
      }
    } catch (error) {
      throw new CLIError(
        `Batch upload failed: ${error instanceof Error ? error.message : String(error)}`,
        'BATCH_UPLOAD_FAILED'
      );
    }
  }

  /**
   * Run store operation using the upload queue
   */
  private async runWithQueue(args: { list?: string; todo?: string }, flags: Record<string, unknown>): Promise<void> {
    // Parse arguments
    const listName = args.list || flags.list || 'default';
    const todoIdentifier = args.todo || flags.todo;
    let storeAll = flags.all;

    // If no specific todo is provided and --all isn't explicitly set, default to storing all
    if (!todoIdentifier && !storeAll) {
      storeAll = true;
    }

    // Validate arguments
    if (todoIdentifier && storeAll) {
      throw new CLIError(
        'Cannot specify both a specific todo and --all flag',
        'INVALID_FLAGS'
      );
    }

    try {
      // Load todo list
      const list = await this.withSpinner('Loading todo list...', async () => {
        const todoList = await this.todoService.getList(listName);
        if (!todoList) {
          throw new CLIError(`List "${listName}" not found`, 'LIST_NOT_FOUND');
        }
        return todoList;
      });

      // Determine which todos to queue
      let todosToQueue: Todo[] = [];

      if (storeAll) {
        todosToQueue = list.todos;
        if (todosToQueue.length === 0) {
          throw new CLIError(
            `No todos found in list "${listName}"`,
            'NO_TODOS_FOUND'
          );
        }
      } else {
        const todo = list.todos.find(
          t => t.id === todoIdentifier || t.title === todoIdentifier
        );
        if (!todo) {
          throw new CLIError(
            `Todo "${todoIdentifier}" not found in list "${listName}"`,
            'TODO_NOT_FOUND'
          );
        }
        todosToQueue = [todo];
      }

      // Queue todos for upload
      const jobIds: string[] = [];
      const queueOptions = {
        priority: flags.priority as 'low' | 'medium' | 'high',
        epochs: flags.epochs,
        network: flags.network,
        listName: listName,
        maxRetries: flags['max-retries'],
      };

      this.log('');
      this.log(chalk.cyan('📋 Queueing uploads...'));

      for (const todo of todosToQueue) {
        const jobId = await this.uploadQueue.addTodoJob(todo, queueOptions);
        jobIds.push(jobId);

        this.log(
          `  ✓ Queued: ${chalk.yellow(todo.title)} (Job: ${chalk.gray(jobId.substring(0, 8) + '...')})`
        );
      }

      this.log('');
      this.success(
        `Successfully queued ${todosToQueue.length} todo(s) for upload`
      );

      // Show queue status
      const stats = await this.uploadQueue.getStats();
      this.log('');
      this.log(chalk.white.bold('Queue Status:'));
      this.log(`  Pending: ${chalk.yellow(stats.pending)}`);
      this.log(`  Processing: ${chalk.blue(stats.processing)}`);
      this.log(`  Completed: ${chalk.green(stats.completed)}`);
      this.log(`  Failed: ${chalk.red(stats.failed)}`);

      this.log('');
      this.log(chalk.white.bold('Next Steps:'));
      this.log(`  • Monitor progress: ${chalk.cyan('waltodo queue status')}`);
      this.log(`  • Watch real-time: ${chalk.cyan('waltodo queue watch')}`);
      this.log(`  • View job details: ${chalk.cyan('waltodo queue list')}`);

      // Optional: Setup progress monitoring if requested
      if (flags['show-progress'] && !flags.detach) {
        this.log('');
        this.log(
          chalk.cyan(
            '👀 Monitoring upload progress... (Press Ctrl+C to stop monitoring)'
          )
        );
        this.monitorQueueProgress(jobIds);
      }
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }
      throw new CLIError(
        `Queue operation failed: ${error instanceof Error ? error.message : String(error)}`,
        'QUEUE_FAILED'
      );
    }
  }

  /**
   * Monitor progress of queued jobs
   */
  private async monitorQueueProgress(jobIds: string[]): Promise<void> {
    const completedJobs = new Set<string>();
    let monitoring = true;

    // Setup progress event listeners
    this.uploadQueue.on('jobStarted', job => {
      if (jobIds.includes(job.id)) {
        const details = this.getJobDetails(job);
        this.log(`🔄 Started: ${chalk.blue(details)}`);
      }
    });

    this.uploadQueue.on('jobProgress', progress => {
      if (jobIds.includes(progress.jobId)) {
        process.stdout.write(
          `\r⏳ ${progress.message} (${progress.progress}%)`
        );
      }
    });

    this.uploadQueue.on('jobCompleted', job => {
      if (jobIds.includes(job.id)) {
        completedJobs.add(job.id);
        const details = this.getJobDetails(job);
        this.log(
          `\r✅ Completed: ${chalk.green(details)} -> ${chalk.yellow(job.blobId || 'Unknown')}`
        );

        if (completedJobs.size === jobIds.length) {
          this.log('');
          this.success('All uploads completed!');
          monitoring = false;
        }
      }
    });

    this.uploadQueue.on('jobFailed', job => {
      if (jobIds.includes(job.id)) {
        const details = this.getJobDetails(job);
        this.log(`\r❌ Failed: ${chalk.red(details)} - ${job.error}`);
      }
    });

    // Handle Ctrl+C to stop monitoring
    const cleanup = () => {
      monitoring = false;
      this.log('\n');
      this.log(
        chalk.yellow('Stopped monitoring. Jobs continue in background.')
      );
      this.log(`Use ${chalk.cyan('waltodo queue status')} to check progress.`);
    };

    process.on('SIGINT', cleanup);

    // Keep monitoring until all jobs complete or user interrupts
    while (monitoring && completedJobs.size < jobIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    process.removeListener('SIGINT', cleanup);
  }

  /**
   * Get job details for display
   */
  private getJobDetails(job: { type: string; data?: { title?: string; name?: string; todos?: unknown[]; fileName?: string } }): string {
    switch (job.type) {
      case 'todo':
        return job.data?.title?.substring(0, 30) || 'Unknown todo';
      case 'todo-list':
        return `${job.data?.name} (${job.data?.todos?.length || 0} todos)`;
      case 'blob':
        return job.data?.fileName || 'Unknown blob';
      default:
        return 'Unknown job';
    }
  }
}
