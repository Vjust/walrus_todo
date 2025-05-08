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
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';
import { 
  BlobObject, 
  BlobInfo, 
  BlobMetadataShape, 
  WalrusClient 
} from '../../types/walrus';
import { WalrusClientExt } from '../../types/client';
import { SignerAdapter } from './signer-adapter';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from './transaction-adapter';

/**
 * Unified interface that combines both WalrusClient and WalrusClientExt
 * interfaces into a single, comprehensive interface.
 */
export interface WalrusClientAdapter {
  // Core WalrusClient methods
  executeCreateStorageTransaction(
    options: StorageWithSizeOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter; 
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
  getBlobObject(params: { blobId: string }): Promise<BlobObject>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  
  // Write blob method that handles both interface variants
  writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionBlock | TransactionBlockAdapter 
  }): Promise<{
    blobId?: string;
    blobObject: BlobObject | { blob_id: string }
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
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }>;
  
  executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }>;
  
  deleteBlob(options: DeleteBlobOptions): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{ digest: string }>;
  
  executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: BlobObject;
    digest: string; 
  }>;
  
  getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }>;
  
  createStorageBlock(size: number, epochs: number): Promise<TransactionBlock | TransactionBlockAdapter>;
  
  createStorage(
    options: StorageWithSizeOptions
  ): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{
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
  getUnderlyingClient(): OriginalWalrusClient | WalrusClient | WalrusClientExt;
}

/**
 * Implementation of WalrusClientAdapter that wraps either the original WalrusClient
 * or the extended WalrusClientExt interfaces, providing a unified interface
 */
export class WalrusClientAdapterImpl implements WalrusClientAdapter {
  private client: OriginalWalrusClient | WalrusClient | WalrusClientExt;
  private clientType: 'original' | 'custom' | 'extended';

  constructor(client: OriginalWalrusClient | WalrusClient | WalrusClientExt) {
    this.client = client;
    
    // Determine the type of client we're working with
    if ('getBlobSize' in client && typeof client.getBlobSize === 'function') {
      this.clientType = 'extended';
    } else if ('experimental' in client && client.experimental) {
      this.clientType = 'extended';
    } else {
      this.clientType = 'original';
    }
  }

  getUnderlyingClient(): OriginalWalrusClient | WalrusClient | WalrusClientExt {
    return this.client;
  }

