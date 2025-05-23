/**
 * Type definitions for Walrus client interfaces and responses
 */

import { Signer } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction as TransactionBlock } from '@mysten/sui/transactions';
import { Transaction } from './transaction';

// Walrus blob object structure
export interface BlobObject {
  blob_id: string;
  id?: {
    id: string;
  };
  registered_epoch?: number;
  storage_cost?: {
    value: string;
  };
  storage_rebate?: {
    value: string;
  };
  size?: string;
  deletable?: boolean;
  cert_epoch?: number;
  metadata?: BlobMetadataShape;
  provider_count?: number;
  slivers?: number;
  attributes?: Record<string, string>;
  checksum?: {
    primary: string;
    secondary?: string;
  };
}

// Blob info structure returned by Walrus API
export interface BlobInfo extends BlobObject {
  certified_epoch: number;
}

// Blob metadata structure
export enum HashType {
  SHA256 = 'Sha256',
  DIGEST = 'Digest'
}

export enum DigestType {
  SHA256 = 'Sha256',
  SHA512 = 'SHA512',
  BLAKE2B = 'BLAKE2B'
}

export interface BlobMetadataShape {
  blob_id?: string; // Optional field for compatibility with some implementations
  metadata?: {
    V1: {
      $kind: 'V1';
      encoding_type: {
        RedStuff: true;
        $kind: string;
      };
      unencoded_length: string;
      hashes: {
        primary_hash: {
          Digest: Uint8Array;
          $kind: string;
        };
        secondary_hash: {
          Sha256: Uint8Array;
          $kind: string;
        };
      }[];
    };
    $kind: 'V1';
  };
  V1: {
    $kind: 'V1';
    encoding_type: {
      RedStuff: true;
      $kind: string;
    };
    unencoded_length: string;
    hashes: {
      primary_hash: {
        Digest: Uint8Array;
        $kind: string;
      };
      secondary_hash: {
        Sha256: Uint8Array;
        $kind: string;
      };
    }[];
  };
  $kind: 'V1';
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

// Blob metadata with safe access patterns
export interface BlobMetadata {
  V1: {
    $kind: 'V1';
    encoding_type: {
      RedStuff: true;
      $kind: string;
    };
    unencoded_length: string;
    hashes: {
      primary_hash: {
        Digest: Uint8Array;
        $kind: string;
      };
      secondary_hash: {
        Sha256: Uint8Array;
        $kind: string;
      };
    }[];
  };
  $kind: 'V1';
}

// Storage confirmation from node
export interface StorageConfirmation {
  primary_verification: boolean;
  secondary_verification?: boolean;
  provider: string;
  signature?: string;
  confirmed?: boolean;  // Added for compatibility
  serializedMessage?: string;
}

// Options for various Walrus client operations
export interface WriteBlobOptions {
  blob: Uint8Array;
  signer: Signer | Ed25519Keypair;
  deletable?: boolean;
  epochs?: number;
  attributes?: Record<string, string>;
  transaction?: TransactionBlock | Transaction;
  signal?: AbortSignal;
}

export interface ReadBlobOptions {
  blobId: string;
  signal?: AbortSignal;
}

export interface StorageWithSizeOptions {
  size: number;
  epochs: number;
  walCoin?: unknown;
}

export interface RegisterBlobOptions {
  blobId: string;
  rootHash: Uint8Array;
  deletable: boolean;
  walCoin?: unknown;
  attributes?: Record<string, string>;
  size: number;
  epochs: number;
}

export interface CertifyBlobOptions {
  blobObjectId: string;
}

export interface WriteBlobAttributesOptions {
  blobObjectId: string;
  attributes: Record<string, string>;
}

export interface DeleteBlobOptions {
  blobObjectId: string;
}

export interface GetStorageConfirmationOptions {
  blobId: string;
  nodeIndex: number;
  nodeUrl?: string;
}

export interface WriteSliversToNodeOptions {
  nodeUrl: string;
  blobId: string;
  sliver: Uint8Array;
  version: number;
  totalSize: number;
  partSize: number;
  signal?: AbortSignal;
  timeout?: number;
}

export interface WriteEncodedBlobToNodesOptions {
  blobId: string;
  sliver: Uint8Array;
  position: number;
  sliverSize: number;
  totalSize: number;
  encodingType: { RedStuff: true };
  signal?: AbortSignal;
  timeout?: number;
}

export interface WalrusClientConfig {
  fullnode?: string;
  network?: string;
  customRpcUrl?: string;
  fetchOptions?: RequestInit;
}