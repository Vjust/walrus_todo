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
  type WalrusClient,
  type WriteBlobOptions,
  type StorageWithSizeOptions,
  type RegisterBlobOptions,
  type DeleteBlobOptions,
  type CertifyBlobOptions,
  type WriteBlobAttributesOptions,
  type GetStorageConfirmationOptions,
  type WriteSliversToNodeOptions,
  type WriteEncodedBlobToNodesOptions,
  type WalrusClientConfig,
  type ReadBlobOptions
} from '@mysten/walrus';
import { type WalrusClientExt } from '../../types/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Signer } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { UnifiedTransactionBlock } from './TransactionBlockAdapter';
import { UnifiedSigner } from './SignerAdapter';

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
  getBlobInfo(options: ReadBlobOptions): Promise<NormalizedBlobObject>;
  
  /**
   * Reads a blob's content
   */
  readBlob(options: ReadBlobOptions): Promise<Uint8Array>;
  
  /**
   * Writes a blob to Walrus storage
   */
  writeBlob(options: WriteBlobOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<NormalizedWriteBlobResponse>;
  
  /**
   * Writes blob attributes
   */
  writeBlobAttributes(options: WriteBlobAttributesOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<{ 
    digest: string;
  }>;
  
  /**
   * Executes a register blob transaction
   */
  executeRegisterBlobTransaction(options: RegisterBlobOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<{
    blob: NormalizedBlobObject;
    digest: string;
  }>;
  
  /**
   * Creates a function to delete a blob
   */
  deleteBlob(options: DeleteBlobOptions): (tx: UnifiedTransactionBlock | TransactionBlock) => Promise<{
    digest: string;
  }>;
  
  /**
   * Creates a function to create storage
   */
  createStorage(options: StorageWithSizeOptions): (tx: UnifiedTransactionBlock | TransactionBlock) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }>;
}

/**
 * WalrusClientAdapter implements the UnifiedWalrusClient interface
 * and adapts different WalrusClient implementations
 */
export class WalrusClientAdapter implements UnifiedWalrusClient {
  private walrusClient: WalrusClient & Partial<WalrusClientExt>;
  
  constructor(walrusClient: WalrusClient & Partial<WalrusClientExt>) {
    this.walrusClient = walrusClient;
  }
  
  /**
   * Gets the underlying WalrusClient implementation
   */
  public getWalrusClient(): WalrusClient & Partial<WalrusClientExt> {
    return this.walrusClient;
  }
  
  /**
   * Gets information about a blob
   */
  async getBlobInfo(options: ReadBlobOptions): Promise<NormalizedBlobObject> {
    const blobInfo = await this.walrusClient.getBlobInfo(options);
    
    // Normalize the blob info response to work with both interface versions
    return this.normalizeBlobObject(blobInfo);
  }
  
  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    return await this.walrusClient.readBlob(options);
  }
  
  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(options: WriteBlobOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<NormalizedWriteBlobResponse> {
    const result = await this.walrusClient.writeBlob(options);
    
    // Normalize the response to work with both interface versions
    return this.normalizeWriteBlobResponse(result);
  }
  
  /**
   * Writes blob attributes
   */
  async writeBlobAttributes(options: WriteBlobAttributesOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<{ 
    digest: string;
  }> {
    return await this.walrusClient.writeBlobAttributes(options);
  }
  
  /**
   * Executes a register blob transaction
   */
  async executeRegisterBlobTransaction(options: RegisterBlobOptions & {
    transaction?: UnifiedTransactionBlock | TransactionBlock;
    signer?: UnifiedSigner | Signer | Ed25519Keypair;
  }): Promise<{
    blob: NormalizedBlobObject;
    digest: string;
  }> {
    const result = await this.walrusClient.executeRegisterBlobTransaction(options);
    
    return {
      blob: this.normalizeBlobObject(result.blob),
      digest: result.digest
    };
  }
  
  /**
   * Creates a function to delete a blob
   */
  deleteBlob(options: DeleteBlobOptions): (tx: UnifiedTransactionBlock | TransactionBlock) => Promise<{
    digest: string;
  }> {
    const deleteFunction = this.walrusClient.deleteBlob(options);
    
    // Return a wrapped function that accepts UnifiedTransactionBlock
    return async (tx: UnifiedTransactionBlock | TransactionBlock) => {
      // If the tx is a UnifiedTransactionBlock, extract the underlying TransactionBlock
      const actualTx = 'getTransactionBlock' in tx 
        ? (tx as any).getTransactionBlock() 
        : tx;
        
      return await deleteFunction(actualTx);
    };
  }
  
  /**
   * Creates a function to create storage
   */
  createStorage(options: StorageWithSizeOptions): (tx: UnifiedTransactionBlock | TransactionBlock) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }> {
    const createStorageFunction = this.walrusClient.createStorage(options);
    
    // Return a wrapped function that accepts UnifiedTransactionBlock
    return async (tx: UnifiedTransactionBlock | TransactionBlock) => {
      // If the tx is a UnifiedTransactionBlock, extract the underlying TransactionBlock
      const actualTx = 'getTransactionBlock' in tx 
        ? (tx as any).getTransactionBlock() 
        : tx;
        
      return await createStorageFunction(actualTx);
    };
  }
  
  /**
   * Normalizes a blob object to ensure consistent structure
   */
  private normalizeBlobObject(blobObject: any): NormalizedBlobObject {
    // Handle different blob object formats from different library versions
    return {
      blob_id: blobObject.blob_id || blobObject.id?.id || '',
      id: blobObject.id || { id: blobObject.blob_id || '' },
      registered_epoch: blobObject.registered_epoch || 0,
      storage_cost: blobObject.storage_cost || { value: '0' },
      metadata: blobObject.metadata || {},
      deletable: blobObject.deletable || false
    };
  }
  
  /**
   * Normalizes a write blob response to ensure consistent structure
   */
  private normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
    // Handle different response formats
    const blobId = response.blobId || response.blobObject?.blob_id || '';
    const blobObject = response.blobObject || { blob_id: blobId };
    
    return {
      blobId: blobId,
      blobObject: this.normalizeBlobObject(blobObject),
      digest: response.digest || ''
    };
  }
  
  /**
   * Creates a new WalrusClientAdapter from an existing WalrusClient
   */
  static from(walrusClient: WalrusClient & Partial<WalrusClientExt>): WalrusClientAdapter {
    return new WalrusClientAdapter(walrusClient);
  }
}