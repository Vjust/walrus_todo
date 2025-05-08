import type { 
  WalrusClient as OriginalWalrusClient, 
  WalrusClientConfig, 
  StorageWithSizeOptions, 
  WriteBlobOptions, 
  ReadBlobOptions, 
  RegisterBlobOptions, 
  CertifyBlobOptions, 
  WriteBlobAttributesOptions, 
  DeleteBlobOptions,
  GetStorageConfirmationOptions
} from '@mysten/walrus';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';
import { BlobInfo, BlobMetadataShape } from '../../types/walrus';
import { WalrusClientExt } from '../../types/client';
import { SignerAdapter } from './signer-adapter';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from './transaction-adapter';
import { TransactionType } from '../../types/transaction';
import { 
  NormalizedBlobObject, 
  NormalizedWriteBlobResponse 
} from '../../types/adapters/WalrusClientAdapter';

/**
 * Unified interface that combines both WalrusClient and WalrusClientExt
 * interfaces into a single, comprehensive interface.
 */
export interface WalrusClientAdapter {
  // Core WalrusClient methods
  executeCreateStorageTransaction(
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
  
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  getBlobInfo(blobId: string): Promise<BlobInfo>;
  getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  
  // Write blob method that handles both interface variants
  // Updated return type to make blobId required, not optional
  writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionType 
  }): Promise<{
    blobId: string; // Changed from optional to required
    blobObject: NormalizedBlobObject;
  }>;
  
  readBlob(options: ReadBlobOptions): Promise<Uint8Array>;
  getBlobMetadata(options: ReadBlobOptions): Promise<BlobMetadataShape>;
  storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }>;
  
  // WalrusClientExt specific methods
  getBlobSize?(blobId: string): Promise<number>;
  getStorageProviders?(params: { blobId: string }): Promise<string[]>;
  reset?(): void;
  
  // Transaction-related methods
  executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }>;
  
  executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }>;
  
  deleteBlob(options: DeleteBlobOptions): (tx: TransactionType) => Promise<{ digest: string }>;
  
  executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: NormalizedBlobObject;
    digest: string; 
  }>;
  
  getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }>;
  
  createStorageBlock(size: number, epochs: number): Promise<TransactionType>;
  
  createStorage(
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
  
  // Any experimental methods
  experimental?: {
    getBlobData: () => Promise<any>;
  };
  
  // Access to the underlying client
  getUnderlyingClient(): OriginalWalrusClient | any;
}

/**
 * Implementation of WalrusClientAdapter that wraps either the original WalrusClient
 * or the extended WalrusClientExt interfaces, providing a unified interface
 */
export class WalrusClientAdapterImpl implements WalrusClientAdapter {
  private client: OriginalWalrusClient | any;
  private clientType: 'original' | 'custom' | 'extended';
  private _experimental: { getBlobData: () => Promise<any> };

  constructor(client: OriginalWalrusClient | any) {
    if (!client) {
      throw new Error('Cannot initialize WalrusClientAdapter with null or undefined client');
    }
    
    this.client = client;
    
    // Determine the type of client we're working with
    if ('getBlobSize' in client && typeof client.getBlobSize === 'function') {
      this.clientType = 'extended';
    } else if (client && 'experimental' in client && client.experimental) {
      this.clientType = 'extended';
    } else {
      this.clientType = 'original';
    }

    // Initialize the experimental property safely
    this._experimental = {
      getBlobData: async (): Promise<any> => {
        throw new Error('Experimental API not supported by this client');
      }
    };

    // Only set the experimental property if it exists on the client
    if (client && 'experimental' in client && client.experimental) {
      this._experimental = client.experimental;
    }
  }

  getUnderlyingClient(): OriginalWalrusClient | any {
    return this.client;
  }

  async executeCreateStorageTransaction(
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
  }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    // Convert any provided adapters to their underlying implementations
    const adaptedOptions = { ...options };
    
