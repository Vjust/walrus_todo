import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { CLIError } from '../types/errors/consolidated';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';
import { createCache } from '../utils/performance-cache';
import { Todo } from '../types/todo';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import pRetry from 'p-retry';

/**
 * @class StoreCommand
 * @description This command stores a todo item on Walrus decentralized storage.
 * It uses the Walrus CLI directly to upload todo data and returns the blob ID.
 * Supports batch processing for uploading multiple todos efficiently.
 */
export default class StoreCommand extends BaseCommand {
  static description = 'Store a todo on Walrus and get blob ID reference';

  static examples = [
    '<%= config.bin %> store --todo 123 --list my-todos                    # Store single todo',
    '<%= config.bin %> store --todo "Buy groceries" --list my-todos        # Store by title',
    '<%= config.bin %> store --todo 123 --list my-todos --epochs 10        # Store for 10 epochs',
    '<%= config.bin %> store --todo 123 --list my-todos --mock             # Test without storing',
    '<%= config.bin %> store --all --list my-todos                         # Store all todos',
    '<%= config.bin %> store --all --list work --create-nft                # Store all and create NFTs',
    '<%= config.bin %> store --todo 456 --list personal --network testnet  # Use specific network',
    '<%= config.bin %> store --all --list my-todos --batch-size 10',
  ];

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
  };

  private todoService = new TodoService();
  private uploadCache = createCache<string>('upload-hashes', {
    strategy: 'TTL',
    ttlMs: 3600000, // 1 hour
    persistenceDir: '.walrus/cache/uploads',
  });

  async run() {
    const { flags } = await this.parse(StoreCommand);

    // Validate flags
    if (!flags.todo && !flags.all) {
      throw new CLIError(
        'Either --todo or --all must be specified',
        'INVALID_FLAGS'
      );
    }

    if (flags.todo && flags.all) {
      throw new CLIError(
        'Cannot specify both --todo and --all',
        'INVALID_FLAGS'
      );
    }

    try {
      // Step 1: Load configuration
      this.log('');
      const list = await this.withSpinner(
        'Loading configuration...',
        async () => {
          const todoList = await this.todoService.getList(flags.list);
          if (!todoList) {
            throw new CLIError(
              `List "${flags.list}" not found`,
              'LIST_NOT_FOUND'
            );
          }
          return todoList;
        }
      );

      // Determine which todos to store
      let todosToStore: Todo[] = [];

      if (flags.all) {
        todosToStore = list.todos;
        if (todosToStore.length === 0) {
          throw new CLIError(
            `No todos found in list "${flags.list}"`,
            'NO_TODOS_FOUND'
          );
        }
      } else {
        const todo = list.todos.find(
          t => t.id === flags.todo || t.title === flags.todo
        );
        if (!todo) {
          throw new CLIError(
            `Todo "${flags.todo}" not found in list "${flags.list}"`,
            'TODO_NOT_FOUND'
          );
        }
        todosToStore = [todo];
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
          list: flags.list,
          network: flags.network
        });
      } else {
        // Batch upload
        await this.storeBatchTodos(todosToStore, walrusStorage, {
          'batch-size': flags['batch-size'],
          epochs: flags.epochs,
          reuse: flags.reuse,
          list: flags.list,
          network: flags.network
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
    flags: { epochs: number; json: boolean; reuse: boolean; retry?: boolean; mock?: boolean; list: string; network?: string }
  ): Promise<void> {
    let blobId: string;
    let attemptCount = 0;

    try {
      blobId = await this.withSpinner(
        `Storing todo "${todo.title}" on Walrus${flags.mock ? ' (mock mode)' : ''}...`,
        async () => {
          if (flags.retry) {
            // Use p-retry for exponential backoff retry strategy
            return await pRetry(
              async () => {
                attemptCount++;
                try {
                  return await this.uploadTodoWithCache(
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
              () => this.uploadTodoWithCache(todo, walrusStorage, flags),
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

    // Update local todo with blob ID
    await this.updateLocalTodo(todo, flags.list, blobId);

    // Save blob mapping for future reference
    this.saveBlobMapping(todo.id, blobId);

    // Display success information (including retry message if used)
    this.displaySuccessInfo(todo, blobId, flags, attemptCount);
  }

  /**
   * Store multiple todos in batch
   */
  private async storeBatchTodos(
    todos: Todo[],
    walrusStorage: ReturnType<typeof createWalrusStorage>,
    flags: {
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

    const operations = todos.map((todo, index) => ({
      name: `${index + 1}/${todos.length}: ${todo.title}`,
      total: 100,
      operation: async (bar: { increment: (delta: number) => void }) => {
        try {
          bar.increment(10);

          // Check cache first
          const hash = this.getTodoHash(todo);
          const cachedBlobId = await this.uploadCache.get(hash);

          if (cachedBlobId) {
            bar.increment(90);
            return { todo, blobId: cachedBlobId, cached: true };
          }

          bar.increment(20);

          // Upload to Walrus
          const blobId = await walrusStorage.storeTodo(todo, flags.epochs);

          bar.increment(40);

          // Cache the result
          await this.uploadCache.set(hash, blobId);

          bar.increment(20);

          // Update local todo
          await this.todoService.updateTodo(flags.list, todo.id, {
            walrusBlobId: blobId,
            storageLocation: 'blockchain',
            updatedAt: new Date().toISOString(),
          });

          // Save blob mapping for future reference
          this.saveBlobMapping(todo.id, blobId);

          bar.increment(10);
          return { todo, blobId, cached: false };
        } catch (error) {
          bar.increment(100);
          throw error;
        }
      },
    }));

    const results = await this.runWithMultiProgress(operations);

    // Separate successful and failed results
    const successful = results.filter(r => r !== undefined);
    const failedCount = todos.length - successful.length;
    const cacheHits = successful.filter(r => r.cached).length;
    const duration = Date.now() - startTime;

    // Display summary
    this.log('');
    this.section(
      'Batch Upload Summary',
      [
        `Total todos: ${chalk.cyan(todos.length)}`,
        `Successful: ${chalk.green(successful.length)}`,
        `Failed: ${chalk.red(failedCount)}`,
        `Cache hits: ${chalk.yellow(cacheHits)}`,
        `Time taken: ${chalk.cyan(this.formatDuration(duration))}`,
        `Network: ${chalk.cyan(flags.network || 'testnet')}`,
        `Epochs: ${chalk.cyan(flags.epochs || 5)}`,
      ].join('\n')
    );

    this.log('');
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
    flags: { json: boolean; retry?: boolean; mock?: boolean; network?: string; epochs?: number },
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
    this.log(chalk.white(`  Network: ${chalk.cyan(flags.network || 'testnet')}`));
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
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
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
}
