/**
 * WalrusClientAdapter
 * 
 * This adapter reconciles differences between WalrusClient interface versions
 * from @mysten/walrus library and custom interfaces defined in the project.
 * 
 * It provides a consistent interface that can be used by both mock implementations
 * and actual code without worrying about interface compatibility issues.
 */

import {
  type WalrusClient as OriginalWalrusClient,
  type WriteBlobOptions,
  type StorageWithSizeOptions,
  type RegisterBlobOptions,
  type DeleteBlobOptions,
  type CertifyBlobOptions,
  type WriteBlobAttributesOptions,
  type GetStorageConfirmationOptions,
  type ReadBlobOptions
} from '@mysten/walrus';
import { type WalrusClient, type WalrusClientExt } from '../client';
import { Transaction, TransactionType } from '../transaction';
import { Signer } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlockAdapter } from './TransactionBlockAdapter';
import { SignerAdapter } from './SignerAdapter';

/**
 * Client version enum for better version handling
 */
export enum WalrusClientVersion {
  ORIGINAL = 'original', // Base WalrusClient from SDK
  CUSTOM = 'custom',     // Project's WalrusClient interface
  EXTENDED = 'extended'  // Project's WalrusClientExt interface
}

/**
 * Error class for WalrusClientAdapter operations
 */
export class WalrusClientAdapterError extends Error {
  constructor(message: string) {
    super(`WalrusClientAdapter Error: ${message}`);
    this.name = 'WalrusClientAdapterError';
  }
}

/**
 * Normalized blob object type that works with different library versions
 * This ensures consistent property access across different versions
 */
export interface NormalizedBlobObject {
  blob_id: string;
  id?: { id: string };
  registered_epoch?: number;
  storage_cost?: {
    value: string;
  };
  metadata?: Record<string, any>;
  deletable?: boolean;
  size?: number | string;
}

/**
 * Normalized write blob response that works with different library return types
 */
export interface NormalizedWriteBlobResponse {
  blobId: string;
  blobObject: NormalizedBlobObject;
  digest?: string;
}

/**
 * Common options for all adapter methods that handle transactions and signers
 */
export interface AdapterOptions {
  transaction?: TransactionType;
  signer?: Signer | Ed25519Keypair | SignerAdapter;
}

/**
 * Unified WalrusClient interface that combines functionality from multiple interfaces
 */
export interface UnifiedWalrusClient {
  /**
   * Gets information about a blob
   */
  getBlobInfo(blobId: string): Promise<NormalizedBlobObject>;
  
  /**
   * Reads a blob's content
   */
  readBlob(options: ReadBlobOptions): Promise<Uint8Array>;
  
  /**
   * Writes a blob to Walrus storage
   * The blobId property is required in the response, not optional
   */
  writeBlob(options: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionType;
  }): Promise<{
    blobId: string; // Not optional
    blobObject: NormalizedBlobObject;
  }>;
  
  /**
   * Gets the configuration
   */
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  
  /**
   * Gets the WAL balance
   */
  getWalBalance(): Promise<string>;
  
  /**
   * Gets storage usage
   */
  getStorageUsage(): Promise<{ used: string; total: string }>;
  
  /**
   * Gets blob metadata
   */
  getBlobMetadata(options: ReadBlobOptions): Promise<any>;
  
  /**
   * Verifies proof of availability
   */
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  
  /**
   * Gets the blob object
   */
  getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject>;
  
  /**
   * Gets storage cost for given size and epochs
   */
  storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }>;

  /**
   * Gets blob size (extended functionality)
   */
  getBlobSize?(blobId: string): Promise<number>;

  /**
   * Gets storage providers (extended functionality)
   */
  getStorageProviders?(params: { blobId: string }): Promise<string[]>;

  /**
   * Resets the client (extended functionality)
   */
  reset?(): void;

  /**
   * Transaction-related methods
   */
  executeCertifyBlobTransaction?(
    options: CertifyBlobOptions & AdapterOptions
  ): Promise<{ digest: string }>;

  executeWriteBlobAttributesTransaction?(
    options: WriteBlobAttributesOptions & AdapterOptions
  ): Promise<{ digest: string }>;

  executeRegisterBlobTransaction?(
    options: RegisterBlobOptions & AdapterOptions
  ): Promise<{ 
    blob: NormalizedBlobObject;
    digest: string; 
  }>;

  executeCreateStorageTransaction?(
    options: StorageWithSizeOptions & { 
      transaction?: TransactionType; 
      signer: Signer | Ed25519Keypair | SignerAdapter 
    }
  ): Promise<{ 
    digest: string; 
    storage: { 
      id: { id: string }; 
      start_epoch: number; 
      end_epoch: number; 
      storage_size: string; 
    } 
  }>;

  deleteBlob?(options: DeleteBlobOptions): (tx: TransactionType) => Promise<{ digest: string }>;

  getStorageConfirmationFromNode?(
    options: GetStorageConfirmationOptions
  ): Promise<{ primary_verification: boolean; secondary_verification?: boolean; provider: string; signature?: string }>;

  createStorageBlock?(size: number, epochs: number): Promise<TransactionType>;

  createStorage?(
    options: StorageWithSizeOptions
  ): (tx: TransactionType) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }>;

  /**
   * Experimental methods
   */
  experimental?: {
    getBlobData: () => Promise<any>;
  };

  /**
   * Gets the client version
   */
  getClientVersion(): WalrusClientVersion;

  /**
   * Gets the underlying WalrusClient implementation
   */
  getUnderlyingClient(): OriginalWalrusClient | WalrusClient | WalrusClientExt;
}

