import { 
  type WalrusClient, 
  type WriteBlobOptions, 
  type StorageWithSizeOptions, 
  type RegisterBlobOptions, 
  type DeleteBlobOptions, 
  type CertifyBlobOptions, 
  type WriteBlobAttributesOptions, 
  type GetStorageConfirmationOptions, 
  type WriteSliversToNodeOptions, 
  type WriteEncodedBlobToNodesOptions,
  type WalrusClientConfig,
  type ReadBlobOptions 
} from '@mysten/walrus';
import { TransactionBlock } from '@mysten/sui/transactions';
import { type BlobObject, type BlobInfo, type BlobMetadataShape } from '../types/walrus';
import { type Signer } from '@mysten/sui/cryptography';
import { type WalrusClientExt } from '../types/client';
import { type Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { TransactionType } from '../types/transaction';
import {
  WalrusClientAdapter,
  createWalrusClientAdapter
} from './adapters/walrus-client-adapter';
import { WalrusClientVersion } from '../types/adapters/WalrusClientAdapter';
// TransactionBlockAdapter and createTransactionBlockAdapter imported but not used
import { SignerAdapter } from '../types/adapters/SignerAdapter';

/**
 * Storage confirmation type for encoding operations
 * This is separate from the StorageConfirmation interface in walrus.ts that's used for getStorageConfirmationFromNode
 */
interface EncodingStorageConfirmation {
  confirmed: boolean;
  proofs: Array<{ node: string; signature: Uint8Array }>;
}

/**
 * MockWalrusClient implements the WalrusClientAdapter interface for clean
 * interoperability between different interface variants.
 */
export class MockWalrusClient implements WalrusClientAdapter {
  private readonly mockBlobId = 'test-blob-id';
  private readonly mockStorageId = 'test-storage-id';
  private readonly mockDigest = 'mock-digest';
  
  constructor(_config?: WalrusClientConfig) {
    // No initialization needed for mock
  }

  // Access to the underlying client
  getUnderlyingClient(): WalrusClient | WalrusClientExt {
    return this as unknown as WalrusClient;
  }

  // Compatibility with WalrusClientAdapter interface
  getWalrusClient(): WalrusClient | WalrusClientExt {
    return this as unknown as WalrusClient;
  }

  // Implementation of getClientVersion required by WalrusClientAdapter interface
  getClientVersion(): WalrusClientVersion {
    return WalrusClientVersion.EXTENDED;
  }

  /**
   * Create storage on the blockchain
   * Handles both interface variants with Signer | Ed25519Keypair | SignerAdapter
   */
  async executeCreateStorageTransaction(
    _options: StorageWithSizeOptions & { 
      transaction?: TransactionType; 
      signer: Signer | Ed25519Keypair | SignerAdapter 
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
    return {
      digest: this.mockDigest,
      storage: {
        id: { id: this.mockStorageId },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: '1000000'
      }
    };
  }

  /**
   * Get configuration information about the current Walrus network
   */
  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    return {
      network: 'testnet',
      version: '1.0.0',
      maxSize: 1000000
    };
  }

  /**
   * Get WAL token balance for the connected account
   */
  async getWalBalance(): Promise<string> {
    return '1000000';
  }

  /**
   * Get storage usage statistics for the connected account
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return {
      used: '500000',
      total: '1000000'
    };
  }

  /**
   * Get information about a blob by its ID
   */
  async getBlobInfo(_blobId: string): Promise<BlobInfo> {
    const info: BlobInfo = {
      blob_id: blobId,
      registered_epoch: 1,
      certified_epoch: 1,
      size: '1000',
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array([4,5,6]), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      }
    };
    
    return info;
  }

  /**
   * Get a blob object by its ID
   */
  async getBlobObject(_params: { blobId: string }): Promise<BlobObject> {
    return {
      id: { id: params.blobId },
      registered_epoch: 1,
      blob_id: params.blobId,
      size: '1000',
      deletable: false,
      // Remove non-interface properties and add the correct ones
      metadata: {
        V1: {
          $kind: 'V1',
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array([4,5,6]), $kind: 'Sha256' }
          }]
        },
        $kind: 'V1'
      }
    };
  }

  /**
   * Verify proof of access for a blob
   */
  async verifyPoA(_params: { blobId: string }): Promise<boolean> {
    return true;
  }

  /**
   * Get the list of storage providers for a blob
   */
  async getStorageProviders(_params: { blobId: string }): Promise<string[]> {
    return ['mock-storage-provider-1', 'mock-storage-provider-2'];
  }

  /**
   * Get the size of a blob in bytes
   */
  async getBlobSize(_blobId: string): Promise<number> {
    return 1000;
  }

  /**
   * Reset the client state
   */
  reset(): void {
    // Reset the mock client state
    console.log('MockWalrusClient reset called');
  }

  /**
   * Write a blob to Walrus storage
   * This implementation handles both WalrusClient and WalrusClientExt interface variants
   */
  async writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionType 
  }): Promise<{
    blobId: string; // Not optional anymore
    blobObject: BlobObject | { blob_id: string };
  }> {
    const blobObject = await this.getBlobObject({ blobId: this.mockBlobId });
    
    // For WalrusClientExt interface
    if ('blob' in params && 'signer' in params) {
      return {
        blobId: this.mockBlobId, // Always include blobId
        blobObject: { blob_id: this.mockBlobId } // Minimal valid BlobObject
      };
    }
    
    // For WalrusClient interface
    return {
      blobId: this.mockBlobId, // Always non-optional
      blobObject: blobObject
    };
  }

  /**
   * Read a blob's content
   */
  async readBlob(_options: ReadBlobOptions): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  /**
   * Get metadata for a blob
   */
  async getBlobMetadata(_options: ReadBlobOptions): Promise<BlobMetadataShape> {
    return {
      V1: {
        $kind: 'V1',
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '1000',
        hashes: [{
          primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
          secondary_hash: { Sha256: new Uint8Array([4,5,6]), $kind: 'Sha256' }
        }]
      },
      $kind: 'V1'
    };
  }

  /**
   * Calculate storage cost for a given size and duration
   */
  async storageCost(_size: number, _epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    return {
      storageCost: BigInt(1000),
      writeCost: BigInt(100),
      totalCost: BigInt(1100)
    };
  }

  /**
   * Encode a raw blob for storage
   */
  async encodeBlob(blob: Uint8Array): Promise<{ 
    blobId: string; 
    metadata: { 
      V1: { 
        encoding_type: "RedStuff"; 
        unencoded_length: string; 
        hashes: Array<{ 
          primary_hash: { Empty: false; Digest: Uint8Array }; 
          secondary_hash: { Empty: false; Digest: Uint8Array } 
        }> 
      } 
    }; 
    rootHash: Uint8Array; 
    sliversByNode: Array<{ 
      primary: Array<{ 
        sliverIndex: number; 
        sliverPairIndex: number; 
        shardIndex: number; 
        sliver: Uint8Array 
      }>; 
      secondary: Array<{ 
        sliverIndex: number; 
        sliverPairIndex: number; 
        shardIndex: number; 
        sliver: Uint8Array 
      }> 
    }> 
  }> {
    return {
      blobId: this.mockBlobId,
      metadata: {
        V1: {
          encoding_type: "RedStuff",
          unencoded_length: "1024",
          hashes: [{
            primary_hash: { Empty: false, Digest: new Uint8Array(32) },
            secondary_hash: { Empty: false, Digest: new Uint8Array(32) }
          }]
        }
      },
      rootHash: new Uint8Array(32),
      sliversByNode: [{
        primary: [{
          sliverIndex: 0,
          sliverPairIndex: 0,
          shardIndex: 0,
          sliver: new Uint8Array(32)
        }],
        secondary: [{
          sliverIndex: 0,
          sliverPairIndex: 0,
          shardIndex: 0,
          sliver: new Uint8Array(32)
        }]
      }]
    };
  }

  /**
   * Write slivers to a storage node
   */
  async writeSliversToNode(_options: WriteSliversToNodeOptions): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Write encoded blob to multiple nodes
   */
  async writeEncodedBlobToNodes(_options: WriteEncodedBlobToNodesOptions): Promise<EncodingStorageConfirmation[]> {
    return [{
      confirmed: true,
      proofs: [{
        node: 'mock-node',
        signature: new Uint8Array(32)
      }]
    }];
  }

  /**
   * Write encoded blob to a specific node
   */
  async writeEncodedBlobToNode(_options: WriteBlobOptions): Promise<EncodingStorageConfirmation> {
    return {
      confirmed: true,
      proofs: [{
        node: 'mock-node',
        signature: new Uint8Array(32)
      }]
    };
  }

  /**
   * Execute a certify blob transaction
   */
  async executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionType; 
      signer?: Signer | Ed25519Keypair | SignerAdapter 
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  /**
   * Execute a write blob attributes transaction
   */
  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter 
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  /**
   * Execute a register blob transaction
   */
  async executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionType; 
      signer?: Signer | Ed25519Keypair | SignerAdapter 
    }
  ): Promise<{ blob: BlobObject; digest: string }> {
    const blobObject = await this.getBlobObject({ blobId: this.mockBlobId });
    return {
      blob: blobObject,
      digest: this.mockDigest
    };
  }

  /**
   * Delete a blob - returns a function that accepts a transaction block
   */
  deleteBlob(options: DeleteBlobOptions): (tx: TransactionType) => Promise<{ digest: string }> {
    return (tx: TransactionType) => Promise.resolve({
      digest: this.mockDigest
    });
  }

  /**
   * Get storage confirmation from a node
   * This method adapts the return type to match the StorageConfirmation interface in the walrus.ts file
   * rather than returning confirmed/serializedMessage/signature structure
   */
  async getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ primary_verification: boolean; secondary_verification?: boolean; provider: string; signature?: string }> {
    // Return a structure that matches the StorageConfirmation interface in walrus.ts
    return {
      primary_verification: true,
      secondary_verification: true,
      provider: 'mock-provider',
      signature: 'mock-signature'
    };
  }

  /**
   * Create a transaction block for storage allocation
   */
  async createStorageBlock(_size: number, _epochs: number): Promise<TransactionType> {
    // Return a TransactionBlock directly (which is a valid TransactionType)
    return new TransactionBlock();
  }

  /**
   * Create storage - returns a function that accepts a transaction block
   */
  createStorage(
    options: StorageWithSizeOptions
  ): (tx: TransactionType) => Promise<{ 
    digest: string; 
    storage: { 
      id: { id: string }; 
      start_epoch: number; 
      end_epoch: number; 
      storage_size: string; 
    } 
  }> {
    return (tx: TransactionType) => Promise.resolve({
      digest: this.mockDigest,
      storage: {
        id: { id: this.mockStorageId },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: String(options.size || 1000000)
      }
    });
  }

  /**
   * Experimental API implementation
   */
  experimental = {
    getBlobData: async (): Promise<{ data: string }> => {
      return {
        data: 'mock-data'
      };
    }
  };
}

/**
 * Factory function to create a MockWalrusClient wrapped in the adapter
 */
export function createMockWalrusClient(): WalrusClientAdapter {
  // The MockWalrusClient implements all required methods of WalrusClient
  return createWalrusClientAdapter(new MockWalrusClient());
}