/**
 * Persistence layer for TodoStore with offline support
 * Handles syncing between local cache and Walrus storage
 */

import { Todo, TodoStore } from '../todos/todo';
import { WalrusClient } from './walrus';
import { FileCache, cache } from './cache';
import { logger } from '../utils/logger';

/**
 * Storage metadata for version control and syncing
 */
export interface StorageMetadata {
  version: string;
  schemaVersion: number;
  lastSyncTime?: string;
  walrusBlobId?: string;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';
}

/**
 * TodoStore data structure
 */
export interface TodoStoreData {
  todos: Todo[];
  metadata: StorageMetadata;
}

/**
 * Sync conflict resolution strategies
 */
export type ConflictResolution = 'local' | 'remote' | 'merge';

/**
 * Configuration for persistence layer
 */
export interface PersistenceConfig {
  cache?: FileCache;
  walrusClient?: WalrusClient;
  conflictResolution?: ConflictResolution;
  syncInterval?: number; // in milliseconds
  schemaVersion?: number;
}

/**
 * Persistent TodoStore with offline capabilities
 */
export class PersistentTodoStore implements TodoStore {
  private cache: FileCache;
  private walrusClient?: WalrusClient;
  private conflictResolution: ConflictResolution;
  private schemaVersion: number;
  private syncInterval?: number;
  private syncTimer?: NodeJS.Timer;
  private isSyncing = false;

  private static readonly CACHE_KEY = 'todo-store';
  private static readonly CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(config: PersistenceConfig = {}) {
    this.cache = config.cache || cache;
    this.walrusClient = config.walrusClient;
    this.conflictResolution = config.conflictResolution || 'merge';
    this.schemaVersion = config.schemaVersion || 1;
    this.syncInterval = config.syncInterval;
  }

  /**
   * Initialize the persistent store
   */
  async initialize(): Promise<void> {
    await this.cache.initialize();
    
    // Load initial data from cache or create new
    const cachedData = await this.loadFromCache();
    if (!cachedData) {
      await this.saveToCache({
        todos: [],
        metadata: {
          version: '1.0.0',
          schemaVersion: this.schemaVersion,
          syncStatus: 'synced',
        },
      });
    } else {
      // Handle schema migration if needed
      await this.migrateSchema(cachedData);
    }

    // Start sync if interval is configured
    if (this.syncInterval && this.walrusClient) {
      this.startAutoSync();
    }

    // Initial sync attempt
    if (this.walrusClient) {
      this.sync().catch(error => {
        logger.error('Initial sync failed:', error);
      });
    }
  }

  /**
   * Start automatic synchronization
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.sync().catch(error => {
        logger.error('Auto sync failed:', error);
      });
    }, this.syncInterval!);

    logger.debug('Auto sync started', { interval: this.syncInterval });
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      logger.debug('Auto sync stopped');
    }
  }

  /**
   * Load data from cache
   */
  private async loadFromCache(): Promise<TodoStoreData | null> {
    return await this.cache.get<TodoStoreData>(PersistentTodoStore.CACHE_KEY);
  }

  /**
   * Save data to cache
   */
  private async saveToCache(data: TodoStoreData): Promise<void> {
    await this.cache.set(
      PersistentTodoStore.CACHE_KEY,
      data,
      PersistentTodoStore.CACHE_TTL
    );
  }

  /**
   * Migrate schema if needed
   */
  private async migrateSchema(data: TodoStoreData): Promise<void> {
    if (data.metadata.schemaVersion === this.schemaVersion) {
      return;
    }

    logger.info('Migrating schema', {
      from: data.metadata.schemaVersion,
      to: this.schemaVersion,
    });

    // Add migration logic here based on schema versions
    // For now, just update the version
    data.metadata.schemaVersion = this.schemaVersion;
    await this.saveToCache(data);
  }

