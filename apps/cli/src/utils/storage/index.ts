/**
 * @fileoverview Storage Module - Consolidated storage utilities index
 *
 * This module exports the unified storage interface and implementations,
 * providing a clean, consistent API for all storage operations across the application.
 */

// Core interfaces and types
export type { IStorage } from './core/IStorage';
export type {
  StorageConfig,
  StorageInfo,
  StorageUsage,
  StorageOptimizationResult,
  StorageOperationOptions,
  ContentMetadata,
  VerificationResult,
} from './core/StorageTypes';

// Base classes
export { AbstractStorage } from './core/AbstractStorage';
export { StorageClient } from './core/StorageClient';
export { StorageTransaction } from './core/StorageTransaction';
export type { TransactionOperation } from './core/StorageTransaction';

// Utility classes
export { StorageOperationHandler } from './utils/StorageOperationHandler';
export { StorageReuseAnalyzer } from './utils/StorageReuseAnalyzer';

// Storage implementations
export { BlobStorage } from './implementations/BlobStorage';
export { TodoStorage } from './implementations/TodoStorage';
export { ImageStorage } from './implementations/ImageStorage';
export { NFTStorage } from './implementations/NFTStorage';
export type {
  NFTStorageConfig,
  NFTMetadata,
  NFTInfo,
} from './implementations/NFTStorage';

// Import implementations for factory function
import { TodoStorage } from './implementations/TodoStorage';
import { ImageStorage } from './implementations/ImageStorage';
import { NFTStorage } from './implementations/NFTStorage';
import { BlobStorage } from './implementations/BlobStorage';

// Factory function to create the appropriate storage implementation
export function createStorage(
  type: 'todo' | 'image' | 'blob' | 'nft',
  address: string,
  config?:
    | Partial<import('./core/StorageTypes').StorageConfig>
    | Partial<import('./implementations/NFTStorage').NFTStorageConfig>
): import('./core/IStorage').IStorage {
  switch (type) {
    case 'todo':
      return new TodoStorage(address, config);
    case 'image':
      return new ImageStorage(address, config);
    case 'nft':
      if (!config || !('packageId' in config)) {
        throw new Error('NFT storage requires packageId in config');
      }
      return new NFTStorage(address, config.packageId as string, config);
    case 'blob':
    default:
      return new BlobStorage(address, config);
  }
}

// Default configuration
export const DEFAULT_STORAGE_CONFIG: import('./core/StorageTypes').StorageConfig =
  {
    minWalBalance: BigInt(100),
    storageBuffer: BigInt(10240),
    defaultEpochDuration: 52,
    minEpochBuffer: 10,
    enableOptimization: true,
    useMockMode: false,
    maxRetries: 3,
    retryBaseDelay: 1000,
    maxContentSize: 10 * 1024 * 1024, // 10MB
    networkUrl: 'https://fullnode?.testnet?.sui.io:443',
    networkEnvironment: 'testnet',
  };
