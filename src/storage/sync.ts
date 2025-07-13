/**
 * Sync manager for coordinating between local cache and Walrus storage
 * Handles conflict resolution, batch operations, and auto-sync functionality
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import { WalrusClient, WalrusStoreResponse } from './walrus';
import { getConfig, WaltodoConfig } from '../config/manager';
import { StorageError, ConflictError, WalrusError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Sync item metadata
 */
export interface SyncItem {
  id: string;
  localPath: string;
  blobId?: string;
  lastModified: Date;
  size: number;
  hash: string;
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  errorMessage?: string;
}

/**
 * Sync operation result
 */
export interface SyncResult {
  successful: number;
  failed: number;
  conflicts: number;
  items: SyncItem[];
}

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'local-wins' | 'remote-wins' | 'last-write-wins' | 'manual';

/**
 * Sync manager configuration
 */
export interface SyncManagerConfig {
  localCachePath: string;
  walrusClient: WalrusClient;
  conflictStrategy?: ConflictStrategy;
  batchSize?: number;
  autoSyncInterval?: number; // in seconds
  maxRetries?: number;
}

/**
 * Sync manager events
 */
export interface SyncManagerEvents {
  'sync:start': () => void;
  'sync:complete': (result: SyncResult) => void;
  'sync:error': (error: Error) => void;
  'sync:item:start': (item: SyncItem) => void;
  'sync:item:complete': (item: SyncItem) => void;
  'sync:item:error': (item: SyncItem, error: Error) => void;
  'sync:conflict': (item: SyncItem, strategy: ConflictStrategy) => void;
}

/**
 * Sync manager for coordinating local and remote storage
 */
export class SyncManager extends EventEmitter {
  private config: Required<SyncManagerConfig>;
  private walrusClient: WalrusClient;
  private syncMetadata: Map<string, SyncItem>;
  private autoSyncTimer?: NodeJS.Timeout;
  private isSyncing: boolean = false;
  private metadataPath: string;

  constructor(config: SyncManagerConfig) {
    super();
    
    this.config = {
      conflictStrategy: 'last-write-wins',
      batchSize: 10,
      autoSyncInterval: 300, // 5 minutes
      maxRetries: 3,
      ...config,
    };

    this.walrusClient = config.walrusClient;
    this.syncMetadata = new Map();
    this.metadataPath = path.join(this.config.localCachePath, '.sync-metadata.json');
  }

