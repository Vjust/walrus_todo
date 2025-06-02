/**
 * Type definitions for Walrus Client
 */

export type WalrusNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

export interface WalrusConfig {
  network: WalrusNetwork;
  publisherUrl: string;
  aggregatorUrl: string;
  timeout?: number;
  retries?: number;
  packageConfig?: {
    packageId: string;
    storage: string;
    blob: string;
  };
}

export interface WalrusUploadResponse {
  blobId: string;
  size: number;
  encodedSize: number;
  cost: number;
  transactionId?: string;
  explorerUrl?: string;
  expiresAt?: number;
}

export interface WalrusBlob {
  id: string;
  data: Uint8Array;
  contentType?: string;
  size?: number;
}

export interface WalrusUploadOptions {
  epochs?: number;
  deletable?: boolean;
  contentType?: string;
  attributes?: Record<string, unknown>;
  onProgress?: (message: string, progress: number) => void;
}

export interface WalrusStorageInfo {
  exists: boolean;
  size?: number;
  storageCost?: {
    total: bigint;
    storage: bigint;
    write: bigint;
  };
  expiresAt?: number;
}

export interface WalrusImageMetadata {
  width: number;
  height: number;
  mimeType: string;
  size: number;
  checksum: string;
}

export interface WalrusImageUploadOptions extends WalrusUploadOptions {
  imagePath?: string;
  imageFile?: File | Buffer;
  validateImage?: boolean;
  maxSize?: number;
  supportedFormats?: string[];
}

// Consolidated Todo interface from CLI implementation
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  private?: boolean;
  storageLocation?: 'local' | 'blockchain' | 'walrus';
  dueDate?: string;
  walrusBlobId?: string;
  suiObjectId?: string;
}

// Consolidated TodoList interface from CLI implementation
export interface TodoList {
  id: string;
  name: string;
  owner: string;
  todos: Todo[];
  version: number;
  createdAt: string;
  updatedAt: string;
  description?: string;
  isPrivate?: boolean;
  sharedWith?: string[];
}

export interface WalrusTodo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string;
  walrusBlobId?: string;
  suiObjectId?: string;
  blockchainStored: boolean;
  createdAt: number;
  updatedAt: number;
  owner?: string;
  storageEpochs?: number;
  storageSize?: number;
  isPrivate?: boolean;
}

export interface WalrusTodoUploadOptions extends WalrusUploadOptions {
  createNFT?: boolean;
  isPrivate?: boolean;
}

export interface WalrusTodoCreateResult {
  todo: WalrusTodo;
  walrusResult: WalrusUploadResponse;
  suiResult?: any;
  metadata: {
    walrusBlobId: string;
    suiObjectId?: string;
    storageSize: number;
    storageEpochs: number;
    storageCost: {
      total: bigint;
      storage: bigint;
      write: bigint;
    };
    uploadTimestamp: number;
    expiresAt?: number;
  };
}

export interface WalrusClientAdapter {
  // Core HTTP API methods
  getConfig(): Promise<WalrusConfig>;
  upload(data: Uint8Array | string, options?: WalrusUploadOptions): Promise<WalrusUploadResponse>;
  download(blobId: string): Promise<WalrusBlob>;
  exists(blobId: string): Promise<boolean>;
  delete(blobId: string, signer?: any): Promise<string>;
  getBlobInfo(blobId: string): Promise<{ size?: number }>;
  calculateStorageCost(size: number, epochs: number): Promise<{
    totalCost: bigint;
    storageCost: bigint;
    writeCost: bigint;
  }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;

  // Consolidated Todo-specific methods from CLI
  storeTodo(todo: Todo, epochs?: number): Promise<string>;
  storeList(list: TodoList, epochs?: number): Promise<string>;
  storeTodoList(list: TodoList, epochs?: number): Promise<string>;
  retrieveTodo(blobId: string): Promise<Todo>;
  retrieveList(blobId: string): Promise<TodoList>;
  updateTodo(blobId: string, todo: Todo, epochs?: number): Promise<string>;
  
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  checkConnection(): Promise<boolean>;
  getConnectionStatus(): boolean;
  
  // Enhanced storage operations
  storeTodoWithDetails(todo: Todo, epochs?: number): Promise<{
    blobId: string;
    transactionId?: string;
    explorerUrl?: string;
    aggregatorUrl?: string;
    networkInfo: {
      network: string;
      epochs: number;
    };
  }>;
  checkExistingStorage(): Promise<{
    id: { id: string };
    storage_size: string;
    used_size: string;
  } | null>;
  getActiveAddress(): Promise<string>;
  checkBalance(): Promise<number>;
}

// Runtime environment detection
export interface RuntimeEnvironment {
  isNode: boolean;
  isBrowser: boolean;
  hasFileSystem: boolean;
  hasProcess: boolean;
}

// Signer abstraction for cross-platform compatibility
export interface UniversalSigner {
  getAddress(): Promise<string> | string;
  toSuiAddress(): string;
  signData?(data: Uint8Array): Promise<{ signature: Uint8Array; publicKey: Uint8Array }>;
}

// Image upload options consolidated from image storage implementation
export interface ImageUploadOptions {
  imagePath?: string;
  file?: File;
  type?: 'todo-nft-image' | 'todo-nft-default-image';
  metadata?: {
    title?: string;
    completed?: boolean | string;
    [key: string]: unknown;
  };
  epochs?: number;
}

// Storage cost estimation
export interface StorageCostEstimate {
  totalCost: bigint;
  storageCost: bigint;
  writeCost: bigint;
  sizeBytes: number;
  epochs: number;
}

// Progress tracking
export interface ProgressCallback {
  (message: string, progress: number): void;
}