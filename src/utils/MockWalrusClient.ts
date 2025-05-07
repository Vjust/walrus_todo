import { type WalrusClient, type WriteBlobOptions, type StorageWithSizeOptions, type RegisterBlobOptions, type DeleteBlobOptions, type CertifyBlobOptions, type WriteBlobAttributesOptions, type GetStorageConfirmationOptions, type WriteSliversToNodeOptions, type WriteEncodedBlobToNodesOptions, type WriteEncodedBlobOptions, type WalrusClientConfig } from '@mysten/walrus';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { type BlobObject, type BlobInfo, type BlobMetadataShape } from '../types/walrus';
import { type Signer } from '@mysten/sui.js/cryptography';
import { type WalrusClientExt, type WalrusClientWithExt } from '../types/client';
import { type Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

interface StorageConfirmation {
  confirmed: boolean;
  proofs: Array<{ node: string; signature: Uint8Array }>;
}

interface TransactionResult {
  $kind: "Result";
  Result: number;
}

interface Transaction extends TransactionBlock {
  readonly #private: symbol;
}

export class MockWalrusClient implements WalrusClientWithExt {
  private mockBlobId = 'test-blob-id';
  private mockStorageId = 'test-storage-id';
  private mockDigest = 'mock-digest';
  readonly #private = {};
  experimental?: { getBlobData: () => Promise<any> };

  constructor(config?: WalrusClientConfig) {}

  // @ts-ignore - Compatible with both Signer and Ed25519Keypair
  async executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: TransactionBlock; signer: Signer | Ed25519Keypair }): Promise<{
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

  async getConfig(): Promise<{ network: string; version: string; maxSize: number }> {
    return {
      network: 'testnet',
      version: '1.0.0',
      maxSize: 1000000
    };
  }

  async getWalBalance(): Promise<string> {
    return '1000000';
  }

  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return {
      used: '500000',
      total: '1000000'
    };
  }

  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    return {
      blob_id: blobId,
      registered_epoch: 1,
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1000',
      size: '1000',
      hashes: [{
        primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
        secondary_hash: { Digest: new Uint8Array([4,5,6]), $kind: 'Digest' }
      }],
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
            secondary_hash: { Digest: new Uint8Array([4,5,6]), $kind: 'Digest' }
          }],
          $kind: 'V1'
        }
      }
    };
  }

  async getBlobObject(params: { blobId: string }): Promise<BlobObject> {
    return {
      id: { id: params.blobId },
      registered_epoch: 1,
      blob_id: params.blobId,
      size: '1000',
      encoding_type: 1,
      certified_epoch: 1,
      storage: {
        id: { id: this.mockStorageId },
        storage_size: '1000000',
        used_size: '1000',
        end_epoch: 100,
        start_epoch: 1
      },
      deletable: false
    };
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    return true;
  }

  async getStorageProviders(params: { blobId: string }): Promise<string[]> {
    return ['mock-storage-provider-1', 'mock-storage-provider-2'];
  }

  async getBlobSize(blobId: string): Promise<number> {
    return 1000;
  }

  reset(): void {
    // Reset the mock client state
    console.log('MockWalrusClient reset called');
  }

  // @ts-ignore - Return type compatibility with interfaces
  async writeBlob({ blob, deletable, epochs, signer, attributes }: WriteBlobOptions): Promise<{ blobId: string; blobObject: BlobObject }> {
    const blobObject = await this.getBlobObject({ blobId: this.mockBlobId });
    return {
      blobId: this.mockBlobId,
      blobObject
    };
  }

  async readBlob({ blobId, signal }: { blobId: string; signal?: AbortSignal }): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async getBlobMetadata({ blobId, signal }: { blobId: string; signal?: AbortSignal }): Promise<BlobMetadataShape> {
    return {
      blob_id: blobId,
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1000',
          hashes: [{
            primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
            secondary_hash: { Digest: new Uint8Array([4,5,6]), $kind: 'Digest' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      }
    };
  }

  async storageCost(size: number, epochs: number): Promise<{
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

  async encodeBlob(blob: Uint8Array): Promise<{ blobId: string; metadata: { V1: { encoding_type: "RedStuff"; unencoded_length: string; hashes: Array<{ primary_hash: { Empty: false; Digest: Uint8Array }; secondary_hash: { Empty: false; Digest: Uint8Array } }> } }; rootHash: Uint8Array; sliversByNode: Array<{ primary: Array<{ sliverIndex: number; sliverPairIndex: number; shardIndex: number; sliver: Uint8Array }>; secondary: Array<{ sliverIndex: number; sliverPairIndex: number; shardIndex: number; sliver: Uint8Array }> }> }> {
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

  async writeSliversToNode({ slivers }: WriteSliversToNodeOptions): Promise<void> {
    // Mock writing slivers to node storage
    // Verify slivers format and simulate storage
    if (!Array.isArray(slivers) || slivers.some(s => !(s instanceof Uint8Array))) {
      throw new Error('Invalid slivers format');
    }
    return Promise.resolve();
  }

  async writeEncodedBlobToNodes({ blobId, metadata, sliversByNode, signal }: WriteEncodedBlobToNodesOptions): Promise<StorageConfirmation[]> {
    return [{
      confirmed: true,
      proofs: [{
        node: 'mock-node',
        signature: new Uint8Array(32)
      }]
    }];
  }

  async writeEncodedBlobToNode({ nodeIndex, blobId, metadata, slivers, signal }: WriteEncodedBlobOptions): Promise<StorageConfirmation> {
    return {
      confirmed: true,
      proofs: [{
        node: 'mock-node',
        signature: new Uint8Array(32)
      }]
    };
  }

  // @ts-ignore - Parameter compatibility with both interfaces
  executeCertifyBlobTransaction(options: CertifyBlobOptions & { transaction?: TransactionBlock; signer: Signer | Ed25519Keypair }): Promise<{ digest: string }> {
    return Promise.resolve({ digest: this.mockDigest });
  }

  // @ts-ignore - Parameter compatibility with both interfaces
  executeWriteBlobAttributesTransaction(options: WriteBlobAttributesOptions & { signer: Signer | Ed25519Keypair; transaction?: TransactionBlock }): Promise<{ digest: string }> {
    return Promise.resolve({ digest: this.mockDigest });
  }

  // @ts-ignore - Parameter compatibility with both interfaces
  async executeRegisterBlobTransaction(options: RegisterBlobOptions & { transaction?: TransactionBlock; signer: Signer | Ed25519Keypair }): Promise<{ blob: BlobObject; digest: string }> {
    const blobObject = await this.getBlobObject({ blobId: this.mockBlobId });
    return {
      blob: blobObject,
      digest: this.mockDigest
    };
  }

  // @ts-ignore - Method signature compatibility with interface
  deleteBlob({ blobObjectId }: DeleteBlobOptions): (tx: any) => Promise<any> {
    return (tx: any) => Promise.resolve({
      digest: this.mockDigest,
      $kind: "Result",
      Result: 42
    });
  }

  async getStorageConfirmationFromNode({ nodeIndex, blobId, deletable, objectId, signal }: GetStorageConfirmationOptions): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }> {
    return {
      confirmed: true,
      serializedMessage: 'mock-message',
      signature: 'mock-signature'
    };
  }

  async createStorageBlock(size: number, epochs: number): Promise<TransactionBlock> {
    const txb = new TransactionBlock();
    return txb;
  }

  // @ts-ignore - Method signature compatibility with interface
  createStorage({ size, epochs, walCoin, owner }: StorageWithSizeOptions): (tx: any) => Promise<any> {
    return (tx: any) => Promise.resolve({
      digest: this.mockDigest,
      storage: {
        id: { id: this.mockStorageId },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: String(size || 1000000)
      },
      $kind: "Result",
      Result: 42
    });
  }
}