import { EventEmitter } from 'events';
import { join, resolve } from 'path';
import { Logger } from '../utils/Logger';
import { FileWatcher, FileChangeEvent } from '../utils/fileWatcher';
import { ApiClient, ApiSyncEvent, ApiClientConfig } from '../utils/apiClient';
import { TodoService } from './todoService';
import { Todo, TodoList } from '../types/todo';
import { BackgroundCommandOrchestrator } from '../utils/BackgroundCommandOrchestrator';
import { RetryManager } from '../utils/retry-manager';
import { debounce } from 'lodash';
import * as fs from 'fs/promises';

export interface SyncEngineConfig {
  todosDirectory: string;
  apiConfig: ApiClientConfig;
  syncInterval?: number;
  conflictResolution?: 'local' | 'remote' | 'manual' | 'newest';
  enableRealTimeSync?: boolean;
  maxConcurrentSyncs?: number;
  syncDebounceMs?: number;
}

export interface SyncConflict {
  type: 'todo' | 'list';
  itemId: string;
  local: any;
  remote: any;
  localTimestamp: number;
  remoteTimestamp: number;
}

export interface SyncStatus {
  isActive: boolean;
  lastSync: number;
  pendingChanges: number;
  conflicts: SyncConflict[];
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  syncedFiles: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration: number;
}

/**
 * Real-time synchronization engine that watches file system changes
 * and syncs with the API server. Provides bidirectional sync with conflict resolution.
 */
export class SyncEngine extends EventEmitter {
  private logger: Logger;
  private fileWatcher: FileWatcher;
  private apiClient: ApiClient;
  private todoService: TodoService;
  private backgroundOrchestrator: BackgroundCommandOrchestrator;
  private retryManager: RetryManager;
  private config: Required<SyncEngineConfig>;
  
  private isRunning = false;
  private isInitialized = false;
  private pendingChanges = new Map<string, FileChangeEvent>();
  private lastSyncTime = 0;
  private conflicts: SyncConflict[] = [];
  private syncQueue: Array<() => Promise<void>> = [];
  private activeSyncs = 0;
  private wallet: string | null = null;
  
  private debouncedSync: Function;
  private syncInterval: NodeJS.Timer | null = null;

