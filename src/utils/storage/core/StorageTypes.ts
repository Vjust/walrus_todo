/**
 * @fileoverview Core Storage Types - Defines types and interfaces for the storage system
 *
 * This module defines common types used throughout the storage system, including
 * configuration options, metrics, and results from various operations. These types
 * provide strong typing for storage operations and ensure consistency across
 * different implementations.
 */

/**
 * Storage configuration options
 */
export interface StorageConfig {
  /** Minimum balance required for storage operations (in WAL tokens) */
  minWalBalance: bigint;
  
  /** Buffer space to add to all storage allocations */
  storageBuffer: bigint;
  
  /** Default number of epochs for storage duration */
  defaultEpochDuration: number;
  
  /** Minimum number of epochs that must remain before storage is considered usable */
  minEpochBuffer: number;
  
  /** Whether to use storage optimization strategies */
  enableOptimization: boolean;
  
  /** Whether to use mock mode for testing */
  useMockMode: boolean;
  
  /** Maximum number of retries for storage operations */
  maxRetries: number;
  
  /** Base delay in ms between retries */
  retryBaseDelay: number;
  
  /** Maximum size in bytes for a single storage entity */
  maxContentSize: number;
  
  /** Network URL for the blockchain */
  networkUrl: string;
  
  /** Network environment (testnet, mainnet, etc.) */
  networkEnvironment: 'testnet' | 'mainnet' | 'devnet' | 'localnet';
}

/**
 * Information about a storage allocation
 */
export interface StorageInfo {
  /** Unique identifier for the storage */
  id: string;
  
  /** Total size of the storage allocation in bytes */
  totalSize: number;
  
  /** Currently used size in bytes */
  usedSize: number;
  
  /** Epoch when the storage allocation expires */
  endEpoch: number;
  
  /** Epoch when the storage allocation began */
  startEpoch: number;
  
  /** Remaining available bytes in this storage */
  remainingBytes: number;
  
  /** Whether the storage is active (not expired) */
  isActive: boolean;
}

/**
 * Storage usage statistics
 */
export interface StorageUsage {
  /** Total storage space allocated across all objects */
  totalAllocated: number;
  
  /** Total storage space currently in use */
  totalUsed: number;
  
  /** Total available storage space */
  totalAvailable: number;
  
  /** Count of active storage objects */
  activeStorageCount: number;
  
  /** Count of inactive/expired storage objects */
  inactiveStorageCount: number;
  
  /** Percentage of total storage being used */
  usagePercentage: number;
  
  /** Detailed information about each storage object */
  storageObjects: StorageInfo[];
}

/**
 * Results from storage optimization operations
 */
export interface StorageOptimizationResult {
  /** Whether optimization was successful */
  success: boolean;
  
  /** Best storage object to use for future operations */
  recommendedStorage: StorageInfo | null;
  
  /** Type of recommendation for storage usage */
  recommendation: 'use-existing' | 'allocate-new' | 'extend-existing';
  
  /** Potential WAL token savings from optimization */
  potentialSavings: bigint;
  
  /** Percentage of potential savings */
  savingsPercentage: number;
  
  /** Human-readable recommendation */
  recommendationDetails: string;
}

/**
 * Result of blob verification
 */
export interface VerificationResult {
  /** Whether verification was successful */
  success: boolean;
  
  /** Whether the content was certified as matching */
  certified: boolean;
  
  /** Calculated checksum of the content */
  checksum?: string;
  
  /** Any additional details about the verification */
  details?: Record<string, any>;
}

/**
 * Storage operation options
 */
export interface StorageOperationOptions {
  /** Maximum number of retries for this operation */
  maxRetries?: number;
  
  /** Custom timeout for this operation in milliseconds */
  timeout?: number;
  
  /** AbortSignal for cancelling the operation */
  signal?: AbortSignal;
  
  /** Whether to throw errors or return them in the result */
  throwErrors?: boolean;
  
  /** Operation-specific context for error messages */
  context?: string;
  
  /** Whether to use fallback retrieval methods */
  useFallbacks?: boolean;
}

/**
 * Content metadata for storage
 */
export interface ContentMetadata {
  /** Content type for the stored data */
  contentType: string;
  
  /** Optional filename */
  filename?: string;
  
  /** Type of content (todo, image, etc.) */
  contentCategory: string;
  
  /** Checksum algorithm used */
  checksumAlgorithm: string;
  
  /** Content checksum */
  checksum: string;
  
  /** Size in bytes */
  size: string;
  
  /** Schema version */
  schemaVersion: string;
  
  /** Encoding used */
  encoding: string;
  
  /** Additional custom metadata */
  [key: string]: string;
}