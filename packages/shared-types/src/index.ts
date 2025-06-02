/**
 * @waltodo/shared-types
 * 
 * Shared type definitions for WalTodo CLI and frontend applications
 */

// Export all todo types
export type * from './todo';

// API types removed - using blockchain-first architecture

// Export all blockchain types except the ones we need to handle separately
export type {
  Network,
  SuiAddress,
  SuiTransaction,
  SuiObject,
  TodoNFT,
  AICredential,
  AIOperationVerifier,
  ContractAddresses,
  TransactionArgument,
  MoveCall,
  WalletAccount,
  WalletCapabilities,
  GasEstimate,
  TodoCompletedEvent,
  MoveModules,
  TransactionStatus
} from './blockchain';

// Export blockchain TodoCreatedEvent with a specific name
export type { TodoCreatedEvent as TodoCreatedBlockchainEvent } from './blockchain';

// Export all storage types - mix of types and enums
export type {
  StorageConfig,
  LocalStorageConfig,
  WalrusStorageConfig,
  BlockchainStorageConfig,
  WalrusBlob,
  WalrusStoreResponse,
  StorageOperationResult,
  StorageStats,
  BatchStorageOperation,
  BatchStorageOptions,
  BatchProgress,
  BatchStorageResult,
  StorageMigration,
  MigrationOptions,
  StorageReuseEntry,
  StorageOptimizationResult,
  FileUpload,
  ImageUpload,
  CacheEntry,
  CacheStats
} from './storage';
export { StorageLocation } from './storage';