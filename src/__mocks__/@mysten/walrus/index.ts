import { jest } from '@jest/globals';
import { type WalrusClientConfig } from '@mysten/walrus';
import { type Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { type BlobObject, type BlobInfo, type BlobMetadataShape } from '../../../types/walrus';
import { Transaction } from '@mysten/sui/transactions';

export class MockWalrusClient {
  #network: string;

  constructor(config: WalrusClientConfig) {
    this.#network = config.network || 'testnet';
  }

  async getConfig() {
    return {
      network: this.#network,
      version: '1.0.0',
      maxSize: 1000000
    };
  }

  async getWalBalance(): Promise<string> {
    return '2000';
  }

  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return {
      used: '500',
      total: '2000'
    };
  }

  async getBlobObject(params: { blobId: string }): Promise<BlobObject> {
    return {
      id: { id: 'mock-storage-id' },
      registered_epoch: 1,
      blob_id: params.blobId,
      size: '1024',
      deletable: false
    };
  }

  async getBlobInfo(blobId: string): Promise<BlobInfo> {
    return {
      blob_id: blobId,
      registered_epoch: 1,
      size: '1024',
      metadata: {
        V1: {
          encoding_type: { RedStuff: true, $kind: 'RedStuff' },
          unencoded_length: '1024',
          hashes: [{
            primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
            secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
          }],
          $kind: 'V1'
        },
        $kind: 'V1'
      },
      certified_epoch: 1
    };
  }

  async getBlobMetadata(params: { blobId: string }): Promise<BlobMetadataShape> {
    return {
      V1: {
        encoding_type: { RedStuff: true, $kind: 'RedStuff' },
        unencoded_length: '1024',
        hashes: [{
          primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
          secondary_hash: { Sha256: new Uint8Array(32), $kind: 'Sha256' }
        }],
        $kind: 'V1'
      },
      $kind: 'V1'
    };
  }

  async readBlob(params: { blobId: string; signal?: AbortSignal }): Promise<Uint8Array> {
    return new Uint8Array(32);
  }

  async writeBlob(input: { 
    blob: Uint8Array; 
    deletable?: boolean; 
    epochs?: number; 
    signer: Ed25519Keypair; 
    attributes?: Record<string, string>; 
    transaction?: Transaction; 
  }): Promise<{ 
    blobId: string; 
    blobObject: BlobObject 
  }> {
    return {
      blobId: 'mock-blob-id',
      blobObject: {
        id: { id: 'mock-storage-id' },
        registered_epoch: 1,
        blob_id: 'mock-blob-id',
        size: '1024',
        deletable: false
      }
    };
  }

  async verifyPoA(params: { blobId: string }): Promise<boolean> {
    return true;
  }

  async storageCost(size: number, epochs: number): Promise<{
    storageCost: bigint;
    writeCost: bigint;
    totalCost: bigint;
  }> {
    return {
      storageCost: BigInt(100),
      writeCost: BigInt(50),
      totalCost: BigInt(150)
    };
  }

  async executeCreateStorageTransaction(options: { 
    size: number | string; 
    epochs: number; 
    owner?: string; 
    signer: Ed25519Keypair;
    transaction?: Transaction;
  }): Promise<{ 
    digest: string; 
    storage: { 
      id: { id: string }; 
      start_epoch: number; 
      end_epoch: number; 
      storage_size: string 
    } 
  }> {
    return {
      digest: 'mock-digest',
      storage: {
        id: { id: 'mock-storage-id' },
        start_epoch: 1,
        end_epoch: 100,
        storage_size: '1000'
      }
    };
  }

  async createStorageBlock(size: number, epochs: number): Promise<Transaction> {
    // Use the instantiation pattern defined in module-declarations.d.ts
    const tx = Object.create(Transaction.prototype);
    return tx;
  }

  reset(): void {}
}

export const WalrusClient = jest.fn().mockImplementation((config: WalrusClientConfig) => {
  return new MockWalrusClient(config);
});