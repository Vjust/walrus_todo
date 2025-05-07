import type { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Signer } from '@mysten/sui.js/signers';
import type { StorageWithSizeOptions, ReadBlobOptions, WriteBlobOptions } from '@mysten/walrus';
import type { BlobObject, BlobInfo, BlobMetadataShape } from './walrus';

/**
 * Extended Walrus client interface
 */
export interface WalrusClientExt {
  executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: TransactionBlock; signer: Signer }): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }>;
  
  getConfig(): Promise<{
    network: string;
    version: string;
    maxSize: number;
  }>;

  getWalBalance(): Promise<string>;
  
  getStorageUsage(): Promise<{
    used: string;
    total: string;
  }>;

  getBlobObject(params: { blobId: string }): Promise<BlobObject>;

  getBlobInfo(blobId: string): Promise<BlobInfo>;
  
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  
  writeBlob(params: WriteBlobOptions): Promise<{
    blobId: string;
    blobObject: BlobObject;
  }>;
  
  readBlob(options: ReadBlobOptions): Promise<Uint8Array>;
  
  getBlobMetadata(options: ReadBlobOptions): Promise<BlobMetadataShape>;
  
  storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }>;

  getStorageProviders(blobId: string): Promise<string[]>;

  getSuiBalance(address: string): Promise<string>;

  allocateStorage(size: string, signer: Signer): Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    };
  }>;
}