    // Handle transaction adapter
    if (options.transaction) {
      if (typeof options.transaction === 'object' && options.transaction !== null) {
        if ('getUnderlyingBlock' in options.transaction && typeof options.transaction.getUnderlyingBlock === 'function') {
          adaptedOptions.transaction = options.transaction.getUnderlyingBlock();
        } else if ('getTransactionBlock' in options.transaction && typeof options.transaction.getTransactionBlock === 'function') {
          adaptedOptions.transaction = (options.transaction as any).getTransactionBlock();
        }
      }
    }
    
    // Handle signer adapter
    if (options.signer) {
      if ('getUnderlyingSigner' in options.signer) {
        adaptedOptions.signer = options.signer.getUnderlyingSigner();
      } else if ('getSigner' in options.signer) {
        adaptedOptions.signer = (options.signer as any).getSigner();
      }
    }
    
    try {
      return await this.client.executeCreateStorageTransaction(adaptedOptions);
    } catch (err) {
      console.error('Error in executeCreateStorageTransaction:', err);
      throw new Error(`Failed to execute create storage transaction: ${err.message}`);
    }
  }

  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    return this.client.getConfig();
  }

  async getWalBalance(): Promise<string> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    return this.client.getWalBalance();
  }

  async getStorageUsage(): Promise<{ used: string; total: string }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    return this.client.getStorageUsage();
  }

  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    
    const result = await this.client.getBlobInfo(blobId);
    return result as BlobInfo;
  }

  async getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    
    const result = await this.client.getBlobObject(params);
    return this.normalizeBlobObject(result);
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    return this.client.verifyPoA(params);
  }

  async writeBlob(params: WriteBlobOptions | { 
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
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    try {
      // Handle different param formats
      // Convert any adapters to their underlying implementations
      const adaptedParams: any = { ...params };
      
      // Check for and extract any transaction adapter instances
      if ('transaction' in adaptedParams && adaptedParams.transaction) {
        const extractMethod = 'getUnderlyingBlock' in adaptedParams.transaction
          ? 'getUnderlyingBlock'
          : 'getTransactionBlock' in adaptedParams.transaction
            ? 'getTransactionBlock'
            : null;
            
        if (extractMethod) {
          adaptedParams.transaction = adaptedParams.transaction[extractMethod]();
        }
      }
      
      // Check for and extract any signer adapter instances
      if ('signer' in adaptedParams && adaptedParams.signer) {
        const extractMethod = 'getUnderlyingSigner' in adaptedParams.signer
          ? 'getUnderlyingSigner'
          : 'getSigner' in adaptedParams.signer
            ? 'getSigner'
            : null;
            
        if (extractMethod) {
          adaptedParams.signer = adaptedParams.signer[extractMethod]();
        }
      }
      
      // Call writeBlob on the client with the adapted parameters
      const result = await this.client.writeBlob(adaptedParams);
      
      // Normalize the response so it always has a blobId and a consistent blobObject
      const normalizedResult = this.normalizeWriteBlobResponse(result);
      
      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject
      };
    } catch (err) {
      console.error('Error in writeBlob:', err);
      throw new Error(`Failed to write blob: ${err.message}`);
    }
  }

  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    return this.client.readBlob(options);
  }

  async getBlobMetadata(options: ReadBlobOptions): Promise<BlobMetadataShape> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }
    
    if ('getBlobMetadata' in this.client && typeof this.client.getBlobMetadata === 'function') {
      return this.client.getBlobMetadata(options);
    }
    
    // Provide a fallback if the method doesn't exist
    throw new Error('getBlobMetadata is not implemented in this client');
  }

  async storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if ('storageCost' in this.client && typeof this.client.storageCost === 'function') {
      const result = await this.client.storageCost(size, epochs);
      
      // Ensure consistent return type by converting to bigint
      return {
        storageCost: BigInt(result.storageCost.toString()),
        writeCost: BigInt(result.writeCost.toString()),
        totalCost: BigInt(result.totalCost.toString())
      };
    }
    
    // Fallback implementation
    return {
      storageCost: BigInt(0),
      writeCost: BigInt(0),
      totalCost: BigInt(0)
    };
  }

  // Optional methods from WalrusClientExt
  async getBlobSize(blobId: string): Promise<number> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if ('getBlobSize' in this.client && typeof this.client.getBlobSize === 'function') {
      return this.client.getBlobSize(blobId);
    }
    
    // Fallback implementation
    try {
      const blobInfo = await this.getBlobInfo(blobId);
      return Number(blobInfo.size || 0);
    } catch (err) {
      return 0;
    }
  }

  async getStorageProviders(params: { blobId: string }): Promise<string[]> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if ('getStorageProviders' in this.client && typeof this.client.getStorageProviders === 'function') {
      return this.client.getStorageProviders(params);
    }
    
    return [];
  }

  reset(): void {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if ('reset' in this.client && typeof this.client.reset === 'function') {
      this.client.reset();
    }
  }

  async executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('executeCertifyBlobTransaction' in this.client) || 
        typeof this.client.executeCertifyBlobTransaction !== 'function') {
      throw new Error('executeCertifyBlobTransaction method not available on the current client');
    }

    // Convert adapters to underlying implementations
    const adaptedOptions = this.extractAdapters(options);
    
    return this.client.executeCertifyBlobTransaction(adaptedOptions);
  }

  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('executeWriteBlobAttributesTransaction' in this.client) || 
        typeof this.client.executeWriteBlobAttributesTransaction !== 'function') {
      throw new Error('executeWriteBlobAttributesTransaction method not available on the current client');
    }

    // Convert adapters to underlying implementations
    const adaptedOptions = this.extractAdapters(options);
    
    return this.client.executeWriteBlobAttributesTransaction(adaptedOptions);
  }

  deleteBlob(options: DeleteBlobOptions): (tx: TransactionType) => Promise<{ digest: string }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('deleteBlob' in this.client) || typeof this.client.deleteBlob !== 'function') {
      throw new Error('deleteBlob method not available on the current client');
    }

    const originalFn = this.client.deleteBlob(options);
    
    // Return a wrapped function that handles the adapter
    return async (tx: TransactionType) => {
      const adaptedTx = this.extractTransaction(tx);
      return originalFn(adaptedTx);
    };
  }

  async executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: NormalizedBlobObject;
    digest: string; 
  }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('executeRegisterBlobTransaction' in this.client) || 
        typeof this.client.executeRegisterBlobTransaction !== 'function') {
      throw new Error('executeRegisterBlobTransaction method not available on the current client');
    }

    // Convert adapters to underlying implementations
    const adaptedOptions = this.extractAdapters(options);
    
    const result = await this.client.executeRegisterBlobTransaction(adaptedOptions);
    
    return {
      blob: this.normalizeBlobObject(result.blob),
      digest: result.digest
    };
  }

  async getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('getStorageConfirmationFromNode' in this.client) || 
        typeof this.client.getStorageConfirmationFromNode !== 'function') {
      throw new Error('getStorageConfirmationFromNode method not available on the current client');
    }

    const result = await this.client.getStorageConfirmationFromNode(options);
    
    // Ensure consistent return format
    return {
      confirmed: Boolean(result.confirmed),
      serializedMessage: result.serializedMessage || '',
      signature: result.signature || ''
    };
  }

  async createStorageBlock(size: number, epochs: number): Promise<TransactionType> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('createStorageBlock' in this.client) || 
        typeof this.client.createStorageBlock !== 'function') {
      throw new Error('createStorageBlock method not available on the current client');
    }

    try {
      const txBlock = await this.client.createStorageBlock(size, epochs);
      // Ensure we can handle different return types from the client
      if (!txBlock) {
        throw new Error('Client returned null or undefined transaction block');
      }
      
      // Create an adapter that can work with our system
      const adapter = createTransactionBlockAdapter(txBlock);
      return adapter;
    } catch (err) {
      console.error('Error creating storage block:', err);
      throw new Error(`Failed to create storage block: ${err.message}`);
    }
  }

  createStorage(
    options: StorageWithSizeOptions
  ): (tx: TransactionType) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }> {
    if (!this.client) {
      throw new Error('WalrusClient not initialized');
    }

    if (!('createStorage' in this.client) || typeof this.client.createStorage !== 'function') {
      throw new Error('createStorage method not available on the current client');
    }

    const originalFn = this.client.createStorage(options);
    
    // Return a wrapped function that handles the adapter
    return async (tx: TransactionType) => {
      const adaptedTx = this.extractTransaction(tx);
      return originalFn(adaptedTx);
    };
  }

  // Handle experimental methods safely
  get experimental(): { getBlobData: () => Promise<any> } {
    return this._experimental;
  }
  
  /**
   * Helper method to extract the underlying transaction from a transaction or adapter
   * This handles both our adapter implementations and raw transaction objects
   */
  private extractTransaction(tx: TransactionType): any {
    if (!tx) return undefined;
    
    try {
      // Type guard to prevent errors calling non-existent methods
      if (typeof tx === 'object' && tx !== null) {
        // First check for our adapter interfaces
        if ('getUnderlyingBlock' in tx && typeof tx.getUnderlyingBlock === 'function') {
          return tx.getUnderlyingBlock();
        } else if ('getTransactionBlock' in tx && typeof tx.getTransactionBlock === 'function') {
          return tx.getTransactionBlock();
        } 
        // Then check if it's a TransactionBlock instance
        else if (tx.constructor && tx.constructor.name === 'TransactionBlock') {
          // It's already a TransactionBlock instance
          return tx;
        }
        // If none of these checks pass, return the transaction as-is
        // This handles other types of transaction objects
      }
      
      return tx;
    } catch (err) {
      console.warn('Error extracting transaction:', err);
      // In case of any error, return the original transaction
      // This is safer than returning undefined
      return tx;
    }
  }
  
  /**
   * Helper method to extract the underlying signer from a signer or adapter
   */
  private extractSigner(signer: Signer | Ed25519Keypair | SignerAdapter): any {
    if (!signer) return undefined;
    
    // Type guard to prevent errors calling non-existent methods
    if (typeof signer === 'object') {
      if ('getUnderlyingSigner' in signer && typeof signer.getUnderlyingSigner === 'function') {
        return signer.getUnderlyingSigner();
      } else if ('getSigner' in signer && typeof signer.getSigner === 'function') {
        return signer.getSigner();
      }
    }
    
    return signer;
  }
  
  /**
   * Helper method to extract both transaction and signer adapters from options
   */
  private extractAdapters<T extends { transaction?: TransactionType; signer?: any }>(options: T): T {
    const result = { ...options };
    
    if ('transaction' in result && result.transaction) {
      result.transaction = this.extractTransaction(result.transaction);
    }
    
    if ('signer' in result && result.signer) {
      result.signer = this.extractSigner(result.signer);
    }
    
    return result;
  }
  
  /**
   * Normalizes a blob object to ensure consistent structure
   * Handles different blob object formats from different library versions
   */
  private normalizeBlobObject(blob: any): NormalizedBlobObject {
    if (!blob) {
      return {
        blob_id: '',
        deletable: false
      };
    }
    
    return {
      blob_id: blob.blob_id || (blob.id && typeof blob.id === 'object' ? blob.id.id : ''),
      id: blob.id || { id: blob.blob_id || '' },
      registered_epoch: Number(blob.registered_epoch || 0),
      storage_cost: blob.storage_cost || { value: '0' },
      metadata: blob.metadata || {},
      deletable: Boolean(blob.deletable)
    };
  }
  
  /**
   * Normalizes a write blob response to ensure consistent structure
   * Handles different response formats to extract blobId reliably
   */
  private normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
    if (!response) {
      throw new Error('Empty response from writeBlob operation');
    }
    
    // Extract blobId from various possible locations
    let blobId = '';
    
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
}

/**
 * Factory function to create a WalrusClientAdapter from an existing client
 */
export function createWalrusClientAdapter(
  client: OriginalWalrusClient | any
): WalrusClientAdapter {
  return new WalrusClientAdapterImpl(client);
}