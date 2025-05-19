import { Flags } from '@oclif/core';
import BaseCommand from '../base-command';
import { TodoService } from '../services/todoService';
import { createWalrusStorage } from '../utils/walrus-storage';
import { CLIError } from '../types/error';
import chalk from 'chalk';
import { RetryManager } from '../utils/retry-manager';
import { BatchProcessor } from '../utils/batch-processor';
import { createCache } from '../utils/performance-cache';
import { Todo } from '../types/todo';
import * as crypto from 'crypto';

/**
 * @class StoreCommand
 * @description This command stores a todo item on Walrus decentralized storage.
 * It uses the Walrus CLI directly to upload todo data and returns the blob ID.
 * Supports batch processing for uploading multiple todos efficiently.
 */
export default class StoreCommand extends BaseCommand {
  static description = 'Store a todo on Walrus and get blob ID reference';

  static examples = [
    '<%= config.bin %> store --todo 123 --list my-todos',
    '<%= config.bin %> store --todo "Buy groceries" --list my-todos',
    '<%= config.bin %> store --todo 123 --list my-todos --epochs 10',
    '<%= config.bin %> store --todo 123 --list my-todos --mock',
    '<%= config.bin %> store --all --list my-todos',
    '<%= config.bin %> store --all --list my-todos --batch-size 10'
  ];

  static flags = {
    ...BaseCommand.flags,
    mock: Flags.boolean({
      description: 'Use mock mode for testing',
      default: false
    }),
    todo: Flags.string({
      char: 't',
      description: 'ID or title of the todo to store',
      required: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Store all todos in the list',
      default: false
    }),
    list: Flags.string({
      char: 'l',
      description: 'Todo list name',
      default: 'default'
    }),
    epochs: Flags.integer({
      char: 'e',
      description: 'Number of epochs to store for',
      default: 5
    }),
    network: Flags.string({
      char: 'n',
      description: 'Network to use',
      options: ['testnet', 'mainnet'],
      default: 'testnet'
    }),
    'batch-size': Flags.integer({
      char: 'b',
      description: 'Batch size for concurrent uploads',
      default: 5,
      min: 1,
      max: 20
    }),
  };

  private todoService = new TodoService();
  private uploadCache = createCache<string>('upload-hashes', {
    strategy: 'TTL',
    ttlMs: 3600000, // 1 hour
    persistenceDir: '.walrus/cache/uploads'
  });

