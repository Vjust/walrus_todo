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
import { type WalrusClientExt } from '../client';
import { Transaction, TransactionType } from '../transaction';
import { Signer } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlockAdapter } from './TransactionBlockAdapter';
import { SignerAdapter } from './SignerAdapter';

/**
 * Normalized blob object type that works with different library versions
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
  getBlobObject(params: { blobId: string }): Promise<any>;
  
  /**
   * Gets storage cost for given size and epochs
   */
  storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }>;
}

/**
 * WalrusClientAdapter implements the UnifiedWalrusClient interface
 * and adapts different WalrusClient implementations
 */
export class WalrusClientAdapter implements UnifiedWalrusClient {
  private walrusClient: OriginalWalrusClient | Partial<WalrusClientExt>;
  
  constructor(walrusClient: OriginalWalrusClient | Partial<WalrusClientExt>) {
    this.walrusClient = walrusClient;
  }
  
  /**
   * Gets the underlying WalrusClient implementation
   */
  public getWalrusClient(): OriginalWalrusClient | Partial<WalrusClientExt> {
    return this.walrusClient;
  }
  
  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    const result = await this.walrusClient.getBlobInfo(blobId);
    // Normalize the blob info response to work with both interface versions
    return this.normalizeBlobObject(result);
  }
  
  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.readBlob(options);
  }
  
  /**
   * Gets blob metadata
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<any> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    if ('getBlobMetadata' in this.walrusClient && typeof this.walrusClient.getBlobMetadata === 'function') {
      return await this.walrusClient.getBlobMetadata(options);
    }
    
    throw new Error('getBlobMetadata not implemented in this client version');
  }
  
  /**
   * Gets the blob object
   */
  async getBlobObject(params: { blobId: string }): Promise<any> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.getBlobObject(params);
  }
  
  /**
   * Verifies proof of availability
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.verifyPoA(params);
  }
  
  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(options: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionType;
  }): Promise<{
    blobId: string;
    blobObject: NormalizedBlobObject;
  }> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    // Prepare the options by handling adapter types
    let adaptedOptions: any = { ...options };
    
    // Check if options contains transaction and signer properties that need adapter handling
    if ('transaction' in adaptedOptions && adaptedOptions.transaction) {
      if ('getUnderlyingBlock' in adaptedOptions.transaction || 'getTransactionBlock' in adaptedOptions.transaction) {
        // Extract the underlying transaction block
        const adapterMethod = 'getUnderlyingBlock' in adaptedOptions.transaction 
          ? 'getUnderlyingBlock' 
          : 'getTransactionBlock';
        adaptedOptions.transaction = adaptedOptions.transaction[adapterMethod]();
      }
    }
    
    if ('signer' in adaptedOptions && adaptedOptions.signer) {
      if ('getSigner' in adaptedOptions.signer || 'getUnderlyingSigner' in adaptedOptions.signer) {
        // Extract the underlying signer
        const adapterMethod = 'getSigner' in adaptedOptions.signer 
          ? 'getSigner' 
          : 'getUnderlyingSigner';
        adaptedOptions.signer = adaptedOptions.signer[adapterMethod]();
      }
    }
    
    // Call the actual writeBlob method
    const result = await this.walrusClient.writeBlob(adaptedOptions);
    
    // Normalize the response to ensure we always have a blobId
    const normalizedResult = this.normalizeWriteBlobResponse(result);
    
    return {
      blobId: normalizedResult.blobId,
      blobObject: normalizedResult.blobObject
    };
  }
  
  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.getConfig();
  }
  
  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.getWalBalance();
  }
  
  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    return await this.walrusClient.getStorageUsage();
  }
  
  /**
   * Gets storage cost for given size and epochs
   */
  async storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }> {
    if (!this.walrusClient) {
      throw new Error('WalrusClient not initialized');
    }
    
    if ('storageCost' in this.walrusClient && typeof this.walrusClient.storageCost === 'function') {
      return await this.walrusClient.storageCost(size, epochs);
    }
    
    // Provide a fallback implementation with sensible defaults
    return {
      storageCost: BigInt(0),
      writeCost: BigInt(0),
      totalCost: BigInt(0)
    };
  }
  
  /**
   * Normalizes a blob object to ensure consistent structure
   */
  private normalizeBlobObject(blob: any): NormalizedBlobObject {
    if (!blob) {
      return {
        blob_id: '',
        deletable: false
      };
    }
    
    // Handle different object structures
    return {
      blob_id: blob.blob_id || (blob.id && typeof blob.id === 'object' ? blob.id.id : ''),
      id: blob.id || { id: blob.blob_id || '' },
      registered_epoch: blob.registered_epoch || 0,
      storage_cost: blob.storage_cost || { value: '0' },
      metadata: blob.metadata || {},
      deletable: blob.deletable || false
    };
  }
  
  /**
   * Normalizes a write blob response to ensure consistent structure
   */
  private normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
    // Handle different response structures to extract blobId reliably
    let blobId = '';
    
    if (!response) {
      throw new Error('Empty response from writeBlob operation');
    }
    
    // Extract blobId from various possible locations
    if (typeof response === 'string') {
      blobId = response;
    } else if (response.blobId) {
      blobId = response.blobId;
    } else if (response.blobObject && response.blobObject.blob_id) {
      blobId = response.blobObject.blob_id;
    } else if (response.blob_id) {
      blobId = response.blob_id;
    } else if (response.blobObject && response.blobObject.id && response.blobObject.id.id) {
      blobId = response.blobObject.id.id;
    }
    
    if (!blobId) {
      throw new Error('Could not extract blobId from writeBlob response');
    }
    
    // Prepare the normalized blob object
    const blobObject = response.blobObject 
      ? this.normalizeBlobObject(response.blobObject) 
      : { blob_id: blobId, deletable: false };
    
    return {
      blobId,
      blobObject,
      digest: response.digest || ''
    };
  }
  
  /**
   * Creates a new WalrusClientAdapter from an existing WalrusClient
   */
  static from(walrusClient: OriginalWalrusClient | Partial<WalrusClientExt>): WalrusClientAdapter {
    return new WalrusClientAdapter(walrusClient);
  }
}