/**
 * Example usage of Walrus storage integration and sync manager
 * This demonstrates how to use the WalrusClient and SyncManager together
 */

import { WalrusClient } from './walrus';
import { SyncManager } from './sync';
import { getDataPath } from '../config/manager';
import { logger } from '../utils/logger';
import path from 'path';

async function demonstrateWalrusIntegration() {
  logger.info('Starting Walrus storage integration demonstration');

  // Initialize Walrus client
  const walrusClient = new WalrusClient({
    cliPath: 'walrus', // Assumes walrus CLI is in PATH
    timeout: 30000,
    maxRetries: 3,
  });

  // Get version to verify CLI is working
  try {
    const version = await walrusClient.getVersion();
    logger.info('Walrus CLI version:', version);
  } catch (error) {
    logger.error('Failed to get Walrus CLI version - make sure it is installed and in PATH');
    return;
  }

  // Initialize sync manager
  const syncManager = new SyncManager({
    localCachePath: path.join(getDataPath(), 'cache'),
    walrusClient,
    conflictStrategy: 'last-write-wins',
    batchSize: 5,
    autoSyncInterval: 60, // 1 minute for demo
    maxRetries: 3,
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

  syncManager.on('sync:item:start', (item) => {
    logger.debug('Syncing item:', item.id);
  });

  syncManager.on('sync:item:complete', (item) => {
    logger.debug('Item synced:', { id: item.id, status: item.syncStatus });
  });

  syncManager.on('sync:conflict', (item, strategy) => {
    logger.warn('Conflict detected:', { id: item.id, strategy });
  });

  try {
    // Initialize sync manager
    await syncManager.initialize();
    logger.info('Sync manager initialized');

    // Demonstrate basic Walrus operations
    logger.info('--- Testing basic Walrus operations ---');

    // Store some test data
    const testData = 'Hello from Waltodo! This is a test blob.';
    logger.info('Storing test data in Walrus...');
    const storeResult = await walrusClient.store(testData);
    logger.info('Data stored successfully', {
      blobId: storeResult.blobId,
      size: storeResult.size,
      cost: storeResult.cost,
    });

    // Retrieve the data
    logger.info('Retrieving data from Walrus...');
    const retrievedData = await walrusClient.retrieve(storeResult.blobId);
    logger.info('Data retrieved successfully', {
      matches: retrievedData === testData,
      length: retrievedData.length,
    });

    // Check if blob exists
    const exists = await walrusClient.exists(storeResult.blobId);
    logger.info('Blob existence check:', { exists });

    // Demonstrate sync functionality
    logger.info('--- Testing sync functionality ---');

    // Perform a manual sync
    const syncResult = await syncManager.sync();
    logger.info('Manual sync completed', syncResult);

    // Get sync status
    const allMetadata = syncManager.getAllSyncMetadata();
    logger.info('Current sync metadata:', { count: allMetadata.length });

    // Start auto-sync (this would normally run in the background)
    await syncManager.startAutoSync();
    logger.info('Auto-sync started');

    // Wait a bit to see auto-sync in action (optional)
    logger.info('Waiting 5 seconds to demonstrate auto-sync...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Clean up the test blob
    logger.info('Cleaning up test blob...');
    await walrusClient.delete(storeResult.blobId);
    logger.info('Test blob deleted');

  } catch (error) {
    logger.error('Demonstration failed:', error);
  } finally {
    // Clean up
    logger.info('Cleaning up...');
    await syncManager.cleanup();
    await walrusClient.cleanup();
    logger.info('Demonstration completed');
  }
}

// Run the demonstration if this file is executed directly
if (import.meta.url.endsWith(process.argv[1])) {
  demonstrateWalrusIntegration().catch(console.error);
}

export { demonstrateWalrusIntegration };