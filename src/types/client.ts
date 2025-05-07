import { type WalrusClient } from '@mysten/walrus';
import { type TransactionBlock } from '@mysten/sui.js/transactions';
import { type Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { type Signer } from '@mysten/sui.js/cryptography';
import { type BlobObject, type BlobInfo, type BlobMetadataShape, type StorageWithSizeOptions } from './walrus';
import { type SuiClient } from '@mysten/sui.js/client';

export interface WalrusClientExt {
  experimental?: {
    getBlobData: () => Promise<any>;
  };
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  getBlobObject(params: { blobId: string }): Promise<BlobObject>;
  getBlobInfo(blobId: string): Promise<BlobInfo>;
  createStorageBlock(size: number, epochs: number): Promise<TransactionBlock>;
  writeBlob(params: { blob: Uint8Array; signer: Signer; deletable?: boolean; epochs?: number; attributes?: Record<string, string>; transaction?: TransactionBlock }): Promise<{ blobObject: { blob_id: string } }>;
  getBlobSize(blobId: string): Promise<number>;
  readBlob(params: { blobId: string; signal?: AbortSignal }): Promise<Uint8Array>;
  getBlobMetadata(params: { blobId: string; signal?: AbortSignal }): Promise<BlobMetadataShape>;
  getStorageProviders(params: { blobId: string }): Promise<string[]>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: TransactionBlock; signer: Signer }): Promise<{ digest: string; storage: { id: { id: string }; start_epoch: number; end_epoch: number; storage_size: string } }>;
  reset(): void;
}

export type WalrusClientWithExt = WalrusClient & WalrusClientExt;