  constructor(config: SyncEngineConfig) {
    super();
    this.logger = new Logger('SyncEngine');
    
    this.config = {
      todosDirectory: resolve(config.todosDirectory),
      apiConfig: config.apiConfig,
      syncInterval: config.syncInterval || 30000, // 30 seconds
      conflictResolution: config.conflictResolution || 'newest',
      enableRealTimeSync: config.enableRealTimeSync ?? true,
      maxConcurrentSyncs: config.maxConcurrentSyncs || 3,
      syncDebounceMs: config.syncDebounceMs || 2000
    };

    this.todoService = new TodoService();
    this.backgroundOrchestrator = new BackgroundCommandOrchestrator();
    
    this.retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffFactor: 2
    });

    this.fileWatcher = new FileWatcher({
      recursive: true,
      ignoreInitial: false,
      debounceMs: 1000,
      fileExtensions: ['.json'],
      excludePatterns: [/\.tmp$/, /\.swp$/, /~$/, /\.DS_Store$/, /\.sync$/]
    });

    this.apiClient = new ApiClient(this.config.apiConfig);
    
    // Create debounced sync function
    this.debouncedSync = debounce(
      this.performSync.bind(this), 
      this.config.syncDebounceMs
    );

    this.setupEventHandlers();
    
    this.logger.info('SyncEngine initialized', {
      todosDirectory: this.config.todosDirectory,
      apiURL: this.config.apiConfig.baseURL,
      realTimeSync: this.config.enableRealTimeSync
    });
  }

  /**
   * Initialize the sync engine
   */
  async initialize(wallet?: string): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('SyncEngine already initialized');
      return;
    }

    this.wallet = wallet || null;
    
    try {
      // Ensure todos directory exists
      await fs.mkdir(this.config.todosDirectory, { recursive: true });
      
      // Connect to API server
      await this.apiClient.connect(this.wallet);
      
      // Start file watching
      await this.fileWatcher.startWatching(this.config.todosDirectory);
      
      // Perform initial sync if wallet is provided
      if (this.wallet) {
        await this.performInitialSync();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      this.logger.info('SyncEngine initialized successfully', { wallet: this.wallet });
      
    } catch (error) {
      this.logger.error('Failed to initialize SyncEngine:', error);
      throw error;
    }
  }

  /**
   * Start the sync engine
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SyncEngine must be initialized before starting');
    }
    
    if (this.isRunning) {
      this.logger.warn('SyncEngine already running');
      return;
    }

    this.isRunning = true;
    
    // Start periodic sync if enabled
    if (this.config.syncInterval > 0) {
      this.syncInterval = setInterval(() => {
        this.debouncedSync();
      }, this.config.syncInterval);
    }
    
    this.emit('started');
    this.logger.info('SyncEngine started', {
      syncInterval: this.config.syncInterval,
      realTimeSync: this.config.enableRealTimeSync
    });
  }

  /**
   * Stop the sync engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Stop periodic sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Wait for active syncs to complete
    while (this.activeSyncs > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.emit('stopped');
    this.logger.info('SyncEngine stopped');
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    await this.stop();
    await this.fileWatcher.destroy();
    await this.apiClient.destroy();
    this.removeAllListeners();
    this.isInitialized = false;
    this.logger.info('SyncEngine shutdown complete');
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // File system change events
    this.fileWatcher.on('change', (event: FileChangeEvent) => {
      this.handleFileChange(event);
    });

    this.fileWatcher.on('error', (error) => {
      this.logger.error('FileWatcher error:', error);
      this.emit('error', error);
    });

    // API client events
    this.apiClient.on('remote-change', (event: ApiSyncEvent) => {
      this.handleRemoteChange(event);
    });

    this.apiClient.on('sync-requested', (data) => {
      this.logger.info('Sync requested from remote client', data);
      this.debouncedSync();
    });

    this.apiClient.on('error', (error) => {
      this.logger.error('ApiClient error:', error);
      this.emit('error', error);
    });

    this.apiClient.on('disconnected', () => {
      this.logger.warn('API client disconnected');
      this.emit('api-disconnected');
    });

    this.apiClient.on('websocket-reconnected', () => {
      this.logger.info('WebSocket reconnected, performing sync');
      this.debouncedSync();
    });
  }

  /**
   * Handle file system changes
   */
  private async handleFileChange(event: FileChangeEvent): Promise<void> {
    if (!this.isRunning || !this.config.enableRealTimeSync) {
      return;
    }

    this.logger.debug('File change detected', {
      type: event.type,
      path: event.relativePath
    });

    // Store pending change
    this.pendingChanges.set(event.filePath, event);
    
    // Trigger debounced sync
    this.debouncedSync();
    
    this.emit('file-changed', event);
  }

  /**
   * Handle remote changes from API
   */
  private async handleRemoteChange(event: ApiSyncEvent): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.debug('Remote change received', {
      type: event.type,
      wallet: event.wallet
    });

    try {
      switch (event.type) {
        case 'todo-created':
        case 'todo-updated':
          await this.applyRemoteTodoChange(event.data as Todo);
          break;
          
        case 'todo-deleted':
          await this.applyRemoteTodoDelete(event.data.id, event.data.wallet);
          break;
          
        case 'todo-completed':
          await this.applyRemoteTodoCompletion(event.data as Todo);
          break;
      }
      
      this.emit('remote-change-applied', event);
      
    } catch (error) {
      this.logger.error('Failed to apply remote change:', error);
      this.emit('error', error);
    }
  }

  /**
   * Perform initial sync when starting up
   */
  private async performInitialSync(): Promise<void> {
    if (!this.wallet) {
      this.logger.warn('No wallet provided, skipping initial sync');
      return;
    }

    this.logger.info('Performing initial sync...');
    
    try {
      // Scan local files first
      const localFiles = await this.fileWatcher.scanDirectory(this.config.todosDirectory);
      this.logger.info(`Found ${localFiles.length} local todo files`);
      
      // Pull remote todos
      const remoteResponse = await this.apiClient.pullTodos(this.wallet);
      if (remoteResponse.success && remoteResponse.data?.todos) {
        this.logger.info(`Found ${remoteResponse.data.todos.length} remote todos`);
        
        // Apply remote changes
        for (const todo of remoteResponse.data.todos) {
          await this.applyRemoteTodoChange(todo, true); // silent mode for initial sync
        }
      }
      
      this.lastSyncTime = Date.now();
      this.emit('initial-sync-complete');
      
      this.logger.info('Initial sync completed successfully');
      
    } catch (error) {
      this.logger.error('Initial sync failed:', error);
      throw error;
    }
  }

  /**
   * Perform synchronization
   */
  private async performSync(): Promise<SyncResult> {
    if (!this.isRunning || this.activeSyncs >= this.config.maxConcurrentSyncs) {
      return {
        success: false,
        syncedFiles: 0,
        conflicts: [],
        errors: ['Sync not available or at max concurrency'],
        duration: 0
      };
    }

    const startTime = Date.now();
    this.activeSyncs++;
    
    try {
      this.logger.info('Starting synchronization...');
      this.emit('sync-started');
      
      const result: SyncResult = {
        success: true,
        syncedFiles: 0,
        conflicts: [],
        errors: [],
        duration: 0
      };

      // Process pending local changes
      const pendingChanges = Array.from(this.pendingChanges.values());
      this.pendingChanges.clear();
      
      for (const change of pendingChanges) {
        try {
          await this.syncFileChange(change);
          result.syncedFiles++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to sync ${change.relativePath}: ${errorMsg}`);
          this.logger.error(`Failed to sync file change:`, error);
        }
      }

      // Check for conflicts
      if (this.conflicts.length > 0) {
        result.conflicts = [...this.conflicts];
        
        if (this.config.conflictResolution !== 'manual') {
          await this.resolveConflicts();
        }
      }

      result.duration = Date.now() - startTime;
      this.lastSyncTime = Date.now();
      
      this.emit('sync-completed', result);
      this.logger.info('Synchronization completed', {
        syncedFiles: result.syncedFiles,
        conflicts: result.conflicts.length,
        errors: result.errors.length,
        duration: result.duration
      });
      
      return result;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Synchronization failed:', error);
      
      const result: SyncResult = {
        success: false,
        syncedFiles: 0,
        conflicts: [],
        errors: [errorMsg],
        duration: Date.now() - startTime
      };
      
      this.emit('sync-failed', result);
      return result;
      
    } finally {
      this.activeSyncs--;
    }
  }

  /**
   * Sync a specific file change
   */
  private async syncFileChange(change: FileChangeEvent): Promise<void> {
    const listName = this.extractListNameFromPath(change.relativePath);
    if (!listName) {
      this.logger.warn(`Cannot determine list name from path: ${change.relativePath}`);
      return;
    }

    try {
      switch (change.type) {
        case 'created':
        case 'modified':
          await this.syncModifiedFile(change.filePath, listName);
          break;
          
        case 'deleted':
          // Handle deleted todo list
          this.logger.info(`Todo list deleted: ${listName}`);
          // Note: We don't automatically delete from server to prevent accidental data loss
          break;
      }
    } catch (error) {
      this.logger.error(`Failed to sync file change ${change.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Sync a modified file to the server
   */
  private async syncModifiedFile(filePath: string, listName: string): Promise<void> {
    try {
      const list = await this.todoService.getList(listName);
      if (!list || !list.todos) {
        this.logger.warn(`No todos found in list: ${listName}`);
        return;
      }

      // Push each todo to the server
      for (const todo of list.todos) {
        try {
          await this.apiClient.pushTodo(todo, listName);
          this.logger.debug(`Pushed todo to server: ${todo.id}`);
        } catch (error) {
          this.logger.error(`Failed to push todo ${todo.id}:`, error);
          throw error;
        }
      }
      
    } catch (error) {
      this.logger.error(`Failed to sync modified file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Apply remote todo change locally
   */
  private async applyRemoteTodoChange(remoteTodo: Todo, silent = false): Promise<void> {
    try {
      // Find which list this todo belongs to
      const lists = await this.todoService.getAllLists();
      let targetList: string | null = null;
      
      for (const listName of lists) {
        const list = await this.todoService.getList(listName);
        if (list?.todos.some(t => t.id === remoteTodo.id)) {
          targetList = listName;
          break;
        }
      }
      
      // If todo not found in any list, add to default list
      if (!targetList) {
        targetList = 'default';
      }
      
      // Check for conflicts
      const existingTodo = await this.todoService.findTodoByIdOrTitle(remoteTodo.id, targetList);
      
      if (existingTodo && !silent) {
        const localTimestamp = new Date(existingTodo.updatedAt || existingTodo.createdAt || 0).getTime();
        const remoteTimestamp = new Date(remoteTodo.updatedAt || remoteTodo.createdAt || 0).getTime();
        
        if (localTimestamp !== remoteTimestamp) {
          // Conflict detected
          const conflict: SyncConflict = {
            type: 'todo',
            itemId: remoteTodo.id,
            local: existingTodo,
            remote: remoteTodo,
            localTimestamp,
            remoteTimestamp
          };
          
          this.conflicts.push(conflict);
          this.emit('conflict-detected', conflict);
          
          this.logger.warn('Conflict detected for todo', {
            id: remoteTodo.id,
            localTime: new Date(localTimestamp).toISOString(),
            remoteTime: new Date(remoteTimestamp).toISOString()
          });
          
          return; // Don't apply change, let conflict resolution handle it
        }
      }
      
      // Apply the change
      if (existingTodo) {
        await this.todoService.updateTodo(targetList, remoteTodo.id, remoteTodo);
      } else {
        await this.todoService.addTodo(targetList, remoteTodo);
      }
      
      if (!silent) {
        this.logger.info(`Applied remote todo change: ${remoteTodo.id}`);
      }
      
    } catch (error) {
      this.logger.error('Failed to apply remote todo change:', error);
      throw error;
    }
  }

  /**
   * Apply remote todo deletion
   */
  private async applyRemoteTodoDelete(todoId: string, wallet: string): Promise<void> {
    if (this.wallet !== wallet) {
      return; // Not for this wallet
    }

    try {
      const lists = await this.todoService.getAllLists();
      
      for (const listName of lists) {
        const deleted = await this.todoService.deleteTodo(listName, todoId);
        if (deleted) {
          this.logger.info(`Applied remote todo deletion: ${todoId}`);
          break;
        }
      }
    } catch (error) {
      this.logger.error('Failed to apply remote todo deletion:', error);
      throw error;
    }
  }

  /**
   * Apply remote todo completion
   */
  private async applyRemoteTodoCompletion(remoteTodo: Todo): Promise<void> {
    try {
      await this.applyRemoteTodoChange(remoteTodo);
    } catch (error) {
      this.logger.error('Failed to apply remote todo completion:', error);
      throw error;
    }
  }

  /**
   * Resolve conflicts based on configured strategy
   */
  private async resolveConflicts(): Promise<void> {
    for (const conflict of this.conflicts) {
      try {
        let resolution: any;
        
        switch (this.config.conflictResolution) {
          case 'local':
            resolution = conflict.local;
            break;
            
          case 'remote':
            resolution = conflict.remote;
            break;
            
          case 'newest':
            resolution = conflict.remoteTimestamp > conflict.localTimestamp 
              ? conflict.remote 
              : conflict.local;
            break;
            
          default:
            continue; // Skip manual resolution in auto mode
        }
        
        // Apply the resolution
        if (conflict.type === 'todo') {
          const lists = await this.todoService.getAllLists();
          let targetList: string | null = null;
          
          for (const listName of lists) {
            const list = await this.todoService.getList(listName);
            if (list?.todos.some(t => t.id === conflict.itemId)) {
              targetList = listName;
              break;
            }
          }
          
          if (targetList) {
            await this.todoService.updateTodo(targetList, conflict.itemId, resolution);
            this.logger.info(`Resolved conflict for todo ${conflict.itemId} using ${this.config.conflictResolution} strategy`);
          }
        }
        
      } catch (error) {
        this.logger.error(`Failed to resolve conflict for ${conflict.itemId}:`, error);
      }
    }
    
    this.conflicts = [];
  }

  /**
   * Extract list name from file path
   */
  private extractListNameFromPath(relativePath: string): string | null {
    const fileName = relativePath.split('/').pop();
    if (!fileName || !fileName.endsWith('.json')) {
      return null;
    }
    
    return fileName.replace('.json', '');
  }

  /**
   * Manually trigger a sync
   */
  async triggerSync(): Promise<SyncResult> {
    this.logger.info('Manual sync triggered');
    return this.performSync();
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isActive: this.isRunning,
      lastSync: this.lastSyncTime,
      pendingChanges: this.pendingChanges.size,
      conflicts: [...this.conflicts],
      errors: [] // Could be expanded to track recent errors
    };
  }

  /**
   * Set wallet for sync operations
   */
  async setWallet(wallet: string): Promise<void> {
    this.wallet = wallet;
    
    if (this.apiClient.isClientConnected()) {
      await this.apiClient.connect(wallet);
    }
    
    this.logger.info('Wallet updated for sync operations', { wallet });
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncEngineConfig {
    return { ...this.config };
  }
}