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
import { Transaction } from '@mysten/sui/transactions';
import type { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { Signer } from '@mysten/sui/cryptography';
import { TransactionType } from '../../../types/transaction';
import type {
  BlobObject,
  BlobInfo,
  BlobMetadataShape
} from '../../../types/walrus';
import { WalrusClientAdapter } from '../../../utils/adapters/walrus-client-adapter';
import { SignerAdapter } from '../../../types/adapters/SignerAdapter';
import { WalrusClientVersion } from '../../../types/adapters/WalrusClientAdapter';

/**
 * MockWalrusClient implements the WalrusClientAdapter interface for testing
 * This provides a clean implementation without type coercion
 */
export class MockWalrusClient implements WalrusClientAdapter {
  private readonly mockBlobId: string = 'test-blob-id';
  private readonly mockStorageId: string = 'test-storage-id';
  private readonly mockDigest: string = 'mock-digest';
  
  constructor(_config?: WalrusClientConfig) {
    // Nothing needed for mock constructor
  }
  
  // Adapter interface implementation to get the underlying client
  getUnderlyingClient(): OriginalWalrusClient | unknown {
    return this;
  }
  
  // Alias for getUnderlyingClient for compatibility with WalrusClientAdapter
  getWalrusClient(): OriginalWalrusClient | unknown {
    return this;
  }

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
      cert_epoch: 1,
      registered_epoch: 1,
      certified_epoch: 1,
      size: '1000',
      metadata: {
        blob_id: blobId,
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
  }

  async getBlobObject(params: { blobId: string }): Promise<BlobObject> {
    // Return only the fields that are defined in the BlobObject interface
    return {
      id: { id: params.blobId },
      registered_epoch: 1,
      blob_id: params.blobId,
      size: '1000',
      cert_epoch: 1,
      deletable: true,
      storage_cost: {
        value: '1000000'
      },
      storage_rebate: {
        value: '900000'
      },
      metadata: {
        blob_id: params.blobId,
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
  }

  async verifyPoA(_params: { blobId: string }): Promise<boolean> {
    return true;
  }

  async writeBlob(params: WriteBlobOptions | { 
    blob: Uint8Array; 
    signer: Signer | Ed25519Keypair | SignerAdapter; 
    deletable?: boolean; 
    epochs?: number; 
    attributes?: Record<string, string>; 
    transaction?: TransactionType 
  }): Promise<{
    blobId: string; // Changed from optional to required
    blobObject: BlobObject | { blob_id: string }
  }> {
    // Check which interface is being used based on parameters
    if ('blob' in params && 'signer' in params) {
      // WalrusClientExt interface
      return {
        blobId: this.mockBlobId, // Always return blobId
        blobObject: {
          blob_id: this.mockBlobId // Minimal valid BlobObject
        }
      };
    } else {
      // WalrusClient interface - use getBlobObject for a fully valid BlobObject
      const blob = await this.getBlobObject({ blobId: this.mockBlobId });
      return {
        blobId: this.mockBlobId,
        blobObject: blob
      };
    }
  }

  async readBlob({ blobId: _blobId, signal: _signal }: ReadBlobOptions): Promise<Uint8Array> {
    return new Uint8Array([1, 2, 3, 4, 5]);
  }

  async getBlobMetadata({ blobId: _blobId, signal: _signal }: ReadBlobOptions): Promise<BlobMetadataShape> {
    return {
      blob_id: _blobId,
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
    };
  }

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

  async executeCertifyBlobTransaction(
    _options: CertifyBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  async executeWriteBlobAttributesTransaction(
    _options: WriteBlobAttributesOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ digest: string }> {
    return { digest: this.mockDigest };
  }

  deleteBlob({ blobObjectId: _blobObjectId }: DeleteBlobOptions): (_tx: TransactionType) => Promise<{ digest: string }> {
    return (_tx: TransactionType) => Promise.resolve({ digest: this.mockDigest });
  }

  async executeRegisterBlobTransaction(
    _options: RegisterBlobOptions & { 
      transaction?: TransactionType;
      signer?: Signer | Ed25519Keypair | SignerAdapter;
    }
  ): Promise<{ 
    blob: BlobObject;
    digest: string; 
  }> {
    // Use getBlobObject to ensure we have a properly formatted BlobObject
    const blob = await this.getBlobObject({ blobId: this.mockBlobId });
    return {
      blob,
      digest: this.mockDigest
    };
  }

  async getStorageConfirmationFromNode(
    _options: GetStorageConfirmationOptions
  ): Promise<{ primary_verification: boolean; secondary_verification?: boolean; provider: string; signature?: string }> {
    // Return a structure that matches the StorageConfirmation interface in walrus.ts
    return {
      primary_verification: true,
      secondary_verification: true,
      provider: 'mock-provider',
      signature: 'mock-signature'
    };
  }

  async createStorageBlock(_size: number, _epochs: number): Promise<TransactionType> {
    // Use the instantiation pattern defined in module-declarations.d.ts
    const tx = Object.create(Transaction.prototype);
    // Return the transaction directly instead of using the adapter
    return tx;
  }

  // WalrusClientExt methods
  async getBlobSize(_blobId: string): Promise<number> {
    return 1000;
  }

  async getStorageProviders(_params: { blobId: string }): Promise<string[]> {
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

  // Implement the getClientVersion method
  getClientVersion(): WalrusClientVersion {
    return WalrusClientVersion.EXTENDED;
  }

  // Helper method to create storage that's used in some implementations
  createStorage(options: StorageWithSizeOptions): (tx: TransactionType) => Promise<{
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
}

// Export an instance of the client as the default export
const mockClient = new MockWalrusClient();
export default mockClient;