  async executeCreateStorageTransaction(
    options: StorageWithSizeOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter; 
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
    // Convert any provided adapters to their underlying implementations
    const adaptedOptions = {
      ...options,
      transaction: options.transaction instanceof TransactionBlock 
        ? options.transaction 
        : options.transaction 
          ? (options.transaction as TransactionBlockAdapter).getUnderlyingBlock() 
          : undefined,
      signer: 'getUnderlyingSigner' in options.signer 
        ? (options.signer as SignerAdapter).getUnderlyingSigner() 
        : options.signer
    };
    
    return this.client.executeCreateStorageTransaction(adaptedOptions);
  }

  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    return this.client.getConfig();
  }

  async getWalBalance(): Promise<string> {
    return this.client.getWalBalance();
  }

  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return this.client.getStorageUsage();
  }

  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    return this.client.getBlobInfo(blobId);
  }

  async getBlobObject(params: { blobId: string }): Promise<BlobObject> {
    return this.client.getBlobObject(params);
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    return this.client.verifyPoA(params);
  }

  async writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionBlock | TransactionBlockAdapter 
  }): Promise<{
    blobId?: string;
    blobObject: BlobObject | { blob_id: string }
  }> {
    // Check which interface of writeBlob we're dealing with
    if ('blob' in params && 'signer' in params) {
      // Extended interface, handle adapters
      const adaptedParams = {
        ...params,
        transaction: params.transaction instanceof TransactionBlock 
          ? params.transaction 
          : params.transaction 
            ? (params.transaction as TransactionBlockAdapter).getUnderlyingBlock() 
            : undefined,
        signer: 'getUnderlyingSigner' in params.signer 
          ? (params.signer as SignerAdapter).getUnderlyingSigner() 
          : params.signer
      };
      
      // If we have the extended client, use it directly
      if (this.clientType === 'extended') {
        return (this.client as WalrusClientExt).writeBlob(adaptedParams);
      }
      
      // Otherwise, adapt the response format
      const result = await (this.client as WalrusClient).writeBlob({
        data: adaptedParams.blob,
        options: {
          deletable: adaptedParams.deletable,
          epochs: adaptedParams.epochs,
          attributes: adaptedParams.attributes
        }
      } as any); // Type cast due to interface differences
      
      return {
        blobId: result.blobId,
        blobObject: result.blobObject || { blob_id: result.blobId }
      };
    } else {
      // Original interface
      const result = await this.client.writeBlob(params as WriteBlobOptions);
      
      // Handle different response formats
      if ('blobId' in result) {
        return {
          blobId: result.blobId,
          blobObject: result.blobObject
        };
      } else {
        return {
          blobObject: (result as any).blobObject
        };
      }
    }
  }

  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    return this.client.readBlob(options);
  }

  async getBlobMetadata(options: ReadBlobOptions): Promise<BlobMetadataShape> {
    return this.client.getBlobMetadata(options);
  }

  async storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    return this.client.storageCost(size, epochs);
  }

  // Optional methods from WalrusClientExt
  async getBlobSize(blobId: string): Promise<number> {
    if (this.clientType === 'extended' && 'getBlobSize' in this.client) {
      return (this.client as WalrusClientExt).getBlobSize(blobId);
    }
    // Fallback implementation if client doesn't have this method
    const blobInfo = await this.client.getBlobInfo(blobId);
    return Number(blobInfo.size || 0);
  }

  async getStorageProviders(params: { blobId: string }): Promise<string[]> {
    if (this.clientType === 'extended' && 'getStorageProviders' in this.client) {
      return (this.client as WalrusClientExt).getStorageProviders(params);
    }
    // Return empty array as fallback
    return [];
  }

  reset(): void {
    if (this.clientType === 'extended' && 'reset' in this.client) {
      (this.client as WalrusClientExt).reset();
    }
    // Do nothing if the client doesn't have this method
  }

  async executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    // Convert adapters to underlying implementations
    const adaptedOptions = {
      ...options,
      transaction: options.transaction instanceof TransactionBlock 
        ? options.transaction 
        : options.transaction 
          ? (options.transaction as TransactionBlockAdapter).getUnderlyingBlock() 
          : undefined,
      signer: options.signer && 'getUnderlyingSigner' in options.signer 
        ? (options.signer as SignerAdapter).getUnderlyingSigner() 
        : options.signer
    };
    
    return this.client.executeCertifyBlobTransaction(adaptedOptions);
  }

  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    // Convert adapters to underlying implementations
    const adaptedOptions = {
      ...options,
      transaction: options.transaction instanceof TransactionBlock 
        ? options.transaction 
        : options.transaction 
          ? (options.transaction as TransactionBlockAdapter).getUnderlyingBlock() 
          : undefined,
      signer: options.signer && 'getUnderlyingSigner' in options.signer 
        ? (options.signer as SignerAdapter).getUnderlyingSigner() 
        : options.signer
    };
    
    return this.client.executeWriteBlobAttributesTransaction(adaptedOptions);
  }

  deleteBlob(options: DeleteBlobOptions): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{ digest: string }> {
    const originalFn = this.client.deleteBlob(options);
    
    // Return a wrapped function that handles the adapter
    return (tx: TransactionBlock | TransactionBlockAdapter) => {
      const adaptedTx = tx instanceof TransactionBlock 
        ? tx 
        : (tx as TransactionBlockAdapter).getUnderlyingBlock();
      
      return originalFn(adaptedTx);
    };
  }

  async executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: BlobObject;
    digest: string; 
  }> {
    // Convert adapters to underlying implementations
    const adaptedOptions = {
      ...options,
      transaction: options.transaction instanceof TransactionBlock 
        ? options.transaction 
        : options.transaction 
          ? (options.transaction as TransactionBlockAdapter).getUnderlyingBlock() 
          : undefined,
      signer: options.signer && 'getUnderlyingSigner' in options.signer 
        ? (options.signer as SignerAdapter).getUnderlyingSigner() 
        : options.signer
    };
    
    return this.client.executeRegisterBlobTransaction(adaptedOptions);
  }

  async getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }> {
    return this.client.getStorageConfirmationFromNode(options);
  }

  async createStorageBlock(size: number, epochs: number): Promise<TransactionBlock | TransactionBlockAdapter> {
    const txBlock = await this.client.createStorageBlock(size, epochs);
    // Wrap in our adapter
    return createTransactionBlockAdapter(txBlock);
  }

  createStorage(
    options: StorageWithSizeOptions
  ): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }> {
    const originalFn = this.client.createStorage(options);
    
    // Return a wrapped function that handles the adapter
    return (tx: TransactionBlock | TransactionBlockAdapter) => {
      const adaptedTx = tx instanceof TransactionBlock 
        ? tx 
        : (tx as TransactionBlockAdapter).getUnderlyingBlock();
      
      return originalFn(adaptedTx);
    };
  }

  // Handle experimental methods
  experimental = this.client.experimental || {
    getBlobData: async (): Promise<any> => {
      throw new Error('Experimental API not supported by this client');
    }
  };
}

/**
 * Factory function to create a WalrusClientAdapter from an existing client
 */
export function createWalrusClientAdapter(
  client: OriginalWalrusClient | WalrusClient | WalrusClientExt
): WalrusClientAdapter {
  return new WalrusClientAdapterImpl(client);
}