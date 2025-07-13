/**
 * Example of how to integrate Walrus CLI storage with sync manager
 * This file demonstrates the proper usage patterns for the new implementations
 */

import { WalrusClient } from './walrus';
import { SyncManager } from './sync';
import { getConfig, getDataPath } from '../config/manager';
import { logger } from '../utils/logger';

/**
 * Example: Initialize Walrus client with CLI
 */
export async function initializeWalrusClient(): Promise<WalrusClient> {
  const config = await getConfig();
  
  // Create Walrus client with CLI configuration
  const walrusClient = new WalrusClient({
    cliPath: config.walrus.cliPath,
    aggregatorUrl: config.walrus.aggregatorUrl,
    publisherUrl: config.walrus.publisherUrl,
    timeout: config.walrus.timeout,
    maxRetries: config.walrus.maxRetries,
  });

  // Test the connection by getting CLI version
  try {
    const version = await walrusClient.getVersion();
    logger.info('Walrus CLI initialized successfully', { version });
  } catch (error) {
    logger.error('Failed to initialize Walrus CLI:', error);
    throw error;
  }

  return walrusClient;
}

/**
 * Example: Initialize sync manager
 */
export async function initializeSyncManager(): Promise<SyncManager> {
  const config = await getConfig();
  const walrusClient = await initializeWalrusClient();
  const localCachePath = getDataPath();

  // Create sync manager
  const syncManager = new SyncManager({
    localCachePath,
    walrusClient,
    conflictStrategy: config.sync.conflictStrategy || 'last-write-wins',
    batchSize: config.sync.batchSize || 10,
    autoSyncInterval: config.sync.syncInterval,
  });

  // Set up event listeners
  syncManager.on('sync:start', () => {
    logger.info('Sync started');
  });

  syncManager.on('sync:complete', (result) => {
    logger.info('Sync completed', {
      successful: result.successful,
      failed: result.failed,
      conflicts: result.conflicts,
    });
  });

  syncManager.on('sync:error', (error) => {
    logger.error('Sync error:', error);
  });

  syncManager.on('sync:conflict', (item, strategy) => {
    logger.warn('Sync conflict detected', {
      item: item.id,
      strategy,
    });
  });

  // Initialize the sync manager
  await syncManager.initialize();

  return syncManager;
}

/**
 * Example: Store data in Walrus using CLI
 */
export async function storeData(data: string): Promise<string> {
  const walrusClient = await initializeWalrusClient();

  try {
    logger.info('Storing data in Walrus', { size: data.length });
    
    const response = await walrusClient.store(data);
    
    logger.info('Data stored successfully', {
      blobId: response.blobId,
      size: response.size,
      cost: response.cost,
    });

    return response.blobId;
  } finally {
    await walrusClient.cleanup();
  }
}

/**
 * Example: Retrieve data from Walrus using CLI
 */
export async function retrieveData(blobId: string): Promise<string> {
  const walrusClient = await initializeWalrusClient();

  try {
    logger.info('Retrieving data from Walrus', { blobId });
    
    const data = await walrusClient.retrieve(blobId);
    
    logger.info('Data retrieved successfully', {
      blobId,
      size: data.length,
    });

    return data;
  } finally {
    await walrusClient.cleanup();
  }
}

/**
 * Example: Perform a full sync
 */
export async function performSync(): Promise<void> {
  const syncManager = await initializeSyncManager();

  try {
    // Start auto-sync if enabled
    await syncManager.startAutoSync();

    // Perform a manual sync
    const result = await syncManager.sync();

    logger.info('Manual sync completed', {
      totalFiles: result.items.length,
      successful: result.successful,
      failed: result.failed,
      conflicts: result.conflicts,
    });

    // Handle any conflicts
    if (result.conflicts > 0) {
      const conflictItems = result.items.filter(item => item.syncStatus === 'conflict');
      logger.warn('Conflicts detected, manual resolution may be required', {
        conflicts: conflictItems.map(item => ({
          id: item.id,
          path: item.localPath,
        })),
      });
    }

    // Handle failures
    if (result.failed > 0) {
      const failedItems = result.items.filter(item => item.syncStatus === 'error');
      logger.error('Some files failed to sync', {
        failures: failedItems.map(item => ({
          id: item.id,
          path: item.localPath,
          error: item.errorMessage,
        })),
      });
    }
  } finally {
    syncManager.stopAutoSync();
    await syncManager.cleanup();
  }
}

/**
 * Example: Sync a specific file
 */
export async function syncSpecificFile(filePath: string): Promise<void> {
  const syncManager = await initializeSyncManager();

  try {
    logger.info('Syncing specific file', { filePath });
    
    const item = await syncManager.syncFile(filePath);
    
    logger.info('File sync completed', {
      id: item.id,
      status: item.syncStatus,
      blobId: item.blobId,
    });

    if (item.syncStatus === 'error') {
      logger.error('File sync failed', {
        error: item.errorMessage,
      });
    }
  } finally {
    await syncManager.cleanup();
  }
}

/**
 * Example: Download a file from Walrus
 */
export async function downloadFile(blobId: string, targetPath: string): Promise<void> {
  const syncManager = await initializeSyncManager();

  try {
    logger.info('Downloading file from Walrus', { blobId, targetPath });
    
    await syncManager.downloadFile(blobId, targetPath);
    
    logger.info('File downloaded successfully', { targetPath });
  } finally {
    await syncManager.cleanup();
  }
}

/**
 * Example: Check sync status of all files
 */
export async function checkSyncStatus(): Promise<void> {
  const syncManager = await initializeSyncManager();

  try {
    const metadata = syncManager.getAllSyncMetadata();
    
    logger.info('Sync status report', {
      totalFiles: metadata.length,
      synced: metadata.filter(item => item.syncStatus === 'synced').length,
      pending: metadata.filter(item => item.syncStatus === 'pending').length,
      conflicts: metadata.filter(item => item.syncStatus === 'conflict').length,
      errors: metadata.filter(item => item.syncStatus === 'error').length,
    });

    // Log details for each file
    metadata.forEach(item => {
      logger.debug('File sync status', {
        id: item.id,
        path: item.localPath,
        status: item.syncStatus,
        blobId: item.blobId,
        lastModified: item.lastModified,
        error: item.errorMessage,
      });
    });
  } finally {
    await syncManager.cleanup();
  }
}

/**
 * Example: Error handling and recovery
 */
export async function handleSyncErrors(): Promise<void> {
  const syncManager = await initializeSyncManager();

  try {
    // Get all files with errors
    const metadata = syncManager.getAllSyncMetadata();
    const errorFiles = metadata.filter(item => item.syncStatus === 'error');

    if (errorFiles.length === 0) {
      logger.info('No sync errors found');
      return;
    }

    logger.info('Found files with sync errors', { count: errorFiles.length });

    // Retry failed files
    for (const item of errorFiles) {
      try {
        logger.info('Retrying failed file', { id: item.id, path: item.localPath });
        
        const result = await syncManager.syncFile(item.localPath);
        
        if (result.syncStatus === 'synced') {
          logger.info('File sync retry successful', { id: item.id });
        } else {
          logger.error('File sync retry failed', {
            id: item.id,
            status: result.syncStatus,
            error: result.errorMessage,
          });
        }
      } catch (error) {
        logger.error('Failed to retry file sync', {
          id: item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  } finally {
    await syncManager.cleanup();
  }
}