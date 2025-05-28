import { Todo } from '../../types/todo';
import { TodoService } from '../../services/todoService';
import { createWalrusStorage, WalrusStorage } from '../../utils/walrus-storage';
import { SuiNftStorage } from '../../utils/sui-nft-storage';
import { Logger } from '../../utils/Logger';
import { CLIError } from '../../types/errors/consolidated';
import { configService } from '../../services/config-service';
import { SuiClient } from '../../utils/adapters/sui-client-adapter';
import { KeyManagementService } from '../../services/key-management';

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
  private walrusStorage: WalrusStorage | null = null;
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
      this.walrusStorage = createWalrusStorage();

      // Initialize Sui storage if network configured
      const config = configService.getConfig();
      if (config.network && config.walletAddress) {
        const client = new SuiClient({ url: config.network });
        const keyPair = await KeyManagementService.getInstance().getKeypair();
        if (keyPair) {
          this.suiStorage = new SuiNftStorage(client, keyPair, {
            address: config.walletAddress || '',
            packageId: config.packageId || '',
            collectionId: config.registryId
          });
        }
      }
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to initialize sync services', typedError);
    }
  }

  /**
   * Sync a todo to Walrus storage
   */
  async syncTodoToWalrus(todo: Todo): Promise<string> {
    try {
      if (!this.walrusStorage) {
        throw new CLIError('Walrus storage not initialized', 'WALRUS_NOT_INITIALIZED');
      }

      this.updateSyncStatus(todo.id, { syncStatus: 'pending' });

      // Check if already stored
      if (todo.walrusBlobId) {
        this.logger.info(
          `Todo ${todo.id} already has Walrus blob ID: ${todo.walrusBlobId}`
        );
        return todo.walrusBlobId;
      }

      // Store to Walrus
      this.logger.info(`Storing todo ${todo.id} to Walrus...`);
      const blobId = await this.walrusStorage.storeTodo(todo);

      // Update todo with blob ID
      await this.todoService.updateTodo('default', todo.id, { walrusBlobId: blobId });

      this.updateSyncStatus(todo.id, {
        walrusBlobId: blobId,
        syncStatus: 'synced',
        lastSynced: new Date(),
      });

      return blobId;
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.updateSyncStatus(todo.id, {
        syncStatus: 'failed',
        error: typedError.message,
      });
      throw new CLIError(
        `Failed to sync todo to Walrus: ${typedError.message}`,
        'SYNC_WALRUS_ERROR'
      );
    }
  }

  /**
   * Sync a todo list to Walrus storage
   */
  async syncListToWalrus(listName: string): Promise<string> {
    try {
      if (!this.walrusStorage) {
        throw new CLIError('Walrus storage not initialized', 'WALRUS_NOT_INITIALIZED');
      }

      const list = await this.todoService.getList(listName);
      if (!list) {
        throw new CLIError(`List ${listName} not found`, 'LIST_NOT_FOUND');
      }

      this.logger.info(`Storing list ${listName} to Walrus...`);
      const blobId = await this.walrusStorage.storeList(list);

      // Update list with blob ID
      list.walrusBlobId = blobId;
      await this.todoService.saveList(listName, list);

      return blobId;
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      throw new CLIError(
        `Failed to sync list to Walrus: ${typedError.message}`,
        'SYNC_WALRUS_ERROR'
      );
    }
  }

  /**
   * Retrieve a todo from Walrus storage
   */
  async syncFromWalrus(blobId: string): Promise<Todo> {
    try {
      if (!this.walrusStorage) {
        throw new CLIError('Walrus storage not initialized', 'WALRUS_NOT_INITIALIZED');
      }

      this.logger.info(`Retrieving todo from Walrus blob ${blobId}...`);
      const todo = await this.walrusStorage.retrieveTodo(blobId);

      // Save to local storage
      const list =
        (await this.todoService.getList('default')) ||
        (await this.todoService.createList('default', 'sync-service'));

      // Check if todo already exists
      const existingIndex = list.todos.findIndex(t => t.id === todo.id);
      if (existingIndex >= 0) {
        list.todos[existingIndex] = todo;
      } else {
        list.todos.push(todo);
      }

      await this.todoService.saveList('default', list);

      this.updateSyncStatus(todo.id, {
        walrusBlobId: blobId,
        syncStatus: 'synced',
        lastSynced: new Date(),
      });

      return todo;
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      throw new CLIError(
        `Failed to sync from Walrus: ${typedError.message}`,
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
        this.logger.info(
          `Updating NFT ${todo.nftObjectId} for todo ${todo.id}...`
        );
        await this.suiStorage.updateTodoNftCompletionStatus(
          todo.nftObjectId
        );
        nftObjectId = todo.nftObjectId;
      } else {
        this.logger.info(`Creating NFT for todo ${todo.id}...`);
        nftObjectId = await this.suiStorage.createTodoNft(
          todo,
          todo.walrusBlobId
        );

        // Update todo with NFT ID
        await this.todoService.updateTodo('default', todo.id, { nftObjectId });
      }

      this.updateSyncStatus(todo.id, {
        nftObjectId,
        syncStatus: 'synced',
        lastSynced: new Date(),
      });

      return nftObjectId;
    } catch (error: unknown) {
      const typedError = error instanceof Error ? error : new Error(String(error));
      this.updateSyncStatus(todo.id, {
        syncStatus: 'failed',
        error: typedError.message,
      });
      throw new CLIError(
        `Failed to sync to blockchain: ${typedError.message}`,
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
        const todo = await this.todoService.getTodo(todoId, 'default');
        if (todo) {
          const blobId = await this.syncTodoToWalrus(todo);
          results.set(todoId, blobId);
        }
      } catch (error: unknown) {
        const typedError = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to sync todo ${todoId}:`, typedError);
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
      syncStatus: 'pending' as const,
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
    const list = await this.todoService.getList(listName);
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