/**
 * WalrusClientAdapter interface (extends the unified interface)
 */
export interface WalrusClientAdapter extends UnifiedWalrusClient {
  /**
   * Abort all pending operations
   * This is used for cleanup during disconnection or cancellation
   */
  abort?(): Promise<void>;

  /**
   * Close all connections and release resources
   * This is called when the client is no longer needed
   */
  close?(): Promise<void>;
}

/**
 * Type guard to check if an object implements the original WalrusClient interface
 */
export function isOriginalWalrusClient(client: any): client is OriginalWalrusClient {
  return client && 
         typeof client === 'object' &&
         typeof client.getBlobInfo === 'function' &&
         typeof client.readBlob === 'function' &&
         typeof client.writeBlob === 'function' &&
         typeof client.getConfig === 'function' &&
         typeof client.getWalBalance === 'function' &&
         typeof client.getStorageUsage === 'function';
}

/**
 * Type guard to check if an object implements the WalrusClient interface
 */
export function isWalrusClient(client: any): client is WalrusClient {
  return isOriginalWalrusClient(client) &&
         typeof client.getBlobObject === 'function' &&
         typeof client.verifyPoA === 'function';
}

/**
 * Type guard to check if an object implements the WalrusClientExt interface
 */
export function isWalrusClientExt(client: any): client is WalrusClientExt {
  return isWalrusClient(client) &&
         typeof client.getBlobSize === 'function';
}

/**
 * Abstract base adapter implementation that provides common functionality
 */
export abstract class BaseWalrusClientAdapter implements WalrusClientAdapter {
  protected walrusClient: any;
  protected clientVersion: WalrusClientVersion;
  
  constructor(walrusClient: any) {
    if (!walrusClient) {
      throw new WalrusClientAdapterError('Cannot initialize WalrusClientAdapter with null or undefined client');
    }
    this.walrusClient = walrusClient;
    this.clientVersion = this.detectClientVersion(walrusClient);
  }
  
  /**
   * Gets the underlying WalrusClient implementation
   */
  public getUnderlyingClient(): any {
    return this.walrusClient;
  }
  
  /**
   * Gets the current client version
   */
  public getClientVersion(): WalrusClientVersion {
    return this.clientVersion;
  }
  
