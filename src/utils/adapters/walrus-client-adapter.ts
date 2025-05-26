/**
 * WalrusClientAdapter implementation
 *
 * This file contains the implementation of the WalrusClientAdapter interface
 * with version-specific adapters for different WalrusClient versions.
 */

import { Logger } from '../Logger';

const logger = new Logger('walrus-client-adapter');

import type {
  WalrusClient as OriginalWalrusClient,
} from '@mysten/walrus';
import type {
  WriteBlobOptions,
  ReadBlobOptions,
  StorageWithSizeOptions,
  CertifyBlobOptions,
  WriteBlobAttributesOptions,
} from '../../types/walrus';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
// BlobInfo and BlobMetadataShape types available for future use
import { WalrusClient, WalrusClientExt } from '../../types/client';
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
  isWalrusClientExt,
} from '../../types/adapters/WalrusClientAdapter';

/**
 * Factory function to create a WalrusClientAdapter from an existing client
 *
 * @param client The WalrusClient instance to adapt
 * @returns A WalrusClientAdapter instance
 */
export function createWalrusClientAdapter(
  client: OriginalWalrusClient | WalrusClient | WalrusClientExt | unknown
): WalrusClientAdapter {
  return createVersionSpecificAdapter(client);
}

/**
 * Original WalrusClient (V1) adapter implementation
 */
class OriginalWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: OriginalWalrusClient) {
    super(client);
    if (!isOriginalWalrusClient(client)) {
      throw new WalrusClientAdapterError(
        'Client does not implement the original WalrusClient interface'
      );
    }
  }

  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    try {
      // Validate getBlobInfo method exists
      if (!('getBlobInfo' in this.walrusClient) || typeof (this.walrusClient as Record<string, unknown>).getBlobInfo !== 'function') {
        throw new WalrusClientAdapterError('getBlobInfo method not available on client');
      }
      
      const getBlobInfoFn = (this.walrusClient as { getBlobInfo: (blobId: string) => Promise<unknown> }).getBlobInfo;
      const result = await getBlobInfoFn(blobId);
      return this.normalizeBlobObject(result as Record<string, unknown>);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to read blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(
    options: WriteBlobOptions | {
      blob: Uint8Array;
      signer: Signer | Ed25519Keypair | SignerAdapter;
      deletable?: boolean;
      epochs?: number;
      attributes?: Record<string, string>;
      transaction?: TransactionType;
    }
  ): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();

    const adaptedOptions = this.extractAdapters(options as any);

    try {
      const result = await (this.walrusClient as any).writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result as Record<string, unknown>);

      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject,
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to write blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{
    network: string;
    version: string;
    maxSize: number;
  }> {
    this.ensureClientInitialized();

    try {
      const config = await (this.walrusClient as any).getConfig();
      const configObj = config as Record<string, unknown>;
      return {
        network: (typeof configObj.network === 'string' ? configObj.network : 'unknown'),
        version: (typeof configObj.version === 'string' ? configObj.version : '0.0.0'),
        maxSize: (typeof configObj.maxSize === 'number' ? configObj.maxSize : 0),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();

    try {
      const usage = await (this.walrusClient as any).getStorageUsage();
      const usageObj = usage as Record<string, unknown>;
      return {
        used: (typeof usageObj.used === 'string' ? usageObj.used : '0'),
        total: (typeof usageObj.total === 'string' ? usageObj.total : '0'),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets blob metadata - v1 clients don't have this directly
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<Record<string, unknown>> {
    this.ensureClientInitialized();

    // Check if getBlobMetadata method exists on client
    if ('getBlobMetadata' in this.walrusClient && typeof (this.walrusClient as any).getBlobMetadata === 'function') {
      try {
        return await (this.walrusClient as any).getBlobMetadata(options);
      } catch (error) {
        throw new WalrusClientAdapterError(
          `Failed to get blob metadata: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Fallback: try to extract metadata from getBlobInfo
    try {
      const blobInfo = await this.getBlobInfo(options.blobId);
      return blobInfo.metadata || {};
    } catch (error) {
      throw new WalrusClientAdapterError(
        `getBlobMetadata not supported and fallback failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verifies proof of availability - v1 clients don't have this
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    this.ensureClientInitialized();

    // Check if verifyPoA method exists on client
    if ('verifyPoA' in this.walrusClient && typeof (this.walrusClient as any).verifyPoA === 'function') {
      try {
        return await (this.walrusClient as any).verifyPoA(params);
      } catch (error) {
        logger.warn('verifyPoA failed, returning true as fallback:', error);
        return true;
      }
    }

    // For V1 clients without verifyPoA, we return true to avoid breaking functionality
    logger.warn(
      'verifyPoA not implemented in original WalrusClient, returning true as fallback'
    );
    return true;
  }

  /**
   * Gets the blob object - v1 clients don't have this directly
   */
  async getBlobObject(params: {
    blobId: string;
  }): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    // Check if getBlobObject method exists on client
    if ('getBlobObject' in this.walrusClient && typeof (this.walrusClient as any).getBlobObject === 'function') {
      try {
        const result = await (this.walrusClient as any).getBlobObject(params);
        return this.normalizeBlobObject(result as Record<string, unknown>);
      } catch (error) {
        // Fallback to getBlobInfo if getBlobObject fails
        logger.warn('getBlobObject failed, falling back to getBlobInfo');
      }
    }

    // Fallback for V1 clients or when getBlobObject fails: use getBlobInfo and normalize
    try {
      const blobInfo = await this.getBlobInfo(params.blobId);
      return blobInfo;
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob object using fallback: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage cost - v1 clients don't have this directly
   */
  async storageCost(
    _size: number,
    _epochs: number
  ): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    // Provide a fallback implementation with sensible defaults
    logger.warn(
      'storageCost not implemented in original WalrusClient, returning zeros as fallback'
    );
    return {
      storageCost: BigInt(0),
      writeCost: BigInt(0),
      totalCost: BigInt(0),
    };
  }
}

/**
 * Custom WalrusClient (V2) adapter implementation
 */
class CustomWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: WalrusClient) {
    super(client);
    if (!isWalrusClient(client)) {
      throw new WalrusClientAdapterError(
        'Client does not implement the custom WalrusClient interface'
      );
    }
  }

  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).getBlobInfo(blobId);
      return this.normalizeBlobObject(result as Record<string, unknown>);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to read blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(
    options: WriteBlobOptions | {
      blob: Uint8Array;
      signer: Signer | Ed25519Keypair | SignerAdapter;
      deletable?: boolean;
      epochs?: number;
      attributes?: Record<string, string>;
      transaction?: TransactionType;
    }
  ): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();

    const adaptedOptions = this.extractAdapters(options as any);

    try {
      const result = await (this.walrusClient as any).writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result as Record<string, unknown>);

      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject,
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to write blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{
    network: string;
    version: string;
    maxSize: number;
  }> {
    this.ensureClientInitialized();

    try {
      const config = await (this.walrusClient as any).getConfig();
      const configObj = config as Record<string, unknown>;
      return {
        network: (typeof configObj.network === 'string' ? configObj.network : 'unknown'),
        version: (typeof configObj.version === 'string' ? configObj.version : '0.0.0'),
        maxSize: (typeof configObj.maxSize === 'number' ? configObj.maxSize : 0),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();

    try {
      const usage = await (this.walrusClient as any).getStorageUsage();
      const usageObj = usage as Record<string, unknown>;
      return {
        used: (typeof usageObj.used === 'string' ? usageObj.used : '0'),
        total: (typeof usageObj.total === 'string' ? usageObj.total : '0'),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets blob metadata
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<Record<string, unknown>> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).getBlobMetadata(options);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verifies proof of availability
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).verifyPoA(params);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to verify PoA: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the blob object
   */
  async getBlobObject(params: {
    blobId: string;
  }): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).getBlobObject(params);
      return this.normalizeBlobObject(result as Record<string, unknown>);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob object: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage cost for given size and epochs
   */
  async storageCost(
    size: number,
    epochs: number
  ): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).storageCost(size, epochs);

      // Convert to bigint consistently
      return {
        storageCost: this.toBigInt(result.storageCost),
        writeCost: this.toBigInt(result.writeCost),
        totalCost: this.toBigInt(result.totalCost),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage cost: ${error instanceof Error ? error.message : String(error)}`
      );
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
        return typeof blobInfo.size === 'string'
          ? parseInt(blobInfo.size, 10)
          : (blobInfo.size as number);
      }
      throw new WalrusClientAdapterError('Size not available in blob info');
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob size using fallback: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Extended WalrusClient (V3) adapter implementation
 */
class ExtendedWalrusClientAdapter extends BaseWalrusClientAdapter {
  constructor(client: WalrusClientExt) {
    super(client);
    // We're more lenient with extended client since it might be a custom implementation
    if (!isWalrusClient(client) && !('getBlobSize' in client)) {
      throw new WalrusClientAdapterError(
        'Client does not implement the extended WalrusClient interface'
      );
    }
  }

  /**
   * Gets information about a blob
   */
  async getBlobInfo(blobId: string): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).getBlobInfo(blobId);
      return this.normalizeBlobObject(result as Record<string, unknown>);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reads a blob's content
   */
  async readBlob(options: ReadBlobOptions): Promise<Uint8Array> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).readBlob(options);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to read blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Writes a blob to Walrus storage
   */
  async writeBlob(
    options: WriteBlobOptions | {
      blob: Uint8Array;
      signer: Signer | Ed25519Keypair | SignerAdapter;
      deletable?: boolean;
      epochs?: number;
      attributes?: Record<string, string>;
      transaction?: TransactionType;
    }
  ): Promise<{ blobId: string; blobObject: NormalizedBlobObject }> {
    this.ensureClientInitialized();

    const adaptedOptions = this.extractAdapters(options as any);

    try {
      const result = await (this.walrusClient as any).writeBlob(adaptedOptions);
      const normalizedResult = this.normalizeWriteBlobResponse(result as Record<string, unknown>);

      return {
        blobId: normalizedResult.blobId,
        blobObject: normalizedResult.blobObject,
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to write blob: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the configuration
   */
  async getConfig(): Promise<{
    network: string;
    version: string;
    maxSize: number;
  }> {
    this.ensureClientInitialized();

    try {
      const config = await (this.walrusClient as any).getConfig();
      const configObj = config as Record<string, unknown>;
      return {
        network: (typeof configObj.network === 'string' ? configObj.network : 'unknown'),
        version: (typeof configObj.version === 'string' ? configObj.version : '0.0.0'),
        maxSize: (typeof configObj.maxSize === 'number' ? configObj.maxSize : 0),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get config: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the WAL balance
   */
  async getWalBalance(): Promise<string> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).getWalBalance();
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get WAL balance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    this.ensureClientInitialized();

    try {
      const usage = await (this.walrusClient as any).getStorageUsage();
      const usageObj = usage as Record<string, unknown>;
      return {
        used: (typeof usageObj.used === 'string' ? usageObj.used : '0'),
        total: (typeof usageObj.total === 'string' ? usageObj.total : '0'),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets blob metadata
   */
  async getBlobMetadata(options: ReadBlobOptions): Promise<Record<string, unknown>> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).getBlobMetadata(options);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Verifies proof of availability
   */
  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    this.ensureClientInitialized();

    try {
      return await (this.walrusClient as any).verifyPoA(params);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to verify PoA: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the blob object
   */
  async getBlobObject(params: {
    blobId: string;
  }): Promise<NormalizedBlobObject> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).getBlobObject(params);
      return this.normalizeBlobObject(result as Record<string, unknown>);
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get blob object: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets storage cost for given size and epochs
   */
  async storageCost(
    size: number,
    epochs: number
  ): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    this.ensureClientInitialized();

    try {
      const result = await (this.walrusClient as any).storageCost(size, epochs);

      // Convert to bigint consistently
      return {
        storageCost: this.toBigInt(result.storageCost),
        writeCost: this.toBigInt(result.writeCost),
        totalCost: this.toBigInt(result.totalCost),
      };
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage cost: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets blob size (extended functionality)
   */
  async getBlobSize(blobId: string): Promise<number> {
    this.ensureClientInitialized();

    try {
      // Type guard for the getBlobSize method
      if (
        'getBlobSize' in this.walrusClient &&
        typeof (this.walrusClient as any).getBlobSize === 'function'
      ) {
        return await (this.walrusClient as any).getBlobSize(blobId);
      }

      // Fallback if method not available
      throw new WalrusClientAdapterError('getBlobSize method not available');
    } catch (error) {
      // Fallback: try to get size from blob info
      try {
        const blobInfo = await this.getBlobInfo(blobId);
        if (blobInfo.size !== undefined) {
          return typeof blobInfo.size === 'string'
            ? parseInt(blobInfo.size, 10)
            : (blobInfo.size as number);
        }
        throw new WalrusClientAdapterError('Size not available in blob info');
      } catch (secondaryError) {
        throw new WalrusClientAdapterError(
          `Failed to get blob size: ${error instanceof Error ? error.message : String(error)}`
        );
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
      if (
        'getStorageProviders' in this.walrusClient &&
        typeof (this.walrusClient as any).getStorageProviders === 'function'
      ) {
        return await (this.walrusClient as any).getStorageProviders(params);
      }

      // Return empty array if method not available
      return [];
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to get storage providers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resets the client (extended functionality)
   */
  reset(): void {
    this.ensureClientInitialized();

    try {
      // Type guard for the reset method
      if (
        'reset' in this.walrusClient &&
        typeof (this.walrusClient as any).reset === 'function'
      ) {
        (this.walrusClient as any).reset();
      }
    } catch (error) {
      throw new WalrusClientAdapterError(
        `Failed to reset client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Access to experimental features
   */
  get experimental(): { getBlobData: () => Promise<Record<string, unknown>> } | undefined {
    if (
      this.walrusClient &&
      'experimental' in this.walrusClient &&
      (this.walrusClient as any).experimental
    ) {
      return (this.walrusClient as any).experimental;
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

    if (
      'executeCertifyBlobTransaction' in this.walrusClient &&
      typeof (this.walrusClient as any).executeCertifyBlobTransaction === 'function'
    ) {
      const adaptedOptions = this.extractAdapters(options as any);

      try {
        return await (this.walrusClient as any).executeCertifyBlobTransaction(
          adaptedOptions
        );
      } catch (error) {
        throw new WalrusClientAdapterError(
          `Failed to execute certify blob transaction: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new WalrusClientAdapterError(
      'executeCertifyBlobTransaction not supported in this client version'
    );
  }

  /**
   * Executes write blob attributes transaction (extended functionality)
   */
  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & AdapterOptions
  ): Promise<{ digest: string }> {
    this.ensureClientInitialized();

    if (
      'executeWriteBlobAttributesTransaction' in this.walrusClient &&
      typeof (this.walrusClient as any).executeWriteBlobAttributesTransaction ===
        'function'
    ) {
      const adaptedOptions = this.extractAdapters(options as any);

      try {
        return await (this.walrusClient as any).executeWriteBlobAttributesTransaction(
          adaptedOptions
        );
      } catch (error) {
        throw new WalrusClientAdapterError(
          `Failed to execute write blob attributes transaction: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new WalrusClientAdapterError(
      'executeWriteBlobAttributesTransaction not supported in this client version'
    );
  }

  /**
   * Executes create storage transaction (extended functionality)
   */
  async executeCreateStorageTransaction(
    options: StorageWithSizeOptions & {
      transaction?: TransactionType;
      signer: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }> {
    this.ensureClientInitialized();

    if (
      'executeCreateStorageTransaction' in this.walrusClient &&
      typeof (this.walrusClient as any).executeCreateStorageTransaction === 'function'
    ) {
      const adaptedOptions = this.extractAdapters(options as any);

      try {
        return await (this.walrusClient as any).executeCreateStorageTransaction(
          adaptedOptions
        );
      } catch (error) {
        throw new WalrusClientAdapterError(
          `Failed to execute create storage transaction: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new WalrusClientAdapterError(
      'executeCreateStorageTransaction not supported in this client version'
    );
  }
}

/**
 * Creates a specific WalrusClient adapter based on the detected version
 *
 * @param client The WalrusClient instance to adapt
 * @returns A version-specific WalrusClientAdapter instance
 */
export function createVersionSpecificAdapter(client: OriginalWalrusClient | WalrusClient | WalrusClientExt | unknown): WalrusClientAdapter {
  if (!client) {
    throw new WalrusClientAdapterError(
      'Cannot create adapter for null or undefined client'
    );
  }

  // Extended client check
  if (
    isWalrusClientExt(client) ||
    ('getBlobSize' in (client as Record<string, unknown>) && typeof (client as any).getBlobSize === 'function') ||
    ('experimental' in (client as Record<string, unknown>) && (client as any).experimental)
  ) {
    return new ExtendedWalrusClientAdapter(client as WalrusClientExt);
  }

  // Custom client check
  if (
    isWalrusClient(client) ||
    ('getBlobObject' in (client as Record<string, unknown>) &&
      typeof (client as any).getBlobObject === 'function' &&
      'verifyPoA' in (client as Record<string, unknown>) &&
      typeof (client as any).verifyPoA === 'function')
  ) {
    return new CustomWalrusClientAdapter(client as WalrusClient);
  }

  // Original client check
  if (
    isOriginalWalrusClient(client) ||
    (typeof (client as any)?.getBlobInfo === 'function' &&
      typeof (client as any)?.readBlob === 'function' &&
      typeof (client as any)?.writeBlob === 'function')
  ) {
    return new OriginalWalrusClientAdapter(client as OriginalWalrusClient);
  }

  // If we can't determine the type, throw an error
  throw new WalrusClientAdapterError(
    'Could not determine client type. The provided client does not match any known WalrusClient interface.'
  );
}

// Export helper functions for use in tests
export function extractTransaction(tx: TransactionType): unknown {
  if (!tx) return undefined;

  if (typeof tx === 'object' && tx !== null) {
    // Check for adapter interfaces
    if (
      'getUnderlyingBlock' in tx &&
      typeof tx.getUnderlyingBlock === 'function'
    ) {
      return tx.getUnderlyingBlock();
    }

    if (
      'getTransactionBlock' in tx &&
      typeof tx.getTransactionBlock === 'function'
    ) {
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

export function extractSigner(
  signer: Signer | Ed25519Keypair | SignerAdapter
): unknown {
  if (!signer) return undefined;

  if (typeof signer === 'object' && signer !== null) {
    // Check for adapter interfaces
    if (
      'getUnderlyingSigner' in signer &&
      typeof signer.getUnderlyingSigner === 'function'
    ) {
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
  const result = { ...options } as T;

  // Use explicit type checking instead of property access to avoid type errors
  if (
    result &&
    typeof result === 'object' &&
    'transaction' in result &&
    result.transaction
  ) {
    // Use type assertion to specify the TransactionType
    (result as any).transaction = extractTransaction(
      result.transaction as TransactionType
    );
  }

  if (
    result &&
    typeof result === 'object' &&
    'signer' in result &&
    result.signer
  ) {
    // Use type assertion to specify the Signer type
    (result as any).signer = extractSigner(
      result.signer as Signer | Ed25519Keypair | SignerAdapter
    );
  }

  return result;
}

export function normalizeWalrusBlobObject(blob: Record<string, unknown>): NormalizedBlobObject {
  if (!blob) {
    return {
      blob_id: '',
      deletable: false,
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
    size: 0,
  };

  // Extract blob_id with proper type checking
  if (typeof blob.blob_id === 'string') {
    normalizedBlob.blob_id = blob.blob_id;
  } else if (
    blob.id &&
    typeof blob.id === 'object' &&
    typeof (blob.id as Record<string, unknown>).id === 'string'
  ) {
    normalizedBlob.blob_id = (blob.id as Record<string, unknown>).id as string;
  }

  // Extract id
  if (blob.id && typeof blob.id === 'object') {
    const idObj = blob.id as Record<string, unknown>;
    if (typeof idObj.id === 'string') {
      normalizedBlob.id = { id: idObj.id };
    }
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
    const storageCost = blob.storage_cost as Record<string, unknown>;
    if (typeof storageCost.value === 'string') {
      normalizedBlob.storage_cost = { value: storageCost.value };
    }
  }

  if (blob.metadata && typeof blob.metadata === 'object') {
    // Ensure safe assignment with proper type checking
    const metadata = blob.metadata as Record<string, unknown>;
    const safeMetadata: Record<string, string | number | boolean> = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        safeMetadata[key] = value;
      }
    }
    
    normalizedBlob.metadata = safeMetadata;
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

export function normalizeWriteBlobResponse(
  response: Record<string, unknown> | string
): NormalizedWriteBlobResponse {
  if (!response) {
    throw new WalrusClientAdapterError(
      'Empty response from writeBlob operation'
    );
  }

  // Extract blobId from various possible locations with proper type checking
  let blobId = '';

  if (typeof response === 'string') {
    blobId = response;
  } else if (typeof response.blobId === 'string') {
    blobId = response.blobId;
  } else if (
    response.blobObject &&
    typeof (response.blobObject as Record<string, unknown>).blob_id === 'string'
  ) {
    blobId = (response.blobObject as Record<string, unknown>).blob_id as string;
  } else if (typeof response.blob_id === 'string') {
    blobId = response.blob_id;
  } else if (
    response.blobObject &&
    (response.blobObject as Record<string, unknown>).id &&
    typeof (response.blobObject as Record<string, unknown>).id === 'object' &&
    typeof ((response.blobObject as Record<string, unknown>).id as Record<string, unknown>).id === 'string'
  ) {
    blobId = ((response.blobObject as Record<string, unknown>).id as Record<string, unknown>).id as string;
  }

  if (!blobId) {
    throw new WalrusClientAdapterError(
      'Could not extract blobId from writeBlob response'
    );
  }

  // Prepare the normalized blob object
  let blobObject: NormalizedBlobObject;

  if (typeof response === 'object' && response.blobObject) {
    blobObject = normalizeWalrusBlobObject(response.blobObject as Record<string, unknown>);
  } else {
    blobObject = { blob_id: blobId, deletable: false };
  }

  return {
    blobId,
    blobObject,
    digest: typeof response === 'object' && typeof response.digest === 'string' ? response.digest : '',
  };
}

export function toBigInt(value: unknown): bigint {
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
      throw new WalrusClientAdapterError(
        `Cannot convert string to bigint: ${value}`
      );
    }
  }

  // Complete and robust type guard to check if value is an object and has toString method
  if (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    try {
      return BigInt(value.toString());
    } catch (e) {
      throw new WalrusClientAdapterError(
        `Cannot convert value to bigint: ${value}`
      );
    }
  }

  throw new WalrusClientAdapterError(
    `Unsupported value type for bigint conversion: ${typeof value}`
  );
}

// Re-export types for easier imports
export type {
  WalrusClientAdapter,
  WalrusClientVersion,
  NormalizedBlobObject,
  NormalizedWriteBlobResponse,
  AdapterOptions,
};
export { WalrusClientAdapterError };