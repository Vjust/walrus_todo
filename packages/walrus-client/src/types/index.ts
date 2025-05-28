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