  /**
   * Detects the client version based on available methods
   */
  protected detectClientVersion(client: any): WalrusClientVersion {
    if (!client) {
      throw new WalrusClientAdapterError('Cannot detect version of null or undefined client');
    }
    
    // Check for V3 (extended) methods
    if (isWalrusClientExt(client)) {
      return WalrusClientVersion.EXTENDED;
    }
    
    // Check for V2 (custom) methods
    if (isWalrusClient(client)) {
      return WalrusClientVersion.CUSTOM;
    }
    
    // Default to V1 (original)
    if (isOriginalWalrusClient(client)) {
      return WalrusClientVersion.ORIGINAL;
    }
    
    // If types don't match exactly, use method detection as a fallback
    if (('getBlobSize' in client && typeof client.getBlobSize === 'function') ||
        ('experimental' in client && client.experimental)) {
      return WalrusClientVersion.EXTENDED;
    }
    
    if (('getBlobObject' in client && typeof client.getBlobObject === 'function') &&
        ('verifyPoA' in client && typeof client.verifyPoA === 'function')) {
      return WalrusClientVersion.CUSTOM;
    }
    
    // Default to original as the base version
    return WalrusClientVersion.ORIGINAL;
  }
  
  /**
   * Ensures the client is initialized before using it
   */
  protected ensureClientInitialized(): void {
    if (!this.walrusClient) {
      throw new WalrusClientAdapterError('WalrusClient not initialized');
    }
  }
  
  /**
   * Helper to safely convert various types to bigint
   */
  protected toBigInt(value: any): bigint {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value === 'number') {
      return BigInt(value);
    }

    if (typeof value === 'string') {
      try {
        return BigInt(value);
      } catch (e) {
        throw new WalrusClientAdapterError(`Cannot convert string to bigint: ${value}`);
      }
    }

    // Proper type guard to check if value is an object and has toString method
    if (value !== null &&
        typeof value === 'object' &&
        'toString' in value &&
        typeof value.toString === 'function') {
      try {
        return BigInt(value.toString());
      } catch (e) {
        throw new WalrusClientAdapterError(`Cannot convert value to bigint: ${value}`);
      }
    }

