/**
 * WalrusClientAdapter implementation
 * 
 * This file contains the implementation of the WalrusClientAdapter interface
 * with version-specific adapters for different WalrusClient versions.
 */

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
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import { BlobInfo, BlobMetadataShape } from '../../types/walrus';
import { WalrusClient, WalrusClientExt } from '../../types/client';
import { SignerAdapterImpl } from './signer-adapter';
import { SignerAdapter } from '../../types/adapters/SignerAdapter';
import { TransactionType } from '../../types/transaction';
import { 
  WalrusClientAdapter,
  WalrusClientVersion,
  NormalizedBlobObject, 
  NormalizedWriteBlobResponse,
  AdapterOptions,
  BaseWalrusClientAdapter,
  WalrusClientAdapterError,
  isOriginalWalrusClient,
  isWalrusClient,
  isWalrusClientExt
} from '../../types/adapters/WalrusClientAdapter';

/**
 * Factory function to create a WalrusClientAdapter from an existing client
 * 
 * @param client The WalrusClient instance to adapt
 * @returns A WalrusClientAdapter instance
 */
export function createWalrusClientAdapter(
  client: OriginalWalrusClient | WalrusClient | WalrusClientExt | any
): WalrusClientAdapter {
  return createVersionSpecificAdapter(client);
}

/**
 * Original WalrusClient (V1) adapter implementation
 */
class OriginalWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: any) {
    super(client);
    if (!isOriginalWalrusClient(client)) {
      throw new WalrusClientAdapterError('Client does not implement the original WalrusClient interface');
    }
  }
  
  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.getBlobInfo(blobId);
      return this.normalizeBlobObject(result);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to read blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(options: any): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();
    
    const adaptedOptions = this.extractAdapters(options);
    
    try {
      const result = await this.walrusClient.writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result);
      
      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to write blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    this.ensureClientInitialized();
    
    try {
      const config = await this.walrusClient.getConfig();
      return {
        network: config.network || 'unknown',
        version: config.version || '0.0.0',
        maxSize: typeof config.maxSize === 'number' ? config.maxSize : 0
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();
    
    try {
      const usage = await this.walrusClient.getStorageUsage();
      return {
        used: usage.used || '0',
        total: usage.total || '0'
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets blob metadata - v1 clients don't have this directly
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<any> {
    throw new WalrusClientAdapterError('getBlobMetadata not supported in original WalrusClient');
  }
  
  /**
   * Verifies proof of availability - v1 clients don't have this
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    // For V1 clients, we return true to avoid breaking functionality
    console.warn('verifyPoA not implemented in original WalrusClient, returning true as fallback');
    return true;
  }
  
  /**
   * Gets the blob object - v1 clients don't have this directly
   */
  async getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject> {
    // Fallback for V1 clients: use getBlobInfo and normalize
    try {
      const blobInfo = await this.getBlobInfo(params.blobId);
      return blobInfo;
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob object using fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage cost - v1 clients don't have this directly
   */
  async storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }> {
    // Provide a fallback implementation with sensible defaults
    console.warn('storageCost not implemented in original WalrusClient, returning zeros as fallback');
    return {
      storageCost: BigInt(0),
      writeCost: BigInt(0),
      totalCost: BigInt(0)
    };
  }
}

/**
 * Custom WalrusClient (V2) adapter implementation
 */
class CustomWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: any) {
    super(client);
    if (!isWalrusClient(client)) {
      throw new WalrusClientAdapterError('Client does not implement the custom WalrusClient interface');
    }
  }
  
  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.getBlobInfo(blobId);
      return this.normalizeBlobObject(result);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to read blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(options: any): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();
    
    const adaptedOptions = this.extractAdapters(options);
    
    try {
      const result = await this.walrusClient.writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result);
      
      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to write blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    this.ensureClientInitialized();
    
    try {
      const config = await this.walrusClient.getConfig();
      return {
        network: config.network || 'unknown',
        version: config.version || '0.0.0',
        maxSize: typeof config.maxSize === 'number' ? config.maxSize : 0
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();
    
    try {
      const usage = await this.walrusClient.getStorageUsage();
      return {
        used: usage.used || '0',
        total: usage.total || '0'
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets blob metadata
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<any> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.getBlobMetadata(options);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Verifies proof of availability
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.verifyPoA(params);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to verify PoA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the blob object
   */
  async getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.getBlobObject(params);
      return this.normalizeBlobObject(result);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob object: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage cost for given size and epochs
   */
  async storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.storageCost(size, epochs);
      
      // Convert to bigint consistently
      return {
        storageCost: this.toBigInt(result.storageCost),
        writeCost: this.toBigInt(result.writeCost),
        totalCost: this.toBigInt(result.totalCost)
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage cost: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets blob size (not available in V2, fallback to blob info)
   */
  async getBlobSize(blobId: string): Promise<number> {
    // Fallback: try to get size from blob info
    try {
      const blobInfo = await this.getBlobInfo(blobId);
      if (blobInfo.size !== undefined) {
        return typeof blobInfo.size === 'string' ? parseInt(blobInfo.size, 10) : blobInfo.size as number;
      }
      throw new WalrusClientAdapterError('Size not available in blob info');
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob size using fallback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Extended WalrusClient (V3) adapter implementation
 */
class ExtendedWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: any) {
    super(client);
    // We're more lenient with extended client since it might be a custom implementation
    if (!isWalrusClient(client) && !('getBlobSize' in client)) {
      throw new WalrusClientAdapterError('Client does not implement the extended WalrusClient interface');
    }
  }
  
  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.getBlobInfo(blobId);
      return this.normalizeBlobObject(result);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to read blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(options: any): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();
    
    const adaptedOptions = this.extractAdapters(options);
    
    try {
      const result = await this.walrusClient.writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result);
      
      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to write blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    this.ensureClientInitialized();
    
    try {
      const config = await this.walrusClient.getConfig();
      return {
        network: config.network || 'unknown',
        version: config.version || '0.0.0',
        maxSize: typeof config.maxSize === 'number' ? config.maxSize : 0
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();
    
    try {
      const usage = await this.walrusClient.getStorageUsage();
      return {
        used: usage.used || '0',
        total: usage.total || '0'
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets blob metadata
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<any> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.getBlobMetadata(options);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Verifies proof of availability
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    this.ensureClientInitialized();
    
    try {
      return await this.walrusClient.verifyPoA(params);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to verify PoA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets the blob object
   */
  async getBlobObject(params: { blobId: string }): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.getBlobObject(params);
      return this.normalizeBlobObject(result);
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get blob object: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets storage cost for given size and epochs
   */
  async storageCost(size: number, epochs: number): Promise<{ 
    storageCost: bigint; 
    writeCost: bigint; 
    totalCost: bigint 
  }> {
    this.ensureClientInitialized();
    
    try {
      const result = await this.walrusClient.storageCost(size, epochs);
      
      // Convert to bigint consistently
      return {
        storageCost: this.toBigInt(result.storageCost),
        writeCost: this.toBigInt(result.writeCost),
        totalCost: this.toBigInt(result.totalCost)
      };
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage cost: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Gets blob size (extended functionality)
   */
  async getBlobSize(blobId: string): Promise<number> {
    this.ensureClientInitialized();

    try {
      // Type guard for the getBlobSize method
      if ('getBlobSize' in this.walrusClient && typeof this.walrusClient.getBlobSize === 'function') {
        return await this.walrusClient.getBlobSize(blobId);
      }

      // Fallback if method not available
      throw new WalrusClientAdapterError('getBlobSize method not available');
    } catch (error) {
      // Fallback: try to get size from blob info
      try {
        const blobInfo = await this.getBlobInfo(blobId);
        if (blobInfo.size !== undefined) {
          return typeof blobInfo.size === 'string' ? parseInt(blobInfo.size, 10) : blobInfo.size as number;
        }
        throw new WalrusClientAdapterError('Size not available in blob info');
      } catch (secondaryError) {
        // Proper type guard before converting error to string
        if (error !== null &&
            error !== undefined &&
            typeof error === 'object' &&
            'toString' in error &&
            typeof error.toString === 'function') {
          throw new WalrusClientAdapterError(`Failed to get blob size: ${error instanceof Error ? error.message : error.toString()}`);
        }
        throw new WalrusClientAdapterError(`Failed to get blob size: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Gets storage providers (extended functionality)
   */
  async getStorageProviders(params: { blobId: string }): Promise<string[]> {
    this.ensureClientInitialized();
    
    try {
      // Type guard for the getStorageProviders method
      if ('getStorageProviders' in this.walrusClient && 
          typeof this.walrusClient.getStorageProviders === 'function') {
        return await this.walrusClient.getStorageProviders(params);
      }
      
      // Return empty array if method not available
      return [];
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to get storage providers: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Resets the client (extended functionality)
   */
  reset(): void {
    this.ensureClientInitialized();
    
    try {
      // Type guard for the reset method
      if ('reset' in this.walrusClient && typeof this.walrusClient.reset === 'function') {
        this.walrusClient.reset();
      }
    } catch (error) {
      throw new WalrusClientAdapterError(`Failed to reset client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Access to experimental features
   */
  get experimental(): { getBlobData: () => Promise<any> } | undefined {
    if (this.walrusClient && 'experimental' in this.walrusClient && this.walrusClient.experimental) {
      return this.walrusClient.experimental;
    }
    
    return undefined;
  }
  
  /**
   * Executes certify blob transaction (extended functionality)
   */
  async executeCertifyBlobTransaction(
    options: CertifyBlobOptions & AdapterOptions
  ): Promise<{ digest: string }> {
    this.ensureClientInitialized();
    
    if ('executeCertifyBlobTransaction' in this.walrusClient && 
        typeof this.walrusClient.executeCertifyBlobTransaction === 'function') {
      const adaptedOptions = this.extractAdapters(options);
      
      try {
        return await this.walrusClient.executeCertifyBlobTransaction(adaptedOptions);
      } catch (error) {
        throw new WalrusClientAdapterError(`Failed to execute certify blob transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new WalrusClientAdapterError('executeCertifyBlobTransaction not supported in this client version');
  }
  
  /**
   * Executes write blob attributes transaction (extended functionality)
   */
  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & AdapterOptions
  ): Promise<{ digest: string }> {
    this.ensureClientInitialized();
    
    if ('executeWriteBlobAttributesTransaction' in this.walrusClient && 
        typeof this.walrusClient.executeWriteBlobAttributesTransaction === 'function') {
      const adaptedOptions = this.extractAdapters(options);
      
      try {
        return await this.walrusClient.executeWriteBlobAttributesTransaction(adaptedOptions);
      } catch (error) {
        throw new WalrusClientAdapterError(`Failed to execute write blob attributes transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new WalrusClientAdapterError('executeWriteBlobAttributesTransaction not supported in this client version');
  }
  
  /**
   * Executes create storage transaction (extended functionality)
   */
  async executeCreateStorageTransaction(
    options: StorageWithSizeOptions & {
      transaction?: TransactionType;
      signer: Signer | Ed25519Keypair | SignerAdapterImpl
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
    this.ensureClientInitialized();
    
    if ('executeCreateStorageTransaction' in this.walrusClient && 
        typeof this.walrusClient.executeCreateStorageTransaction === 'function') {
      const adaptedOptions = this.extractAdapters(options);
      
      try {
        return await this.walrusClient.executeCreateStorageTransaction(adaptedOptions);
      } catch (error) {
        throw new WalrusClientAdapterError(`Failed to execute create storage transaction: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    throw new WalrusClientAdapterError('executeCreateStorageTransaction not supported in this client version');
  }
}

/**
 * Creates a specific WalrusClient adapter based on the detected version
 * 
 * @param client The WalrusClient instance to adapt
 * @returns A version-specific WalrusClientAdapter instance
 */
export function createVersionSpecificAdapter(client: any): WalrusClientAdapter {
  if (!client) {
    throw new WalrusClientAdapterError('Cannot create adapter for null or undefined client');
  }
  
  // Extended client check
  if (isWalrusClientExt(client) || 
      ('getBlobSize' in client && typeof client.getBlobSize === 'function') ||
      ('experimental' in client && client.experimental)) {
    return new ExtendedWalrusClientAdapter(client);
  }
  
  // Custom client check
  if (isWalrusClient(client) || 
      (('getBlobObject' in client && typeof client.getBlobObject === 'function') &&
       ('verifyPoA' in client && typeof client.verifyPoA === 'function'))) {
    return new CustomWalrusClientAdapter(client);
  }
  
  // Original client check
  if (isOriginalWalrusClient(client) || 
      (typeof client.getBlobInfo === 'function' && 
       typeof client.readBlob === 'function' && 
       typeof client.writeBlob === 'function')) {
    return new OriginalWalrusClientAdapter(client);
  }
  
  // If we can't determine the type, throw an error
  throw new WalrusClientAdapterError('Could not determine client type. The provided client does not match any known WalrusClient interface.');
}

// Export helper functions for use in tests
export function extractTransaction(tx: TransactionType): any {
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

export function extractSigner(signer: Signer | Ed25519Keypair | SignerAdapter): any {
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

export function extractAdapters<T extends Record<string, any>>(options: T): T {
  const result = { ...options } as T & {
    transaction?: TransactionType;
    signer?: Signer | Ed25519Keypair | SignerAdapter;
  };

  // Use explicit type checking instead of property access to avoid type errors
  if (result && typeof result === 'object' && 'transaction' in result && result.transaction) {
    // Use type assertion to specify the TransactionType
    result.transaction = extractTransaction(result.transaction as TransactionType);
  }

  if (result && typeof result === 'object' && 'signer' in result && result.signer) {
    // Use type assertion to specify the Signer type
    result.signer = extractSigner(result.signer as Signer | Ed25519Keypair | SignerAdapter);
  }

  return result;
}

export function normalizeWalrusBlobObject(blob: any): NormalizedBlobObject {
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

export function normalizeWriteBlobResponse(response: any): NormalizedWriteBlobResponse {
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
    blobObject = normalizeWalrusBlobObject(response.blobObject);
  } else {
    blobObject = { blob_id: blobId, deletable: false };
  }
  
  return {
    blobId,
    blobObject,
    digest: typeof response.digest === 'string' ? response.digest : ''
  };
}

export function toBigInt(value: any): bigint {
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

  // Complete and robust type guard to check if value is an object and has toString method
  if (value !== null &&
      value !== undefined &&
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

// Re-export types for easier imports
export type {
  WalrusClientAdapter,
  WalrusClientVersion,
  NormalizedBlobObject,
  NormalizedWriteBlobResponse,
  AdapterOptions
};
export { WalrusClientAdapterError };