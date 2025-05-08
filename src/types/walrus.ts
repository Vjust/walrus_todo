/**
 * Type definitions for Walrus blob storage integration
 */

import { TransactionBlock } from '@mysten/sui.js/transactions';
import { type Signer } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { type Transaction } from '@mysten/sui.js/transactions';

// Blob hash representation
export interface BlobHashPair {
  primary_hash: { Digest: Uint8Array, $kind: string };
  secondary_hash: { Digest: Uint8Array, $kind: string };
}

// Encoding type for blobs
export interface EncodingType {
  RedStuff: true;
  $kind: string;
}

// Metadata for blobs
export interface BlobMetadata {
  V1: {
    encoding_type: EncodingType;
    unencoded_length: string;
    hashes: BlobHashPair[];
    $kind: string;
  };
  $kind?: string;
}

// Shape of metadata for blobs
export interface BlobMetadataShape {
  blob_id: string;
  metadata: BlobMetadata;
}

// Information about a blob
export interface BlobInfo {
  blob_id: string;
  certified_epoch: number;
  registered_epoch: number;
  encoding_type: EncodingType;
  unencoded_length: string;
  size: string;
  hashes: BlobHashPair[];
  metadata: BlobMetadata;
}

// Blob object representation
export interface BlobObject {
  id: { id: string };
  registered_epoch: number;
  blob_id: string;
  size: string;
  encoding_type: number;
  certified_epoch: number;
  storage: {
    id: { id: string };
    storage_size: string;
    used_size: string;
    end_epoch: number;
    start_epoch: number;
  };
  deletable: boolean;
}

// Digest hash type
export type DigestHash = { Digest: Uint8Array, $kind: string };

// Hash type
export type HashType = 'primary' | 'secondary';

// Digest type
export type DigestType = 'Digest';

// Options for writing a blob
export interface WriteBlobOptions {
  blob: Uint8Array;
  signer: Signer | Ed25519Keypair;
  deletable?: boolean;
  epochs?: number;
  attributes?: Record<string, string>;
  transaction?: TransactionBlock;
  owner?: string;
  signal?: AbortSignal;
}

// Options for reading a blob
export interface ReadBlobOptions {
  blobId: string;
  signal?: AbortSignal;
}

// Options for storage with size
export interface StorageWithSizeOptions {
  size: number;
  epochs: number;
  walCoin?: any;
}

// Options for registering a blob
export interface RegisterBlobOptions {
  blobId: string;
  rootHash: Uint8Array;
  deletable: boolean;
  walCoin?: any;
  attributes?: Record<string, string>;
  size: number;
  epochs: number;
  owner: string;
}

// Options for certifying a blob
export interface CertifyBlobOptions {
  blobObjectId: string;
}

// Options for writing blob attributes
export interface WriteBlobAttributesOptions {
  blobObjectId: string;
  attributes: Record<string, string>;
}

// Options for deleting a blob
export interface DeleteBlobOptions {
  blobObjectId: string;
}

// Options for getting storage confirmation
export interface GetStorageConfirmationOptions {
  blobId: string;
  nodeIndex: number;
  nodeUrl?: string;
}

// Storage confirmation
export interface StorageConfirmation {
  confirmed: boolean;
  serializedMessage: string;
  signature: string;
}

// Transaction result
export interface TransactionResult {
  digest: string;
}

// WalrusClient interface
export interface WalrusClient {
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  getBlobInfo(blobId: string): Promise<BlobInfo>;
  getBlobObject(params: { blobId: string }): Promise<BlobObject>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  writeBlob(params: WriteBlobOptions): Promise<{ blobId?: string; blobObject: BlobObject | { blob_id: string } }>;
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
  ): Promise<StorageConfirmation>;
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
}