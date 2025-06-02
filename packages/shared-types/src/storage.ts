/**
 * Storage location types
 */
export enum StorageLocation {
  LOCAL = 'local',
  WALRUS = 'walrus',
  BLOCKCHAIN = 'blockchain'
}

/**
 * Storage provider configuration
 */
export interface StorageConfig {
  local?: LocalStorageConfig;
  walrus?: WalrusStorageConfig;
  blockchain?: BlockchainStorageConfig;
}

export interface LocalStorageConfig {
  basePath: string;
  maxSizeMB?: number;
}

export interface WalrusStorageConfig {
  aggregatorUrl: string;
  publisherUrl: string;
  maxBlobSizeMB?: number;
  defaultEpochs?: number;
}

export interface BlockchainStorageConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  packageId: string;
  gasLimit?: bigint;
}

/**
 * Walrus blob information
 */
export interface WalrusBlob {
  blobId: string;
  size: number;
  encodingType: 'Replication' | 'Erasure';
  contentType?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  expiresAt?: string;
}

/**
 * Walrus store response
 */
export interface WalrusStoreResponse {
  event: {
    blobId: string;
    size: number;
    encodingType: 'Replication' | 'Erasure';
    cost: number;
    deletable: boolean;
  };
  metadata?: Record<string, string>;
}

/**
 * Storage operation results
 */
export interface StorageOperationResult {
  success: boolean;
  location: StorageLocation;
  identifier: string; // Could be file path, blob ID, or transaction ID
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Storage statistics
 */
export interface StorageStats {
  location: StorageLocation;
  totalItems: number;
  totalSizeBytes: number;
  oldestItem?: Date;
  newestItem?: Date;
}

/**
 * Batch storage operations
 */
export interface BatchStorageOperation {
  items: Array<{
    id: string;
    data: any;
    metadata?: Record<string, string>;
  }>;
  targetLocation: StorageLocation;
  options?: BatchStorageOptions;
}

export interface BatchStorageOptions {
  parallelism?: number;
  continueOnError?: boolean;
  progressCallback?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem?: string;
}

export interface BatchStorageResult {
  successful: StorageOperationResult[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

/**
 * Storage migration types
 */
export interface StorageMigration {
  fromLocation: StorageLocation;
  toLocation: StorageLocation;
  itemIds?: string[];
  options?: MigrationOptions;
}

export interface MigrationOptions {
  deleteFromSource?: boolean;
  overwriteExisting?: boolean;
  batchSize?: number;
}

/**
 * Storage reuse optimization
 */
export interface StorageReuseEntry {
  contentHash: string;
  blobId: string;
  size: number;
  referenceCount: number;
  lastUsed: Date;
}

export interface StorageOptimizationResult {
  originalSize: number;
  optimizedSize: number;
  savedBytes: number;
  savedPercentage: number;
  reusedBlobs: number;
}

/**
 * File upload types
 */
export interface FileUpload {
  name: string;
  size: number;
  type: string;
  content: Buffer | ArrayBuffer | string;
  metadata?: Record<string, string>;
}

export interface ImageUpload extends FileUpload {
  width?: number;
  height?: number;
  format?: 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp';
}

/**
 * Cache types
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: Date;
  expiresAt?: Date;
  hits: number;
}

export interface CacheStats {
  entries: number;
  sizeBytes: number;
  hitRate: number;
  missRate: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}