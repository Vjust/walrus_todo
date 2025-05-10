/**
 * Extended WalrusClient interfaces with additional functionality
 */

import type { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';
import type { 
  BlobObject, 
  BlobInfo, 
  BlobMetadataShape, 
  ReadBlobOptions, 
  StorageWithSizeOptions, 
  CertifyBlobOptions, 
  WriteBlobAttributesOptions, 
  DeleteBlobOptions, 
  RegisterBlobOptions, 
  GetStorageConfirmationOptions, 
  StorageConfirmation 
} from './walrus';
import type { SignerAdapter } from './adapters/SignerAdapter';
import type { TransactionBlockAdapter } from './adapters/TransactionBlockAdapter';

/**
 * Extended WalrusClient interface with additional methods
 * This interface adds functionality beyond the standard WalrusClient
 */
export interface WalrusClientExt {
  // Original WalrusClient methods (copied from the WalrusClient interface)
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  getBlobInfo(blobId: string): Promise<BlobInfo>;
  getBlobObject(params: { blobId: string }): Promise<BlobObject>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  readBlob(params: ReadBlobOptions): Promise<Uint8Array>;
  getBlobMetadata(params: ReadBlobOptions): Promise<BlobMetadataShape>;
  storageCost(size: number, epochs: number): Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>;
  executeCreateStorageTransaction(
    options: StorageWithSizeOptions & { 
      transaction?: TransactionBlock; 
      signer: Signer | Ed25519Keypair;
    }
  ): Promise<{ digest: string; storage: { id: { id: string }; start_epoch: number; end_epoch: number; storage_size: string; } }>;
  executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionBlock;
      signer?: Signer | Ed25519Keypair;
    }
  ): Promise<{ digest: string }>;
  executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionBlock;
      signer?: Signer | Ed25519Keypair;
    }
  ): Promise<{ digest: string }>;
  deleteBlob(options: DeleteBlobOptions): (tx: TransactionBlock) => Promise<{ digest: string }>;
  executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionBlock;
      signer?: Signer | Ed25519Keypair;
    }
  ): Promise<{ blob: BlobObject; digest: string; }>;
  getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ primary_verification: boolean; secondary_verification?: boolean; provider: string; signature?: string }>;
  createStorageBlock(size: number, epochs: number): Promise<TransactionBlock>;
  createStorage(options: StorageWithSizeOptions): (tx: TransactionBlock) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }>;
  
  // Extension methods
  getBlobSize(blobId: string): Promise<number>;
  getStorageProviders(params: { blobId: string }): Promise<string[]>;
  
  // Enhanced blob writing with additional options
  writeBlob(params: { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionBlock | TransactionBlockAdapter;
  }): Promise<{
    blobId: string; // Changed from optional to required
    blobObject: BlobObject | { blob_id: string }
  }>;
  
  // Utility methods
  reset(): void;
  
  // Experimental API for newer features
  experimental?: {
    getBlobData: () => Promise<any>;
  };
}

/**
 * Minimal WalrusClient interface to support combination
 * This interface ensures all methods required by adapters are defined
 */
export interface WalrusClient {
  // Basic WalrusClient methods
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  
  // Blob operations
  readBlob(params: ReadBlobOptions): Promise<Uint8Array>;
  writeBlob(options: any): Promise<any>;
  getBlobInfo(blobId: string): Promise<any>;
  getBlobObject(params: { blobId: string }): Promise<any>;
  getBlobMetadata(params: ReadBlobOptions): Promise<any>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  getBlobSize(blobId: string): Promise<number>;
  
  // Storage cost calculation
  storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }>;
}

/**
 * Combined WalrusClient type that implements both interfaces
 */
export type WalrusClientWithExt = WalrusClient & WalrusClientExt;