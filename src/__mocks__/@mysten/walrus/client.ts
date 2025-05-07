import type { WalrusClient, WalrusClientConfig, StorageWithSizeOptions, WriteBlobOptions, ReadBlobOptions, RegisterBlobOptions, CertifyBlobOptions, WriteBlobAttributesOptions, DeleteBlobOptions } from '@mysten/walrus';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { BlobObject, BlobInfo, BlobMetadataShape, BlobMetadata, BlobHashPair, EncodingType } from '../../../types/walrus';
import type { WalrusClientExt } from '../../../types/client';

export class MockWalrusClient implements WalrusClient, WalrusClientExt {
  private readonly mockBlobId: string = 'test-blob-id';
  private readonly mockStorageId: string = 'test-storage-id';
  private readonly mockDigest: string = 'mock-digest';
  private readonly #private: any = Symbol('WalrusClient');

  constructor(config?: WalrusClientConfig) {}

  async executeCreateStorageTransaction(options: StorageWithSizeOptions & { transaction?: TransactionBlock; signer: Ed25519Keypair }): Promise<{ 
    digest: string; 
    storage: { 
      id: { id: string }; 
      start_epoch: number; 
      end_epoch: number; 
      storage_size: string; 
    } 
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

  async getBlobInfo(blobId: string): Promise<{
    blob_id: string;
    certified_epoch?: number;
    registered_epoch: number;
    encoding_type: EncodingType;
    unencoded_length: string;
    hashes: BlobHashPair[];
    metadata?: {
      V1: BlobMetadata;
    };
  }> {
    return {
      blob_id: blobId,
      certified_epoch: 1,
      registered_epoch: 1,
      encoding_type: { RedStuff: true, $kind: 'RedStuff' },
      unencoded_length: '1000',
      hashes: [{
        primary_hash: { Digest: new Uint8Array([1,2,3]), $kind: 'Digest' },
        secondary_hash: { Digest: new Uint8Array([4,5,6]), $kind: 'Digest' }
      }],
      metadata: {
        V1: {
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
      deletable: true
    };
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    return true;
  }

  async writeBlob(params: WriteBlobOptions): Promise<{
    blobId: string;
    blobObject: BlobObject;
  }> {
    return {
      blobId: this.mockBlobId,
      blobObject: await this.getBlobObject({ blobId: this.mockBlobId })
    };
  }

  async readBlob({ blobId, signal }: ReadBlobOptions): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async getBlobMetadata({ blobId, signal }: ReadBlobOptions): Promise<BlobMetadataShape> {
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

  async executeCertifyBlobTransaction(options: CertifyBlobOptions & { transaction?: TransactionBlock }): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  async executeWriteBlobAttributesTransaction(options: WriteBlobAttributesOptions & { transaction?: TransactionBlock }): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  async deleteBlob(options: DeleteBlobOptions & { transaction?: TransactionBlock }): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  async executeRegisterBlobTransaction(options: RegisterBlobOptions & { transaction?: TransactionBlock }): Promise<{ 
    blob: BlobObject;
    digest: string; 
  }> {
    return {
      blob: {
        id: { id: this.mockBlobId },
        registered_epoch: 1,
        blob_id: this.mockBlobId,
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
        deletable: true
      },
      digest: this.mockDigest
    };
  }

  async getStorageConfirmationFromNode(blobId: string): Promise<boolean> {
    return true;
  }

  async createStorageBlock(size: number, epochs: number): Promise<TransactionBlock> {
    const txb = new TransactionBlock();
    return txb;
  }

  reset(): void {
    // Reset any stored state
  }

  // Implementing experimental API required by WalrusClientExt
  experimental = {
    getBlobData: async (): Promise<any> => {
      return {
        data: 'mock-data'
      };
    }
  };
}

const mockClient = new MockWalrusClient();
export default mockClient;