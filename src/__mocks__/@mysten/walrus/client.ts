import type { 
  WalrusClient as OriginalWalrusClient,
  WalrusClientConfig, 
  StorageWithSizeOptions, 
  WriteBlobOptions, 
  ReadBlobOptions, 
  RegisterBlobOptions, 
  CertifyBlobOptions, 
  WriteBlobAttributesOptions, 
  DeleteBlobOptions,
  GetStorageConfirmationOptions
} from '@mysten/walrus';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import type { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import type { Signer } from '@mysten/sui.js/cryptography';
import type { 
  BlobObject, 
  BlobInfo, 
  BlobMetadataShape, 
  BlobMetadata, 
  BlobHashPair, 
  EncodingType
} from '../../types/walrus';
import type { WalrusClientExt } from '../../types/client';
import { WalrusClientAdapter } from '../../../utils/adapters/walrus-client-adapter';
import { SignerAdapter } from '../../../utils/adapters/signer-adapter';
import { TransactionBlockAdapter, createTransactionBlockAdapter } from '../../../utils/adapters/transaction-adapter';

/**
 * MockWalrusClient implements the WalrusClientAdapter interface for testing
 * This provides a clean implementation without type coercion
 */
export class MockWalrusClient implements WalrusClientAdapter {
  private readonly mockBlobId: string = 'test-blob-id';
  private readonly mockStorageId: string = 'test-storage-id';
  private readonly mockDigest: string = 'mock-digest';
  
  constructor(config?: WalrusClientConfig) {
    // Nothing needed for mock constructor
  }
  
  // Adapter interface implementation to get the underlying client
  getUnderlyingClient(): OriginalWalrusClient | any {
    return this;
  }

  async executeCreateStorageTransaction(
    options: StorageWithSizeOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter; 
      signer: Signer | Ed25519Keypair | SignerAdapter 
    }
  ): Promise<{ 
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

  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    return {
      blob_id: blobId,
      certified_epoch: 1,
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
      deletable: true
    };
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    return true;
  }

  async writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionBlock | TransactionBlockAdapter 
  }): Promise<{
    blobId?: string;
    blobObject: BlobObject | { blob_id: string }
  }> {
    // Check which interface is being used based on parameters
    if ('blob' in params && 'signer' in params) {
      // WalrusClientExt interface
      return {
        blobObject: {
          blob_id: this.mockBlobId
        }
      };
    } else {
      // WalrusClient interface - original implementation
      const blob = await this.getBlobObject({ blobId: this.mockBlobId });
      return {
        blobId: this.mockBlobId,
        blobObject: blob
      };
    }
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

  async executeCertifyBlobTransaction(
    options: CertifyBlobOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  async executeWriteBlobAttributesTransaction(
    options: WriteBlobAttributesOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  deleteBlob({ blobObjectId }: DeleteBlobOptions): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{ digest: string }> {
    return (tx: TransactionBlock | TransactionBlockAdapter) => Promise.resolve({ digest: this.mockDigest });
  }

  async executeRegisterBlobTransaction(
    options: RegisterBlobOptions & { 
      transaction?: TransactionBlock | TransactionBlockAdapter;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: BlobObject;
    digest: string; 
  }> {
    const blob = await this.getBlobObject({ blobId: this.mockBlobId });
    return {
      blob,
      digest: this.mockDigest
    };
  }

  async getStorageConfirmationFromNode(
    options: GetStorageConfirmationOptions
  ): Promise<{ confirmed: boolean; serializedMessage: string; signature: string }> {
    return {
      confirmed: true,
      serializedMessage: 'mock-message',
      signature: 'mock-signature'
    };
  }

  async createStorageBlock(size: number, epochs: number): Promise<TransactionBlock | TransactionBlockAdapter> {
    const txb = new TransactionBlock();
    return createTransactionBlockAdapter(txb);
  }

  // WalrusClientExt methods
  async getBlobSize(blobId: string): Promise<number> {
    return 1000;
  }

  async getStorageProviders(params: { blobId: string }): Promise<string[]> {
    return ['provider-1', 'provider-2'];
  }

  reset(): void {
    // Reset any stored state
  }

  // Implementation of the experimental API
  experimental = {
    getBlobData: async (): Promise<any> => {
      return {
        data: 'mock-data'
      };
    }
  };

  // Helper method to create storage that's used in some implementations
  createStorage(options: StorageWithSizeOptions): (tx: TransactionBlock | TransactionBlockAdapter) => Promise<{
    digest: string;
    storage: {
      id: { id: string };
      start_epoch: number;
      end_epoch: number;
      storage_size: string;
    }
  }> {
    return (tx: TransactionBlock | TransactionBlockAdapter) => Promise.resolve({
      digest: this.mockDigest,
      storage: {
        id: { id: this.mockStorageId },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: String(options.size || 1000000)
      }
    });
  }
}

// Export an instance of the client as the default export
const mockClient = new MockWalrusClient();
export default mockClient;