  /**
   * Sync with Walrus storage
   */
  async sync(): Promise<void> {
    if (!this.walrusClient) {
      logger.debug('No Walrus client configured, skipping sync');
      return;
    }

    if (this.isSyncing) {
      logger.debug('Sync already in progress, skipping');
      return;
    }

    this.isSyncing = true;

    try {
      const localData = await this.loadFromCache();
      if (!localData) {
        logger.error('No local data to sync');
        return;
      }

      // Check if we have a remote blob to sync with
      if (localData.metadata.walrusBlobId) {
        try {
          const remoteDataStr = await this.walrusClient.retrieve(localData.metadata.walrusBlobId);
          const remoteData: TodoStoreData = JSON.parse(remoteDataStr);

          // Handle conflicts
          const mergedData = await this.resolveConflicts(localData, remoteData);
          
          // Store merged data
          const newBlobId = await this.storeToWalrus(mergedData);
          mergedData.metadata.walrusBlobId = newBlobId;
          mergedData.metadata.lastSyncTime = new Date().toISOString();
          mergedData.metadata.syncStatus = 'synced';

          await this.saveToCache(mergedData);
          logger.info('Sync completed successfully', { blobId: newBlobId });
        } catch (error) {
          logger.error('Failed to retrieve remote data:', error);
          // Continue with local data only
          localData.metadata.syncStatus = 'error';
          await this.saveToCache(localData);
        }
      } else {
        // First sync - just upload local data
        const blobId = await this.storeToWalrus(localData);
        localData.metadata.walrusBlobId = blobId;
        localData.metadata.lastSyncTime = new Date().toISOString();
        localData.metadata.syncStatus = 'synced';
        await this.saveToCache(localData);
        logger.info('Initial sync completed', { blobId });
      }
    } catch (error) {
      logger.error('Sync failed:', error);
      
      // Update sync status
      const localData = await this.loadFromCache();
      if (localData) {
        localData.metadata.syncStatus = 'error';
        await this.saveToCache(localData);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Store data to Walrus
   */
  private async storeToWalrus(data: TodoStoreData): Promise<string> {
    if (!this.walrusClient) {
      throw new Error('Walrus client not configured');
    }

    const response = await this.walrusClient.store(JSON.stringify(data, null, 2));
    return response.blobId;
  }

  /**
   * Resolve conflicts between local and remote data
   */
  private async resolveConflicts(
    local: TodoStoreData,
    remote: TodoStoreData
  ): Promise<TodoStoreData> {
    logger.debug('Resolving conflicts', { strategy: this.conflictResolution });

    switch (this.conflictResolution) {
      case 'local':
        return local;

      case 'remote':
        return remote;

      case 'merge':
        return this.mergeData(local, remote);

      default:
        throw new Error(`Unknown conflict resolution strategy: ${this.conflictResolution}`);
    }
  }

  /**
   * Merge local and remote data
   */
  private mergeData(local: TodoStoreData, remote: TodoStoreData): TodoStoreData {
    // Create a map of todos by ID for efficient merging
    const todoMap = new Map<string, Todo>();

    // Add all remote todos
    remote.todos.forEach(todo => {
      todoMap.set(todo.id, todo);
    });

    // Merge local todos, preferring the most recently updated
    local.todos.forEach(localTodo => {
      const remoteTodo = todoMap.get(localTodo.id);
      
      if (!remoteTodo) {
        // Local-only todo
        todoMap.set(localTodo.id, localTodo);
      } else {
        // Compare update times and keep the most recent
        const localTime = new Date(localTodo.updatedAt).getTime();
        const remoteTime = new Date(remoteTodo.updatedAt).getTime();
        
        if (localTime > remoteTime) {
          todoMap.set(localTodo.id, localTodo);
        }
      }
    });

    // Create merged data
    const mergedTodos = Array.from(todoMap.values());
    
    return {
      todos: mergedTodos,
      metadata: {
        ...local.metadata,
        syncStatus: 'synced',
      },
    };
  }

  /**
   * Check if offline mode is active
   */
  async isOffline(): Promise<boolean> {
    if (!this.walrusClient) {
      return true;
    }

    try {
      const health = await this.walrusClient.healthCheck();
      return !health.aggregator || !health.publisher;
    } catch {
      return true;
    }
  }

  // TodoStore interface implementation

  async getAll(): Promise<Todo[]> {
    const data = await this.loadFromCache();
    return data?.todos || [];
  }

  async getById(id: string): Promise<Todo | null> {
    const todos = await this.getAll();
    return todos.find(todo => todo.id === id) || null;
  }

  async add(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    const data = await this.loadFromCache() || {
      todos: [],
      metadata: {
        version: '1.0.0',
        schemaVersion: this.schemaVersion,
        syncStatus: 'pending' as const,
      },
    };

    const newTodo: Todo = {
      ...todo,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.todos.push(newTodo);
    data.metadata.syncStatus = 'pending';
    
    await this.saveToCache(data);
    
    // Trigger async sync
    this.sync().catch(error => {
      logger.error('Failed to sync after add:', error);
    });

    return newTodo;
  }

  async update(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): Promise<Todo> {
    const data = await this.loadFromCache();
    if (!data) {
      throw new Error('No data found');
    }

    const index = data.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      throw new Error(`Todo not found: ${id}`);
    }

    const updatedTodo: Todo = {
      ...data.todos[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Handle status change to done
    if (updates.status === 'done' && data.todos[index].status !== 'done') {
      updatedTodo.completedAt = new Date().toISOString();
    }

    data.todos[index] = updatedTodo;
    data.metadata.syncStatus = 'pending';
    
    await this.saveToCache(data);
    
    // Trigger async sync
    this.sync().catch(error => {
      logger.error('Failed to sync after update:', error);
    });

    return updatedTodo;
  }

  async delete(id: string): Promise<void> {
    const data = await this.loadFromCache();
    if (!data) {
      throw new Error('No data found');
    }

    const index = data.todos.findIndex(todo => todo.id === id);
    if (index === -1) {
      throw new Error(`Todo not found: ${id}`);
    }

    data.todos.splice(index, 1);
    data.metadata.syncStatus = 'pending';
    
    await this.saveToCache(data);
    
    // Trigger async sync
    this.sync().catch(error => {
      logger.error('Failed to sync after delete:', error);
    });
  }

  async clear(): Promise<void> {
    const data = await this.loadFromCache() || {
      todos: [],
      metadata: {
        version: '1.0.0',
        schemaVersion: this.schemaVersion,
        syncStatus: 'pending' as const,
      },
    };

    data.todos = [];
    data.metadata.syncStatus = 'pending';
    
    await this.saveToCache(data);
    
    // Trigger async sync
    this.sync().catch(error => {
      logger.error('Failed to sync after clear:', error);
    });
  }

  /**
   * Generate a unique ID (similar to todo.ts but included here for completeness)
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<StorageMetadata> {
    const data = await this.loadFromCache();
    if (!data) {
      return {
        version: '1.0.0',
        schemaVersion: this.schemaVersion,
        syncStatus: 'error',
      };
    }
    return data.metadata;
  }

  /**
   * Force a sync operation
   */
  async forceSync(): Promise<void> {
    await this.sync();
  }

  /**
   * Export all data
   */
  async export(): Promise<TodoStoreData> {
    const data = await this.loadFromCache();
    if (!data) {
      throw new Error('No data to export');
    }
    return data;
  }

  /**
   * Import data
   */
  async import(data: TodoStoreData): Promise<void> {
    // Validate imported data
    if (!data.todos || !Array.isArray(data.todos)) {
      throw new Error('Invalid import data: missing todos array');
    }

    // Update metadata
    data.metadata.syncStatus = 'pending';
    data.metadata.schemaVersion = this.schemaVersion;

    await this.saveToCache(data);
    
    // Trigger sync
    this.sync().catch(error => {
      logger.error('Failed to sync after import:', error);
    });
  }
}