  /**
   * Initialize the sync manager
   */
  async initialize(): Promise<void> {
    try {
      // Ensure local cache directory exists
      await fs.mkdir(this.config.localCachePath, { recursive: true });

      // Load sync metadata
      await this.loadMetadata();

      logger.info('Sync manager initialized');
    } catch (error) {
      logger.error('Failed to initialize sync manager:', error);
      throw new StorageError(`Failed to initialize sync manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start auto-sync if enabled
   */
  async startAutoSync(): Promise<void> {
    const config = await getConfig();
    
    if (!config.sync.autoSync) {
      logger.debug('Auto-sync is disabled');
      return;
    }

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    const interval = config.sync.syncInterval * 1000; // Convert to milliseconds
    
    this.autoSyncTimer = setInterval(async () => {
      if (!this.isSyncing) {
        try {
          await this.sync();
        } catch (error) {
          logger.error('Auto-sync failed:', error);
          this.emit('sync:error', error as Error);
        }
      }
    }, interval);

    logger.info(`Auto-sync started with interval: ${config.sync.syncInterval}s`);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = undefined;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Perform a full sync between local cache and Walrus
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new StorageError('Sync already in progress');
    }

    this.isSyncing = true;
    this.emit('sync:start');

    const result: SyncResult = {
      successful: 0,
      failed: 0,
      conflicts: 0,
      items: [],
    };

    try {
      // Get all local files
      const localFiles = await this.scanLocalFiles();
      
      // Process files in batches
      for (let i = 0; i < localFiles.length; i += this.config.batchSize) {
        const batch = localFiles.slice(i, i + this.config.batchSize);
        const batchResults = await this.processBatch(batch);
        
        // Aggregate results
        batchResults.forEach(item => {
          result.items.push(item);
          
          switch (item.syncStatus) {
            case 'synced':
              result.successful++;
              break;
            case 'error':
              result.failed++;
              break;
            case 'conflict':
              result.conflicts++;
              break;
          }
        });
      }

      // Save updated metadata
      await this.saveMetadata();

      this.emit('sync:complete', result);
      logger.info('Sync completed', {
        successful: result.successful,
        failed: result.failed,
        conflicts: result.conflicts,
      });

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a specific file
   */
  async syncFile(filePath: string): Promise<SyncItem> {
    const fileId = path.basename(filePath);
    const item = await this.createSyncItem(fileId, filePath);
    
    this.emit('sync:item:start', item);

    try {
      // Check if file exists in Walrus
      const existingItem = this.syncMetadata.get(fileId);
      
      if (existingItem?.blobId) {
        // Check for conflicts
        const hasConflict = await this.checkConflict(item, existingItem);
        
        if (hasConflict) {
          item.syncStatus = 'conflict';
          this.emit('sync:conflict', item, this.config.conflictStrategy);
          
          // Resolve conflict based on strategy
          await this.resolveConflict(item, existingItem);
        }
      }

      // Upload to Walrus if needed
      if (item.syncStatus === 'pending') {
        const data = await fs.readFile(filePath);
        const response = await this.uploadWithRetry(data, item);
        
        item.blobId = response.blobId;
        item.syncStatus = 'synced';
        item.lastModified = new Date();
      }

      // Update metadata
      this.syncMetadata.set(fileId, item);
      this.emit('sync:item:complete', item);

      return item;
    } catch (error) {
      item.syncStatus = 'error';
      item.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.emit('sync:item:error', item, error as Error);
      throw error;
    }
  }

  /**
   * Download a file from Walrus to local cache
   */
  async downloadFile(blobId: string, targetPath: string): Promise<void> {
    try {
      logger.debug('Downloading file from Walrus', { blobId, targetPath });

      // Retrieve data from Walrus
      const data = await this.walrusClient.retrieve(blobId);

      // Ensure directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Write to local file
      await fs.writeFile(targetPath, data);

      logger.debug('File downloaded successfully', { blobId, targetPath });
    } catch (error) {
      logger.error('Failed to download file:', error);
      throw new StorageError(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync status for a file
   */
  getSyncStatus(fileId: string): SyncItem | undefined {
    return this.syncMetadata.get(fileId);
  }

  /**
   * Get all sync metadata
   */
  getAllSyncMetadata(): SyncItem[] {
    return Array.from(this.syncMetadata.values());
  }

  /**
   * Clear sync metadata for a file
   */
  async clearSyncMetadata(fileId: string): Promise<void> {
    this.syncMetadata.delete(fileId);
    await this.saveMetadata();
  }

  /**
   * Process a batch of files for sync
   */
  private async processBatch(files: string[]): Promise<SyncItem[]> {
    const promises = files.map(async (filePath) => {
      try {
        // Check if file still exists before processing
        await fs.access(filePath);
        return await this.syncFile(filePath);
      } catch (error) {
        // Handle case where file was deleted between scan and processing
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          logger.debug('File no longer exists during sync:', filePath);
          const fileId = path.basename(filePath);
          return {
            id: fileId,
            localPath: filePath,
            lastModified: new Date(),
            size: 0,
            hash: '',
            syncStatus: 'error' as const,
            errorMessage: 'File no longer exists',
          };
        }
        throw error;
      }
    });
    
    // Use Promise.allSettled to handle individual failures
    const results = await Promise.allSettled(promises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Create error item
        const fileId = path.basename(files[index]);
        return {
          id: fileId,
          localPath: files[index],
          lastModified: new Date(),
          size: 0,
          hash: '',
          syncStatus: 'error' as const,
          errorMessage: result.reason?.message || 'Unknown error',
        };
      }
    });
  }

  /**
   * Upload with retry logic
   */
  private async uploadWithRetry(data: Buffer, item: SyncItem): Promise<WalrusStoreResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.walrusClient.store(data);
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Upload attempt ${attempt} failed for ${item.id}:`, error);
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new WalrusError(`Failed to upload after ${this.config.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Create a sync item from a file
   */
  private async createSyncItem(id: string, filePath: string): Promise<SyncItem> {
    const stats = await fs.stat(filePath);
    const data = await fs.readFile(filePath);
    const hash = await this.calculateHash(data);
    
    return {
      id,
      localPath: filePath,
      lastModified: stats.mtime,
      size: stats.size,
      hash,
      syncStatus: 'pending',
    };
  }

  /**
   * Calculate hash of data for conflict detection
   */
  private async calculateHash(data: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if there's a conflict between local and remote versions
   */
  private async checkConflict(localItem: SyncItem, remoteItem: SyncItem): Promise<boolean> {
    // If hashes match, no conflict
    if (localItem.hash === remoteItem.hash) {
      return false;
    }

    // If remote has no blob ID, no conflict
    if (!remoteItem.blobId) {
      return false;
    }

    // Otherwise, there's a conflict
    return true;
  }

  /**
   * Resolve a conflict based on the configured strategy
   */
  private async resolveConflict(localItem: SyncItem, remoteItem: SyncItem): Promise<void> {
    switch (this.config.conflictStrategy) {
      case 'local-wins':
        // Local version takes precedence, upload it
        localItem.syncStatus = 'pending';
        break;

      case 'remote-wins':
        // Remote version takes precedence, download it
        if (remoteItem.blobId) {
          await this.downloadFile(remoteItem.blobId, localItem.localPath);
          localItem.syncStatus = 'synced';
          localItem.blobId = remoteItem.blobId;
          localItem.hash = remoteItem.hash;
        }
        break;

      case 'last-write-wins':
        // Compare timestamps
        if (localItem.lastModified > remoteItem.lastModified) {
          localItem.syncStatus = 'pending';
        } else if (remoteItem.blobId) {
          await this.downloadFile(remoteItem.blobId, localItem.localPath);
          localItem.syncStatus = 'synced';
          localItem.blobId = remoteItem.blobId;
          localItem.hash = remoteItem.hash;
        }
        break;

      case 'manual':
        // Keep as conflict, user must resolve manually
        throw new ConflictError(`Manual conflict resolution required for ${localItem.id}`);
    }
  }

  /**
   * Scan local files for sync
   */
  private async scanLocalFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.localCachePath);
      
      return files
        .filter(file => !file.startsWith('.')) // Skip hidden files
        .map(file => path.join(this.config.localCachePath, file));
    } catch (error) {
      logger.error('Failed to scan local files:', error);
      return [];
    }
  }

  /**
   * Load sync metadata from disk
   */
  private async loadMetadata(): Promise<void> {
    try {
      const data = await fs.readFile(this.metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      
      // Convert to Map with proper Date objects
      this.syncMetadata.clear();
      Object.entries(metadata).forEach(([id, item]: [string, any]) => {
        this.syncMetadata.set(id, {
          ...item,
          lastModified: new Date(item.lastModified),
        });
      });
      
      logger.debug('Loaded sync metadata', { count: this.syncMetadata.size });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Metadata file doesn't exist yet, that's OK
        logger.debug('No sync metadata file found, starting fresh');
      } else {
        logger.error('Failed to load sync metadata:', error);
      }
    }
  }

  /**
   * Save sync metadata to disk
   */
  private async saveMetadata(): Promise<void> {
    try {
      const metadata: Record<string, SyncItem> = {};
      
      this.syncMetadata.forEach((item, id) => {
        metadata[id] = item;
      });
      
      await fs.writeFile(
        this.metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );
      
      logger.debug('Saved sync metadata', { count: this.syncMetadata.size });
    } catch (error) {
      logger.error('Failed to save sync metadata:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    
    // Wait for any ongoing sync to complete
    if (this.isSyncing) {
      logger.info('Waiting for ongoing sync to complete...');
      while (this.isSyncing) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Save any pending metadata
    await this.saveMetadata();
    
    // Cleanup walrus client
    await this.walrusClient.cleanup();
    
    logger.debug('Sync manager cleanup completed');
  }
}