    throw new WalrusClientAdapterError(`Unsupported value type for bigint conversion: ${typeof value}`);
  }
  
  /**
   * Extracts the underlying transaction from a transaction adapter
   */
  protected extractTransaction(tx: TransactionType): any {
    if (!tx) return undefined;
    
    if (typeof tx === 'object' && tx !== null) {
      // Check for adapter interfaces
      if ('getUnderlyingBlock' in tx && typeof tx.getUnderlyingBlock === 'function') {
        return tx.getUnderlyingBlock();
      }
      
      if ('getTransactionBlock' in tx && typeof tx.getTransactionBlock === 'function') {
        return tx.getTransactionBlock();
      }
      
      // Check if it's already a TransactionBlock
      if (tx.constructor && tx.constructor.name === 'TransactionBlock') {
        return tx;
      }
    }
    
    // Return as-is if no adapter methods found
    return tx;
  }
  
  /**
   * Extracts the underlying signer from a signer adapter
   */
  protected extractSigner(signer: Signer | Ed25519Keypair | SignerAdapter): any {
    if (!signer) return undefined;
    
    if (typeof signer === 'object' && signer !== null) {
      // Check for adapter interfaces
      if ('getUnderlyingSigner' in signer && typeof signer.getUnderlyingSigner === 'function') {
        return signer.getUnderlyingSigner();
      }
      
      if ('getSigner' in signer && typeof signer.getSigner === 'function') {
        return signer.getSigner();
      }
    }
    
    // Return as-is if no adapter methods found
    return signer;
  }
  
  /**
   * Extracts adapters from options object
   */
  protected extractAdapters<T extends Record<string, any>>(options: T): T {
    const result = { ...options } as T & {
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    };

    // Use explicit type checking instead of property access to avoid type errors
    if (result && typeof result === 'object' && 'transaction' in result && result.transaction) {
      // Extract the transaction object from the adapter
      result.transaction = this.extractTransaction(result.transaction as TransactionType);
    }

    if (result && typeof result === 'object' && 'signer' in result && result.signer) {
      // Extract the signer object from the adapter
      result.signer = this.extractSigner(result.signer as Signer | Ed25519Keypair | SignerAdapter);
    }

    return result;
  }
  
  /**
   * Normalizes a blob object to ensure consistent structure
   */
  protected normalizeBlobObject(blob: any): NormalizedBlobObject {
    if (!blob) {
      return {
        blob_id: '',
        deletable: false
      };
    }
    
    // Handle different object structures
    const normalizedBlob: NormalizedBlobObject = {
      blob_id: '',
      id: undefined,
      registered_epoch: 0,
      storage_cost: { value: '0' },
      metadata: {},
      deletable: false,
      size: 0
    };
    
    // Extract blob_id with proper type checking
    if (typeof blob.blob_id === 'string') {
      normalizedBlob.blob_id = blob.blob_id;
    } else if (blob.id && typeof blob.id === 'object' && typeof blob.id.id === 'string') {
      normalizedBlob.blob_id = blob.id.id;
    }
    
    // Extract id
    if (blob.id && typeof blob.id === 'object') {
      normalizedBlob.id = blob.id;
    } else if (typeof blob.blob_id === 'string') {
      normalizedBlob.id = { id: blob.blob_id };
    }
    
    // Extract other properties with proper type checking
    if (typeof blob.registered_epoch === 'number') {
      normalizedBlob.registered_epoch = blob.registered_epoch;
    } else if (typeof blob.registered_epoch === 'string') {
      normalizedBlob.registered_epoch = parseInt(blob.registered_epoch, 10);
    }
    
    if (blob.storage_cost && typeof blob.storage_cost === 'object') {
      normalizedBlob.storage_cost = blob.storage_cost;
    }
    
    if (blob.metadata && typeof blob.metadata === 'object') {
      normalizedBlob.metadata = blob.metadata;
    }
    
    normalizedBlob.deletable = Boolean(blob.deletable);
    
    // Extract size
    if (typeof blob.size === 'number') {
      normalizedBlob.size = blob.size;
    } else if (typeof blob.size === 'string') {
      normalizedBlob.size = parseInt(blob.size, 10);
    }
    
    return normalizedBlob;
  }
  
  /**
   * Normalizes a write blob response to ensure consistent structure
   */
  protected normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
    if (!response) {
      throw new WalrusClientAdapterError('Empty response from writeBlob operation');
    }
    
    // Extract blobId from various possible locations with proper type checking
    let blobId = '';
    
    if (typeof response === 'string') {
      blobId = response;
    } else if (typeof response.blobId === 'string') {
      blobId = response.blobId;
    } else if (response.blobObject && typeof response.blobObject.blob_id === 'string') {
      blobId = response.blobObject.blob_id;
    } else if (typeof response.blob_id === 'string') {
      blobId = response.blob_id;
    } else if (response.blobObject && response.blobObject.id && 
              typeof response.blobObject.id === 'object' && 
              typeof response.blobObject.id.id === 'string') {
      blobId = response.blobObject.id.id;
    }
    
    if (!blobId) {
      throw new WalrusClientAdapterError('Could not extract blobId from writeBlob response');
    }
    
    // Prepare the normalized blob object
    let blobObject: NormalizedBlobObject;
    
    if (response.blobObject) {
      blobObject = this.normalizeBlobObject(response.blobObject);
    } else {
      blobObject = { blob_id: blobId, deletable: false };
    }
    
    return {
      blobId,
      blobObject,
      digest: typeof response.digest === 'string' ? response.digest : ''
    };
  }

  // Abstract methods that need to be implemented by version-specific adapters
  abstract getBlobInfo(blobId: string): Promise<NormalizedBlobObject>;
  abstract readBlob(options: ReadBlobOptions): Promise<Uint8Array>;
  abstract writeBlob(options: any): Promise<{ blobId: string; blobObject: NormalizedBlobObject }>;
  abstract getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  abstract getWalBalance(): Promise<string>;
  abstract getStorageUsage(): Promise<{ used: string; total: string }>;
  abstract getBlobMetadata(options: ReadBlobOptions): Promise<any>;
  abstract verifyPoA(params: { blobId: string }): Promise<boolean>;
  abstract getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject>;
  abstract storageCost(size: number, epochs: number): Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>;
}

/**
 * Factory function to create a WalrusClientAdapter instance
 * This function should be imported from the implementation file
 */
export function createWalrusClientAdapter(
  client: OriginalWalrusClient | WalrusClient | WalrusClientExt | any
): WalrusClientAdapter {
  // This is just a placeholder - the actual implementation will be in walrus-client-adapter.ts
  throw new Error('Implementation moved to walrus-client-adapter.ts');
}