import { Todo } from '../../types/todo';
import { TodoService } from '../../services/todoService';
import { createWalrusStorage } from '../../utils/walrus-storage';
import { SuiNftStorage } from '../../utils/sui-nft-storage';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../../types/errors/consolidated';
import { configService } from '../../services/config-service';
import { SuiClient } from '@mysten/sui/client';

export interface SyncStatus {
  todoId: string;
  walrusBlobId?: string;
  nftObjectId?: string;
  lastSynced?: Date;
  syncStatus: 'pending' | 'synced' | 'failed';
  error?: string;
}

export class SyncService {
  private todoService: TodoService;
  private walrusStorage: any;
  private suiStorage: SuiNftStorage | null = null;
  private logger = Logger.getInstance();
  private syncStatusMap: Map<string, SyncStatus> = new Map();

  constructor() {
    this.todoService = new TodoService();
    this.initializeServices();
  }

  private async initializeServices() {
    try {
      // Initialize Walrus storage
      this.walrusStorage = await createWalrusStorage();

      // Initialize Sui storage if network configured
      const config = await configService.loadConfig();
      if (config.network && config.keypair) {
        const client = new SuiClient({ url: config.network });
        this.suiStorage = new SuiNftStorage(client, config.keypair);
      }
    } catch (error) {
      this.logger.error('Failed to initialize sync services', error);
    }
  }

  /**
   * Sync a todo to Walrus storage
   */
  async syncTodoToWalrus(todo: Todo): Promise<string> {
    try {
      this.updateSyncStatus(todo.id, { syncStatus: 'pending' });

      // Check if already stored
      if (todo.walrusBlobId) {
        this.logger.info(`Todo ${todo.id} already has Walrus blob ID: ${todo.walrusBlobId}`);
        return todo.walrusBlobId;
      }

      // Store to Walrus
      this.logger.info(`Storing todo ${todo.id} to Walrus...`);
      const blobId = await this.walrusStorage.storeTodo(todo);

      // Update todo with blob ID
      await this.todoService.updateTodo(todo.id, { walrusBlobId: blobId });

      this.updateSyncStatus(todo.id, {
        walrusBlobId: blobId,
        syncStatus: 'synced',
        lastSynced: new Date()
      });

      return blobId;
    } catch (error) {
      this.updateSyncStatus(todo.id, {
        syncStatus: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new CLIError(
        `Failed to sync todo to Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYNC_WALRUS_ERROR'
      );
    }
  }

  /**
   * Sync a todo list to Walrus storage
   */
  async syncListToWalrus(listName: string): Promise<string> {
    try {
      const list = await this.todoService.getTodoList(listName);
      if (!list) {
        throw new CLIError(`List ${listName} not found`, 'LIST_NOT_FOUND');
      }

      this.logger.info(`Storing list ${listName} to Walrus...`);
      const blobId = await this.walrusStorage.storeList(list);

      // Update list with blob ID
      list.walrusBlobId = blobId;
      await this.todoService.saveTodoList(list);

      return blobId;
    } catch (error) {
      throw new CLIError(
        `Failed to sync list to Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYNC_WALRUS_ERROR'
      );
    }
  }

  /**
   * Retrieve a todo from Walrus storage
   */
  async syncFromWalrus(blobId: string): Promise<Todo> {
    try {
      this.logger.info(`Retrieving todo from Walrus blob ${blobId}...`);
      const todo = await this.walrusStorage.retrieveTodo(blobId);

      // Save to local storage
      const list = await this.todoService.getTodoList('default') || 
                   await this.todoService.createTodoList('default');
      
      // Check if todo already exists
      const existingIndex = list.todos.findIndex(t => t.id === todo.id);
      if (existingIndex >= 0) {
        list.todos[existingIndex] = todo;
      } else {
        list.todos.push(todo);
      }

      await this.todoService.saveTodoList(list);

      this.updateSyncStatus(todo.id, {
        walrusBlobId: blobId,
        syncStatus: 'synced',
        lastSynced: new Date()
      });

      return todo;
    } catch (error) {
      throw new CLIError(
        `Failed to sync from Walrus: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYNC_WALRUS_ERROR'
      );
    }
  }

  /**
   * Sync a todo to Sui blockchain
   */
  async syncToBlockchain(todo: Todo): Promise<string> {
    if (!this.suiStorage) {
      throw new CLIError('Sui storage not initialized', 'SUI_NOT_INITIALIZED');
    }

    try {
      this.updateSyncStatus(todo.id, { syncStatus: 'pending' });

      // Ensure todo is stored in Walrus first
      if (!todo.walrusBlobId) {
        const blobId = await this.syncTodoToWalrus(todo);
        todo.walrusBlobId = blobId;
      }

      // Create or update NFT
      let nftObjectId: string;
      if (todo.nftObjectId) {
        this.logger.info(`Updating NFT ${todo.nftObjectId} for todo ${todo.id}...`);
        await this.suiStorage.updateTodoNftCompletionStatus(
          todo.nftObjectId,
          todo.completed
        );
        nftObjectId = todo.nftObjectId;
      } else {
        this.logger.info(`Creating NFT for todo ${todo.id}...`);
        const nft = await this.suiStorage.createTodoNft(todo, todo.walrusBlobId);
        nftObjectId = nft.objectId;

        // Update todo with NFT ID
        await this.todoService.updateTodo(todo.id, { nftObjectId });
      }

      this.updateSyncStatus(todo.id, {
        nftObjectId,
        syncStatus: 'synced',
        lastSynced: new Date()
      });

      return nftObjectId;
    } catch (error) {
      this.updateSyncStatus(todo.id, {
        syncStatus: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new CLIError(
        `Failed to sync to blockchain: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SYNC_BLOCKCHAIN_ERROR'
      );
    }
  }

  /**
   * Batch sync multiple todos
   */
  async batchSyncToWalrus(todoIds: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    for (const todoId of todoIds) {
      try {
        const todo = await this.todoService.getTodo(todoId);
        if (todo) {
          const blobId = await this.syncTodoToWalrus(todo);
          results.set(todoId, blobId);
        }
      } catch (error) {
        this.logger.error(`Failed to sync todo ${todoId}:`, error);
        results.set(todoId, 'failed');
      }
    }

    return results;
  }

  /**
   * Get sync status for a todo
   */
  getSyncStatus(todoId: string): SyncStatus | undefined {
    return this.syncStatusMap.get(todoId);
  }

  /**
   * Get all sync statuses
   */
  getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatusMap.values());
  }

  /**
   * Update sync status
   */
  private updateSyncStatus(todoId: string, updates: Partial<SyncStatus>) {
    const existing = this.syncStatusMap.get(todoId) || {
      todoId,
      syncStatus: 'pending' as const
    };
    this.syncStatusMap.set(todoId, { ...existing, ...updates });
  }

  /**
   * Sync all todos in a list
   */
  async syncEntireList(listName: string): Promise<{
    listBlobId: string;
    todoResults: Map<string, string>;
  }> {
    const list = await this.todoService.getTodoList(listName);
    if (!list) {
      throw new CLIError(`List ${listName} not found`, 'LIST_NOT_FOUND');
    }

    // Sync individual todos
    const todoIds = list.todos.map(t => t.id);
    const todoResults = await this.batchSyncToWalrus(todoIds);

    // Sync the list itself
    const listBlobId = await this.syncListToWalrus(listName);

    return { listBlobId, todoResults };
  }
}

// Export singleton instance
export const syncService = new SyncService();