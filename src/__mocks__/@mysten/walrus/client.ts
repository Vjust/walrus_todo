import { WalrusClient, WalrusClientExt, BlobObject, BlobInfo, StorageWithSizeOptions, WriteBlobOptions, ReadBlobOptions, BlobMetadataShape, CertifyBlobOptions, WriteBlobAttributesOptions, DeleteBlobOptions, WalrusClientConfig, RegisterBlobOptions, TransactionResult } from '@mysten/walrus';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Signer } from '../sui/signer';

export class MockWalrusClient implements WalrusClient, WalrusClientExt {
  private readonly mockBlobId: string;
  private readonly mockStorageId: string;
  private readonly mockDigest: string;
  private readonly config: WalrusClientConfig;
  private readonly #private: symbol;

  mockTransactionResult: TransactionResult;

  constructor(config?: Partial<WalrusClientConfig>) {
    this.mockBlobId = 'test-blob-id';
    this.mockStorageId = 'test-storage-id';
    this.mockDigest = 'mock-digest';
    this.#private = Symbol('WalrusClient');
    
    this.config = {
      network: config?.network ?? 'testnet',
      endpoint: config?.endpoint ?? 'http://localhost:8080',
      version: config?.version ?? '1.0.0',
      maxBlobSize: config?.maxBlobSize ?? 1000000,
      ...config
    };

    this.mockTransactionResult = {
      digest: this.mockDigest,
      success: true,
      error: null
    };

  executeCreateStorageTransaction(options: StorageWithSizeOptions & { signer: Signer }): (tx: TransactionBlock) => Promise<TransactionResult> {
    return async (tx: TransactionBlock) => this.mockTransactionResult;
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
      encoding_type: 0,
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

  executeCertifyBlobTransaction(options: CertifyBlobOptions & { signer: Signer }): (tx: TransactionBlock) => Promise<TransactionResult> {
    return async (tx: TransactionBlock) => this.mockTransactionResult;
  }

  executeWriteBlobAttributesTransaction(options: WriteBlobAttributesOptions & { signer: Signer }): (tx: TransactionBlock) => Promise<TransactionResult> {
    return async (tx: TransactionBlock) => this.mockTransactionResult;
  }

  deleteBlob(options: DeleteBlobOptions & { signer: Signer }): (tx: TransactionBlock) => Promise<TransactionResult> {
    return async (tx: TransactionBlock) => this.mockTransactionResult;
  }

  executeRegisterBlobTransaction(options: RegisterBlobOptions & { signer: Signer }): (tx: TransactionBlock) => Promise<TransactionResult> {
    return async (tx: TransactionBlock) => this.mockTransactionResult;
  }

  async getStorageConfirmationFromNode(blobId: string): Promise<boolean> {
    return true;
  }

  async encodeBlob(blob: Uint8Array): Promise<Uint8Array> {
    return blob;
  }

  async writeSliversToNode(slivers: Uint8Array[], signal?: AbortSignal): Promise<void> {
    return;
  }
}

const mockClient = new MockWalrusClient();
export default mockClient;