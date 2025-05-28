import type { Keypair, Signer } from '@mysten/sui/cryptography';

export type ExpiryHandler = (expiringBlobs: BlobRecord[]) => Promise<void>;

export interface BlobRecord {
  blobId: string;
  vaultId: string;
  fileName: string;
  size: number;
  mimeType: string;
  checksum: string;
  uploadedAt: string;
  expiresAt: string;
}

export interface StorageResponse {
  id: { id: string };
  start_epoch: number;
  end_epoch: number;
  storage_size: string;
}

export interface StorageConfig {
  signer?: Signer;
  network?: {
    environment: 'testnet' | 'mainnet';
    autoSwitch: boolean;
  };
  minAllocation?: bigint;
  checkThreshold?: number;
  checkInterval?: number;
  warningThreshold?: number;
  autoRenewThreshold?: number;
  renewalPeriod?: number;
}

declare module '@mysten/walrus' {
  export type SignerType = Keypair;

  export type Transaction = { $kind: string };

  export interface StorageWithSizeOptions {
    size: number;
    epochs: number;
    owner: string;
    signer: SignerType;
  }

  export interface WriteBlobOptions {
    blob: Uint8Array;
    deletable?: boolean;
    epochs: number;
    signer: SignerType;
    signal?: AbortSignal;
    owner: string;
    attributes?: Record<string, string>;
  }

  export interface ReadBlobOptions {
    blobId: string;
    signal?: AbortSignal;
  }

  export type BlobObject = {
    id: { id: string };
    registered_epoch: number;
    blob_id: string;
    size: string;
    encoding_type: number;
    cert_epoch?: number;
    certified_epoch?: number | null;
    storage: {
      id: { id: string };
      storage_size: string;
      used_size: string;
      end_epoch: number;
      start_epoch: number;
    };
    deletable: boolean;
    metadata?: any;
  };

  export type EnumOutputShapeWithKeys<T extends object, K extends keyof T> = {
    [P in keyof T]: boolean;
  } & { $kind: K };

  export type EncodingType =
    | { RedStuff: true; RS2: false; $kind: 'RedStuff' }
    | { RedStuff: false; RS2: true; $kind: 'RS2' };

  export interface BlobMetadata {
    blob_id: string;
    metadata: {
      V1: {
        encoding_type: EncodingType;
        unencoded_length: string;
        hashes: Array<{
          primary_hash: { Digest: Uint8Array; $kind: 'Digest' };
          secondary_hash: { Digest: Uint8Array; $kind: 'Digest' };
        }>;
        $kind: 'V1';
      };
      $kind: 'V1';
    };
  }

  export interface WalrusClient {
    getConfig(): Promise<{
      network: string;
      version: string;
      maxSize: number;
    }>;

    executeCreateStorageTransaction(
      options: StorageWithSizeOptions & {
        transaction?: Transaction;
        signer: SignerType;
      }
    ): Promise<{
      digest: string;
      storage: {
        id: { id: string };
        start_epoch: number;
        end_epoch: number;
        storage_size: string;
      };
    }>;

    writeBlob(options: WriteBlobOptions): Promise<{
      blobId: string;
      blobObject: BlobObject;
    }>;

    readBlob(options: ReadBlobOptions): Promise<Uint8Array>;

    getBlobObject(blobId: string): Promise<BlobObject>;

    verifyPoA(blobId: string): Promise<boolean>;

    getBlobMetadata(options: ReadBlobOptions): Promise<BlobMetadata>;

    getWalBalance(): Promise<string>;

    getStorageUsage(): Promise<{
      used: string;
      total: string;
    }>;
  }
}