  async run() {
    const { flags } = await this.parse(StoreCommand);

    // Validate flags
    if (!flags.todo && !flags.all) {
      throw new CLIError('Either --todo or --all must be specified', 'INVALID_FLAGS');
    }
    
    if (flags.todo && flags.all) {
      throw new CLIError('Cannot specify both --todo and --all', 'INVALID_FLAGS');
    }

    try {
      // Step 1: Load configuration
      this.log('');
      const list = await this.withSpinner('Loading configuration...', async () => {
        const todoList = await this.todoService.getList(flags.list);
        if (!todoList) {
          throw new CLIError(`List "${flags.list}" not found`, 'LIST_NOT_FOUND');
        }
        return todoList;
      });

      // Determine which todos to store
      let todosToStore: Todo[] = [];
      
      if (flags.all) {
        todosToStore = list.todos;
        if (todosToStore.length === 0) {
          throw new CLIError(`No todos found in list "${flags.list}"`, 'NO_TODOS_FOUND');
        }
      } else {
        const todo = list.todos.find(t => t.id === flags.todo || t.title === flags.todo);
        if (!todo) {
          throw new CLIError(`Todo "${flags.todo}" not found in list "${flags.list}"`, 'TODO_NOT_FOUND');
        }
        todosToStore = [todo];
      }

      this.success(`Found ${todosToStore.length} todo(s) to store`);

      // Step 2: Initialize Walrus storage
      const walrusStorage = await this.withSpinner('Connecting to Walrus storage...', async () => {
        const storage = createWalrusStorage(flags.network, flags.mock);
        await this.connectToWalrus(storage, flags.network);
        return storage;
      }, { style: 'walrus' });

      // Step 3: Store todos (single or batch)
      if (todosToStore.length === 1) {
        // Single todo upload
        await this.storeSingleTodo(todosToStore[0], walrusStorage, flags);
      } else {
        // Batch upload
        await this.storeBatchTodos(todosToStore, walrusStorage, flags);
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
  private async connectToWalrus(walrusStorage: any, network: string): Promise<void> {
    try {
      await RetryManager.withRetry(
        () => walrusStorage.connect(),
        {
          maxRetries: 3,
          retryableErrors: [/NETWORK_ERROR/, /CONNECTION_REFUSED/, /ECONNREFUSED/],
          onRetry: (error, attempt, delay) => {
            this.warning(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
          }
        }
      );
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
  private async storeSingleTodo(todo: Todo, walrusStorage: any, flags: any): Promise<void> {
    let blobId: string;
    
    try {
      blobId = await this.withSpinner(
        `Storing todo "${todo.title}" on Walrus${flags.mock ? ' (mock mode)' : ''}...`,
        async () => {
          return await RetryManager.withRetry(
            () => this.uploadTodoWithCache(todo, walrusStorage, flags),
            {
              maxRetries: 3,
              retryableErrors: [/NETWORK_ERROR/, /TIMEOUT/, /Connection timed out/],
              onRetry: (error, attempt, delay) => {
                this.warning(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
              }
            }
          );
        },
        { style: 'walrus' }
      );
    } catch (error) {
      this.handleStorageError(error, flags.network);
    }

    // Update local todo with blob ID
    await this.updateLocalTodo(todo, flags.list, blobId);

    // Display success information
    this.displaySuccessInfo(todo, blobId, flags);
  }

  /**
   * Store multiple todos in batch
   */
  private async storeBatchTodos(todos: Todo[], walrusStorage: any, flags: any): Promise<void> {
    const startTime = Date.now();

    this.log('');
    this.section('Batch Upload', `Uploading ${todos.length} todos to Walrus`);

    const operations = todos.map((todo, index) => ({
      name: `${index + 1}/${todos.length}: ${todo.title}`,
      total: 100,
      operation: async (bar: any) => {
        try {
          bar.update(10, { status: 'Checking cache...' });
          
          // Check cache first
          const hash = this.getTodoHash(todo);
          const cachedBlobId = await this.uploadCache.get(hash);
          
          if (cachedBlobId) {
            bar.update(100, { status: 'Cached' });
            return { todo, blobId: cachedBlobId, cached: true };
          }

          bar.update(30, { status: 'Uploading to Walrus...' });
          
          // Upload to Walrus
          const blobId = await walrusStorage.storeTodo(todo, flags.epochs);
          
          bar.update(70, { status: 'Caching result...' });
          
          // Cache the result
          await this.uploadCache.set(hash, blobId);
          
          bar.update(90, { status: 'Updating local todo...' });
          
          // Update local todo
          await this.todoService.updateTodo(flags.list, todo.id, {
            walrusBlobId: blobId,
            storageLocation: 'blockchain',
            updatedAt: new Date().toISOString()
          });
          
          bar.update(100, { status: 'Complete' });
          return { todo, blobId, cached: false };
        } catch (error) {
          throw error;
        }
      }
    }));

    const results = await this.runWithMultiProgress(operations);

    // Separate successful and failed results
    const successful = results.filter(r => r !== undefined);
    const failedCount = todos.length - successful.length;
    const cacheHits = successful.filter(r => r.cached).length;
    const duration = Date.now() - startTime;

    // Display summary
    this.log('');
    this.section('Batch Upload Summary', [
      `Total todos: ${chalk.cyan(todos.length)}`,
      `Successful: ${chalk.green(successful.length)}`,
      `Failed: ${chalk.red(failedCount)}`,
      `Cache hits: ${chalk.yellow(cacheHits)}`,
      `Time taken: ${chalk.cyan(this.formatDuration(duration))}`,
      `Network: ${chalk.cyan(flags.network)}`,
      `Epochs: ${chalk.cyan(flags.epochs)}`
    ].join('\n'));

    this.log('');
  }

  /**
   * Upload todo with cache check
   */
  private async uploadTodoWithCache(todo: Todo, walrusStorage: any, flags: any): Promise<string> {
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
  private async updateLocalTodo(todo: Todo, listName: string, blobId: string): Promise<void> {
    try {
      await this.withSpinner('Updating local todo with blob ID...', async () => {
        await this.todoService.updateTodo(listName, todo.id, {
          walrusBlobId: blobId,
          storageLocation: 'blockchain',
          updatedAt: new Date().toISOString()
        });
      });
    } catch (error) {
      this.warning('Todo was stored on Walrus but local update failed');
    }
  }

  /**
   * Display success information for single todo
   */
  private displaySuccessInfo(todo: Todo, blobId: string, flags: any): void {
    this.log('');
    this.log(chalk.green.bold('✅ Todo stored successfully on Walrus!'));
    this.log('');
    this.log(chalk.white.bold('Storage Details:'));
    this.log(chalk.white(`  Todo: ${chalk.cyan(todo.title)}`));
    this.log(chalk.white(`  Blob ID: ${chalk.yellow(blobId)}`));
    this.log(chalk.white(`  Network: ${chalk.cyan(flags.network)}`));
    this.log(chalk.white(`  Epochs: ${chalk.cyan(flags.epochs)}`));
    
    if (!flags.mock) {
      this.log('');
      this.log(chalk.white.bold('Access your todo:'));
      this.log(chalk.white(`  Walrus URL: ${chalk.cyan(`https://blob.wal.app/${blobId}`)}`));
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
      completed: todo.completed
    });
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Handle storage errors
   */
  private handleStorageError(error: any, network: string): never {
    if (error.message?.includes('could not find WAL coins')) {
      throw new CLIError(
        `Insufficient WAL balance. Run "walrus --context ${network} get-wal" to acquire WAL tokens.`,
        'INSUFFICIENT_WAL'
      );
    }
    throw error;
  }
}