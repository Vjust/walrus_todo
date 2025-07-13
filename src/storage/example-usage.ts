/**
 * Example usage of the Walrus CLI storage and sync functionality
 * This file demonstrates how to integrate the new CLI-based storage layer
 */

import { WalrusClient } from './walrus';
import { SyncManager } from './sync';
import { FileCache } from './cache';
import { PersistentTodoStore } from './persistence';
import { getConfig, getDataPath } from '../config/manager';
import { logger } from '../utils/logger';

async function example() {
  // Get configuration
  const config = await getConfig();
  
  // Initialize cache
  const cache = new FileCache({
    baseDir: '~/.waltodo/cache',
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    version: '1.0.0'
  });

  await cache.initialize();

  // Initialize Walrus client with CLI support
  const walrusClient = new WalrusClient({
    cliPath: config.walrus.cliPath, // Use configured CLI path
    aggregatorUrl: config.walrus.aggregatorUrl,
    publisherUrl: config.walrus.publisherUrl,
    timeout: config.walrus.timeout,
    maxRetries: config.walrus.maxRetries
  });

  // Test CLI connectivity
  try {
    const version = await walrusClient.getVersion();
    logger.info('Walrus CLI version:', version);
  } catch (error) {
    logger.warn('Walrus CLI not available, working in offline mode:', error);
  }

  // Initialize sync manager
  const syncManager = new SyncManager({
    localCachePath: getDataPath(),
    walrusClient,
    conflictStrategy: config.sync.conflictStrategy || 'last-write-wins',
    batchSize: config.sync.batchSize || 10,
    autoSyncInterval: config.sync.syncInterval,
  });

  // Set up sync event listeners
  syncManager.on('sync:start', () => logger.info('Sync started'));
  syncManager.on('sync:complete', (result) => {
    logger.info('Sync completed', {
      successful: result.successful,
      failed: result.failed,
      conflicts: result.conflicts,
    });
  });
  syncManager.on('sync:error', (error) => logger.error('Sync error:', error));

  await syncManager.initialize();

  // Create persistent todo store
  const todoStore = new PersistentTodoStore({
    cache,
    walrusClient,
    conflictResolution: 'merge',
    syncInterval: 5 * 60 * 1000, // Sync every 5 minutes
    schemaVersion: 1
  });

  await todoStore.initialize();

  // Add a todo (works offline)
  const newTodo = await todoStore.add({
    description: 'Complete the Walrus CLI implementation',
    priority: 'high',
    status: 'pending',
    tags: ['development', 'storage', 'walrus']
  });

  console.log('Created todo:', newTodo);

  // Get all todos
  const todos = await todoStore.getAll();
  console.log('All todos:', todos);

  // Check if we're offline
  const isOffline = await todoStore.isOffline();
  console.log('Offline mode:', isOffline);

  // Get sync status
  const syncStatus = await todoStore.getSyncStatus();
  console.log('Sync status:', syncStatus);

  // Force sync (if online)
  if (!isOffline) {
    await todoStore.forceSync();
    console.log('Sync completed');
  }

  // Update a todo
  const updatedTodo = await todoStore.update(newTodo.id, {
    status: 'done'
  });
  console.log('Updated todo:', updatedTodo);

  // Cache operations
  // Set some arbitrary data in cache
  await cache.set('user-preferences', {
    theme: 'dark',
    notifications: true
  }, 7 * 24 * 60 * 60 * 1000); // 7 days TTL

  // Get cached data
  const preferences = await cache.get('user-preferences');
  console.log('Cached preferences:', preferences);

  // Cache stats
  const stats = await cache.stats();
  console.log('Cache statistics:', stats);

  // Export data
  const exportedData = await todoStore.export();
  console.log('Exported data:', exportedData);

  // Demonstrate Walrus CLI operations
  try {
    // Store data directly with Walrus CLI
    const testData = 'Hello from Walrus CLI integration!';
    const storeResponse = await walrusClient.store(testData);
    console.log('Stored data in Walrus:', storeResponse);

    // Retrieve the data
    const retrievedData = await walrusClient.retrieve(storeResponse.blobId);
    console.log('Retrieved data:', retrievedData);

    // Check if blob exists
    const exists = await walrusClient.exists(storeResponse.blobId);
    console.log('Blob exists:', exists);
  } catch (error) {
    console.log('Walrus CLI operations failed (offline mode):', error);
  }

  // Demonstrate sync manager operations
  if (config.sync.autoSync) {
    // Start auto-sync
    await syncManager.startAutoSync();
    console.log('Auto-sync started');

    // Perform manual sync
    const syncResult = await syncManager.sync();
    console.log('Manual sync result:', syncResult);

    // Check sync status
    const metadata = syncManager.getAllSyncMetadata();
    console.log('Sync metadata:', metadata);
  }

  // Stop auto-sync when done
  todoStore.stopAutoSync();
  syncManager.stopAutoSync();
  
  // Cleanup
  await walrusClient.cleanup();
  await syncManager.cleanup();
}

// Run example
if (require.main === module) {
  example().catch(console.error);
}