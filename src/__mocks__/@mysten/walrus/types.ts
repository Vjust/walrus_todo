import type { TransactionBlock } from '@mysten/sui';
import type { Signer } from '@mysten/sui';

export type EnumOutputShapeWithKeys<T extends Record<string, true>, K extends keyof T> = {
  [P in K]: T[P];
} & { kind: K };

export interface Hash {
  primary_hash: DigestHash;
  secondary_hash: DigestHash;
}

export interface DigestHash {
  Digest: Uint8Array;
  kind: 'Digest';
}

export interface StorageObject {
  id: { id: string };
  start_epoch: number;
  end_epoch: number;
  storage_size: string;
}

export interface BlobObject {
  id: { id: string };
  blob_id: string;
  registered_epoch: number;
  certified_epoch: number | null;
  storage: StorageObject;
  size: string;
  encoding_type: number;
  deletable: boolean;
}

export interface BlobMetadata {
  blob_id: string;
  metadata: {
    V1: {
      encoding_type: EnumOutputShapeWithKeys<{ RedStuff: true; RS2: true }, 'RedStuff' | 'RS2'>;
      unencoded_length: string;
      hashes: Array<Hash>;
      kind: 'V1';
    };
    kind: 'V1';
  };
}

export interface StorageCreateResponse {
  digest: string;
  storage: StorageObject;
}

export interface StorageCostResponse {
  storageCost: bigint;
  writeCost: bigint;
  totalCost: bigint;
}

export interface Config {
  network: string;
  version: string;
  maxSize: number;
}

export type SignerType = Keypair;