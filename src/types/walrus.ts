import type { StorageWithSizeOptions, ReadBlobOptions, WriteBlobOptions, WalrusClientConfig } from '@mysten/walrus';
import type { TransactionBlock } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs';
import type { SuiClient } from '@mysten/sui/client';

export type EncodingType = { RedStuff: true; $kind: 'RedStuff' };
export type DigestHash = {
  Digest: Uint8Array;
  $kind: 'Digest';
};

export type Hash = DigestHash;
export type BlobHashPair = {
  primary_hash: Hash;
  secondary_hash: Hash;
};

export interface BlobObject {
  id: { id: string };
  registered_epoch: number;
  blob_id: string;
  size: string;
  encoding_type: number;
  certified_epoch: number | null;
  storage: {
    id: { id: string };
    storage_size: string;
    used_size: string;
    end_epoch: number;
    start_epoch: number;
  };
  deletable: boolean;
}

export interface BlobInfo {
  blob_id: string;
  certified_epoch?: number;
  registered_epoch: number;
  encoding_type: EncodingType;
  unencoded_length: string;
  hashes: BlobHashPair[];
  metadata: {
    V1: {
      encoding_type: EncodingType;
      unencoded_length: string;
      hashes: BlobHashPair[];
      $kind: 'V1';
    };
  };
}

export interface BlobMetadata {
  V1: {
    encoding_type: EncodingType;
    unencoded_length: string;
    hashes: BlobHashPair[];
    $kind: 'V1';
  }
  $kind: 'V1';
}

export interface BlobMetadataShape {
  blob_id: string;
  metadata: {
    V1: {
      encoding_type: EncodingType;
      unencoded_length: string;
      hashes: BlobHashPair[];
      $kind: 'V1';
    }
    $kind: 'V1';
  };
};

export interface BaseWalrusClientConfig {
  network: "testnet" | "mainnet";
  suiClient?: SuiClient;
  suiRpcUrl?: string;
}

export interface WalrusClient {
  executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: TransactionBlock; signer: Ed25519Keypair }): Promise<{ digest: string; storage: { id: { id: string }; start_epoch: number; end_epoch: number; storage_size: string; } }>;
  getConfig(): Promise<{ network: string; version: string; maxSize: number }>;
  getWalBalance(): Promise<string>;
  getStorageUsage(): Promise<{ used: string; total: string }>;
  getBlobInfo(blobId: string): Promise<{
    blob_id: string;
    certified_epoch?: number;
    registered_epoch: number;
    encoding_type: EncodingType;
    unencoded_length: string;
    hashes: BlobHashPair[];
    metadata?: {
      V1: BlobMetadata;
    };
  }>;
  getBlobObject(params: { blobId: string }): Promise<BlobObject>;
  verifyPoA(params: { blobId: string }): Promise<boolean>;
  writeBlob(params: WriteBlobOptions): Promise<{
    blobId: string;
    blobObject: BlobObject;
  }>;
  
  readBlob({ blobId, signal }: ReadBlobOptions): Promise<Uint8Array>;
  getBlobMetadata({ blobId, signal }: ReadBlobOptions): Promise<BlobMetadataShape>;
  storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }>;
}