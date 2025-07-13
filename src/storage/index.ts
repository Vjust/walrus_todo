/**
 * Storage module exports
 * 
 * This module provides decentralized storage functionality using Walrus,
 * caching, synchronization, and persistence capabilities.
 */

// Walrus client and types
export {
  WalrusClient,
  WalrusStoreResponse,
  WalrusRetrieveOptions,
  WalrusConfig
} from './walrus.js';

// Walrus store implementation
export { WalrusStore } from './walrus-store.js';

// Persistence layer
export {
  PersistentTodoStore,
  StorageMetadata,
  TodoStoreData,
  ConflictResolution,
  PersistenceConfig
} from './persistence.js';

// Synchronization
export {
  SyncManager,
  SyncItem,
  SyncResult,
  ConflictStrategy,
  SyncManagerConfig,
  SyncManagerEvents
} from './sync.js';

// Caching
export {
  FileCache,
  CacheEntry,
  CacheConfig,
  cache
} from './cache.js';

// Integration examples and utilities
export {
  initializeWalrusClient,
  initializeSyncManager,
  storeData,
  retrieveData,
  performSync,
  syncSpecificFile,
  downloadFile,
  checkSyncStatus,
  handleSyncErrors
} from './example-integration.js';