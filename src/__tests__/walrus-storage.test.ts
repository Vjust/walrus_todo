import { SuiClient } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { WalrusClient } from '@mysten/walrus';
import type { BlobObject } from '../types/walrus';
import type { Mocked } from 'jest-mock';
import { createWalrusStorage } from '../utils/walrus-storage';
import { KeystoreSigner } from '../utils/sui-keystore';
import { CLIError } from '../types/error';
import { execSync } from 'child_process';
import { Todo } from '../types/todo';

interface MockedWalrusClient {
  readBlob: jest.Mock<Promise<Uint8Array>, [string | { blobId: string; signal?: AbortSignal }]>;
  writeBlob: jest.Mock<Promise<{ blobId: string; blobObject: BlobObject }>, [{ blob: Uint8Array; deletable: boolean; epochs: number; attributes: Record<string, string> }]>;
  storageCost: jest.Mock<Promise<{ storageCost: string; writeCost: string; totalCost: string }>, [number, number]>;
  executeCreateStorageTransaction: jest.Mock<Promise<{ storage: { id: { id: string }; storage_size: number; end_epoch: number; start_epoch: number } }>, [{ storageSize: number; epochs: number }]>;
  connect: jest.Mock<Promise<void>, []>;
  getConfig: jest.Mock<Promise<{ network: string; version: string; maxSize: number }>, []>;
  getWalBalance: jest.Mock<Promise<string>, []>;
  getStorageUsage: jest.Mock<Promise<{ used: string; total: string }>, []>;
  getBlobInfo: jest.Mock<Promise<any>, [string]>;
  getBlobObject: jest.Mock<Promise<BlobObject>, [{ blobId: string }]>;
  verifyPoA: jest.Mock<Promise<boolean>, [{ blobId: string }]>;
  getBlobMetadata: jest.Mock<Promise<any>, [{ blobId: string; signal?: AbortSignal }]>;
  getStorageProviders: jest.Mock<Promise<string[]>, [{ blobId: string }]>;
  getBlobSize: jest.Mock<Promise<number>, [string]>;
  reset: jest.Mock<void, []>;
}

// Use a partial type instead of extending directly to avoid compatibility issues
interface MockedSuiClient {
  instanceId?: string;
  address?: string;
  connect: jest.Mock<Promise<void>, []>;
  getBalance: jest.Mock<Promise<{ coinType: string; totalBalance: bigint; coinObjectCount: number; lockedBalance: { number: bigint }; coinObjectId: string }>, [any]>;
  getLatestSuiSystemState: jest.Mock<Promise<{ epoch: string }>, []>;
  getOwnedObjects: jest.Mock<Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null }>, [any]>;
  signAndExecuteTransactionBlock: jest.Mock<Promise<{ digest: string; effects: { status: { status: string }; created?: { reference: { objectId: string } }[] } }>, [any]>;
  executeTransactionBlock: jest.Mock<Promise<{ digest: string; effects: { status: { status: string } } }>, [any]>;
}

jest.mock('child_process');
jest.mock('@mysten/sui');
jest.mock('@mysten/walrus');
jest.mock('../utils/sui-keystore');

describe('WalrusStorage', () => {
  let mockSuiClient: MockedSuiClient;
  let mockWalrusClient: MockedWalrusClient;
  let storage: ReturnType<typeof createWalrusStorage>;
  let mockTodo: Todo;

  beforeEach(() => {
    mockSuiClient = {
      connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      getBalance: jest.fn<Promise<{ coinType: string; totalBalance: bigint; coinObjectCount: number; lockedBalance: { number: bigint }; coinObjectId: string }>, [string]>()
        .mockResolvedValue({
          coinType: 'WAL',
          totalBalance: BigInt(1000),
          coinObjectCount: 1,
          lockedBalance: { number: BigInt(0) },
          coinObjectId: 'mock-coin-object-id'
        }),
      getLatestSuiSystemState: jest.fn<Promise<{ epoch: string }>, []>()
        .mockResolvedValue({ epoch: '1' }),
      getOwnedObjects: jest.fn<Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null }>, [any]>()
        .mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null }),
      signAndExecuteTransactionBlock: jest.fn<Promise<{ digest: string; effects: { status: { status: string } } }>, [any]>()
        .mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } }),
      executeTransactionBlock: jest.fn<Promise<{ digest: string; effects: { status: { status: string } } }>, [any]>()
        .mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } })
    } as MockedSuiClient;

    mockWalrusClient = {
      readBlob: jest.fn<Promise<Uint8Array>, [string | { blobId: string; signal?: AbortSignal }]>().mockResolvedValue(new Uint8Array()),
      writeBlob: jest.fn<Promise<{ blobId: string; blobObject: BlobObject }>, [{ blob: Uint8Array; deletable: boolean; epochs: number; attributes: Record<string, string> }]>()
        .mockResolvedValue({ blobId: '', blobObject: {} as BlobObject }),
      storageCost: jest.fn<Promise<{ storageCost: string; writeCost: string; totalCost: string }>, [number, number]>()
        .mockResolvedValue({
          storageCost: '100',
          writeCost: '50',
          totalCost: '150'
        }),
      executeCreateStorageTransaction: jest.fn<Promise<{ storage: { id: { id: string }; storage_size: number; end_epoch: number; start_epoch: number } }>, [{ storageSize: number; epochs: number }]>()
        .mockResolvedValue({
          storage: {
            id: { id: 'test-storage-id' },
            storage_size: 1000000,
            end_epoch: 100,
            start_epoch: 1
          }
        }),
      connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      getConfig: jest.fn<Promise<{ network: string; version: string; maxSize: number }>, []>()
        .mockResolvedValue({ network: 'testnet', version: '1.0.0', maxSize: 10485760 }),
      getWalBalance: jest.fn<Promise<string>, []>()
        .mockResolvedValue('1000'),
      getStorageUsage: jest.fn<Promise<{ used: string; total: string }>, []>()
        .mockResolvedValue({ used: '100000', total: '1000000' }),
      getBlobInfo: jest.fn<Promise<any>, [string]>()
        .mockResolvedValue({
          blob_id: 'test-blob-id',
          registered_epoch: 1,
          cert_epoch: 2,
          size: '1024'
        }),
      getBlobObject: jest.fn<Promise<BlobObject>, [{ blobId: string }]>()
        .mockResolvedValue({
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 1,
          size: '1024',
          metadata: {
            $kind: 'V1',
            V1: {
              $kind: 'V1',
              encoding_type: {
                RedStuff: true,
                $kind: 'RedStuff'
              },
              unencoded_length: '1024',
              hashes: []
            }
          },
          cert_epoch: 2,
          storage: {
            id: { id: 'test-storage-id' },
            storage_size: '1000000',
            used_size: '1024',
            end_epoch: 100,
            start_epoch: 1
          },
          deletable: false
        } as BlobObject),
      verifyPoA: jest.fn<Promise<boolean>, [{ blobId: string }]>()
        .mockResolvedValue(true),
      getBlobMetadata: jest.fn<Promise<any>, [{ blobId: string; signal?: AbortSignal }]>()
        .mockResolvedValue({
          V1: {
            encoding_type: { RedStuff: true, $kind: 'RedStuff' },
            unencoded_length: '1024',
            hashes: [{
              primary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' },
              secondary_hash: { Digest: new Uint8Array(32), $kind: 'Digest' }
            }],
            $kind: 'V1'
          },
          $kind: 'V1'
        }),
      getStorageProviders: jest.fn<Promise<string[]>, [{ blobId: string }]>()
        .mockResolvedValue(['provider1', 'provider2']),
      getBlobSize: jest.fn<Promise<number>, [string]>()
        .mockResolvedValue(1024),
      reset: jest.fn<void, []>()
    } as MockedWalrusClient;

    (execSync as jest.Mock).mockImplementation((cmd: string): string => {
      if (cmd.includes('active-env')) return 'testnet';
      if (cmd.includes('active-address')) return '0xtest-address';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    // Setup mock todo
    mockTodo = {
      id: 'test-id',
      title: 'Test Todo',
      description: 'Test Description',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: 'medium',
      tags: [],
      private: false
    };

    storage = createWalrusStorage();
  });

  describe('retrieveTodo', () => {
    beforeEach(async () => {
      (WalrusClient as unknown as jest.Mock).mockImplementation(() => mockWalrusClient);
      await storage.init();
    });

    it('should validate input', async () => {
      await expect(storage.retrieveTodo('')).rejects.toThrow(/Blob ID is required/);
      await expect(storage.retrieveTodo('   ')).rejects.toThrow(/Blob ID is required/);
    });

    it('should retrieve from cache if available', async () => {
      // First retrieval to populate cache
      const mockData = Buffer.from(JSON.stringify(mockTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(mockData);

      await storage.retrieveTodo('test-blob-id');
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(1);

      // Second retrieval should use cache
      const result = await storage.retrieveTodo('test-blob-id');
      expect(result).toEqual(mockTodo);
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should handle direct retrieval success', async () => {
      const mockData = Buffer.from(JSON.stringify(mockTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(mockData);

      const result = await storage.retrieveTodo('test-blob-id');
      expect(result).toEqual(mockTodo);
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(1);
    });

    it('should fallback to aggregator with retries', async () => {
      // Mock direct retrieval failure
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array());

      // Mock global fetch for aggregator fallback
      const mockFetch = jest.fn<Promise<Response>, [string, RequestInit?]>()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from(JSON.stringify(mockTodo))
        } as unknown as Response);
      global.fetch = mockFetch;

      const result = await storage.retrieveTodo('test-blob-id');
      expect(result).toEqual(mockTodo);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should validate retrieved data', async () => {
      // Mock invalid todo data
      const invalidTodo = { ...mockTodo, title: undefined };
      const mockData = Buffer.from(JSON.stringify(invalidTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(mockData);

      await expect(storage.retrieveTodo('test-blob-id'))
        .rejects.toThrow(/Retrieved todo data is invalid/);
    });

    it('should handle all retrieval attempts failing', async () => {
      // Mock direct retrieval failure
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array());

      // Mock aggregator failures
      global.fetch = jest.fn<Promise<Response>, [string, RequestInit?]>()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(storage.retrieveTodo('test-blob-id'))
        .rejects.toThrow(/Failed to retrieve todo after all attempts/);
    });

    it('should handle invalid JSON data', async () => {
      // Mock invalid JSON response
      const invalidData = Buffer.from('not json');
      mockWalrusClient.readBlob.mockResolvedValueOnce(invalidData);

      await expect(storage.retrieveTodo('test-blob-id'))
        .rejects.toThrow(/Failed to parse todo data/);
    });
  });

  describe('storeTodo', () => {
    beforeEach(async () => {
      // Initialize WalrusClient with successful connection
      (WalrusClient as unknown as jest.Mock).mockImplementation(() => mockWalrusClient);
      await storage.init();
    });

    it('should validate todo data', async () => {
      // Invalid todo with missing fields
      const invalidTodo = { ...mockTodo, title: undefined };
      await expect(storage.storeTodo(invalidTodo as unknown as Todo))
        .rejects.toThrow(/Invalid todo: missing or invalid title/);

      // Invalid todo with wrong data types
      const wrongTypeTodo = { ...mockTodo, completed: 'yes' as unknown as boolean };
      await expect(storage.storeTodo(wrongTypeTodo))
        .rejects.toThrow(/Invalid todo: invalid completed status/);

      // Invalid todo with invalid dates
      const invalidDateTodo = { ...mockTodo, createdAt: 'not-a-date' };
      await expect(storage.storeTodo(invalidDateTodo))
        .rejects.toThrow(/Invalid todo: invalid createdAt date/);
    });

    it('should store todo successfully with verification', async () => {
      // Mock successful blob write
      const mockBlobId = 'test-blob-id';
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: mockBlobId,
        blobObject: {
          id: { id: mockBlobId },
          blob_id: mockBlobId,
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          metadata: {
            $kind: 'V1',
            V1: {
              $kind: 'V1',
              encoding_type: {
                RedStuff: true,
                $kind: 'RedStuff'
              },
              unencoded_length: '1024',
              hashes: []
            }
          },
          deletable: true
        }
      });

      // Mock successful read for verification
      const mockTodoBuffer = Buffer.from(JSON.stringify(mockTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(mockTodoBuffer);

      const blobId = await storage.storeTodo(mockTodo);
      expect(blobId).toBe(mockBlobId);

      // Verify correct storage attributes were set
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          deletable: false,
          epochs: 52,
          attributes: expect.objectContaining({
            contentType: 'application/json',
            filename: `todo-${mockTodo.id}.json`,
            type: 'todo-data',
            title: mockTodo.title,
            completed: 'false',
            checksum_algo: 'sha256',
            schemaVersion: '1',
            encoding: 'utf-8'
          })
        })
      );
    });

    it('should handle data size limits', async () => {
      const largeTodo = {
        ...mockTodo,
        description: 'a'.repeat(11 * 1024 * 1024) // 11MB
      };

      await expect(storage.storeTodo(largeTodo))
        .rejects.toThrow(/Todo data is too large/);
    });

    it('should verify content integrity with retries', async () => {
      const mockBlobId = 'test-blob-id';
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: mockBlobId,
        blobObject: {
          id: { id: mockBlobId },
          blob_id: mockBlobId,
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          metadata: {
            $kind: 'V1',
            V1: {
              $kind: 'V1',
              encoding_type: {
                RedStuff: true,
                $kind: 'RedStuff'
              },
              unencoded_length: '1024',
              hashes: []
            }
          },
          deletable: true
        }
      });

      // First verification attempt: content not found
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array());

      // Second attempt: wrong size
      const wrongSizeBuffer = Buffer.from(JSON.stringify({ ...mockTodo, extraData: 'padding' }));
      mockWalrusClient.readBlob.mockResolvedValueOnce(wrongSizeBuffer);

      // Third attempt: success
      const correctBuffer = Buffer.from(JSON.stringify(mockTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(correctBuffer);

      const blobId = await storage.storeTodo(mockTodo);
      expect(blobId).toBe(mockBlobId);
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(3);
    });

    it('should fail after max verification attempts', async () => {
      const mockBlobId = 'test-blob-id';
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: mockBlobId,
        blobObject: {
          id: { id: mockBlobId },
          blob_id: mockBlobId,
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          metadata: {
            $kind: 'V1',
            V1: {
              $kind: 'V1',
              encoding_type: {
                RedStuff: true,
                $kind: 'RedStuff'
              },
              unencoded_length: '1024',
              hashes: []
            }
          },
          deletable: true
        }
      });

      // All verification attempts fail
      mockWalrusClient.readBlob
        .mockResolvedValue(new Uint8Array());

      await expect(storage.storeTodo(mockTodo))
        .rejects.toThrow(/Failed to verify uploaded content after 3 attempts/);
      expect(mockWalrusClient.readBlob).toHaveBeenCalledTimes(3);
    });

    it('should handle verification failure', async () => {
      // Mock successful write but verification failure
      mockWalrusClient.writeBlob.mockResolvedValueOnce({
        blobId: 'test-blob-id',
        blobObject: {
          id: { id: 'test-blob-id' },
          blob_id: 'test-blob-id',
          registered_epoch: 100,
          cert_epoch: 150,
          size: '1024',
          metadata: {
            $kind: 'V1',
            V1: {
              $kind: 'V1',
              encoding_type: {
                RedStuff: true,
                $kind: 'RedStuff'
              },
              unencoded_length: '1024',
              hashes: []
            }
          },
          deletable: true
        }
      });
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array()); // Verification fails

      await expect(storage.storeTodo(mockTodo))
        .rejects.toThrow(/Failed to verify uploaded content/);
    });

    it('should retry on transient errors', async () => {
      // Mock first attempt failure, second success
      mockWalrusClient.writeBlob
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          blobId: 'test-blob-id',
          blobObject: {
            id: { id: 'test-blob-id' },
            blob_id: 'test-blob-id',
            registered_epoch: 100,
            cert_epoch: 150,
            size: '1024',
            metadata: {
              $kind: 'V1',
              V1: {
                $kind: 'V1',
                encoding_type: {
                  RedStuff: true,
                  $kind: 'RedStuff'
                },
                unencoded_length: '1024',
                hashes: []
              }
            },
            deletable: true
          }
        });

      const mockTodoBuffer = Buffer.from(JSON.stringify(mockTodo));
      mockWalrusClient.readBlob.mockResolvedValueOnce(mockTodoBuffer);

      const blobId = await storage.storeTodo(mockTodo);
      expect(blobId).toBe('test-blob-id');
      expect(mockWalrusClient.writeBlob).toHaveBeenCalledTimes(2);
    });

    it('should handle insufficient WAL tokens', async () => {
      // Mock storage allocation failure
      mockWalrusClient.executeCreateStorageTransaction
        .mockRejectedValueOnce(new Error('insufficient WAL tokens'));

      // Mock low WAL balance
      mockSuiClient.getBalance.mockResolvedValueOnce({
        coinType: 'WAL',
        totalBalance: BigInt(50), // Below minimum required
        coinObjectCount: 1,
        lockedBalance: { number: BigInt(0) },
        coinObjectId: 'mock-coin-object-id'
      });

      await expect(storage.storeTodo(mockTodo))
        .rejects.toThrow(/Insufficient WAL tokens/);
    });

    it('should handle storage allocation failures gracefully', async () => {
      // Mock storage allocation failure
      mockWalrusClient.executeCreateStorageTransaction
        .mockRejectedValueOnce(new Error('storage allocation error'));

      // Mock sufficient WAL balance to test other errors
      mockSuiClient.getBalance.mockResolvedValueOnce({
        coinType: 'WAL',
        totalBalance: BigInt(1000),
        coinObjectCount: 1,
        lockedBalance: { number: BigInt(0) },
        coinObjectId: 'mock-coin-object-id'
      });

      await expect(storage.storeTodo(mockTodo))
        .rejects.toThrow(/Failed to allocate storage/);
    });

    it('should handle mock mode correctly', async () => {
      const mockStorage = createWalrusStorage(true);
      const blobId = await mockStorage.storeTodo(mockTodo);
      expect(blobId).toMatch(/^mock-blob-/);
      expect(mockWalrusClient.writeBlob).not.toHaveBeenCalled();
    });
  });

  describe('ensureStorageAllocated', () => {
    beforeEach(async () => {
      (WalrusClient as unknown as jest.Mock).mockImplementation(() => mockWalrusClient);
      await storage.init();
    });

    it('should allocate new storage if none exists', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({ data: [], hasNextPage: false, nextCursor: null });
      
      const result = await storage.ensureStorageAllocated();
      expect(result).toBeTruthy();
      expect(mockWalrusClient.executeCreateStorageTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          storageSize: 1000000,
          epochs: 52
        })
      );
    });

    it('should reuse existing storage if suitable', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({
        data: [{
          data: {
            objectId: 'existing-storage',
            digest: '0xdigest',
            version: '1',
            type: '0x2::storage::Storage',
            owner: { AddressOwner: 'owner' },
            previousTransaction: '0xtx',
            storageRebate: '0',
            content: {
              dataType: 'moveObject',
              type: '0x2::storage::Storage',
              hasPublicTransfer: true,
              fields: {
                storage_size: '2000000',
                used_size: '100000',
                end_epoch: '200',
                id: { id: 'storage1' },
                start_epoch: '100'
              }
            }
          },
          error: null
        }],
        hasNextPage: false,
        nextCursor: null
      });

      const result = await storage.ensureStorageAllocated();
      expect(result).toBeTruthy();
      expect(mockWalrusClient.executeCreateStorageTransaction).not.toHaveBeenCalled();
    });

    it('should handle insufficient WAL tokens', async () => {
      mockWalrusClient.executeCreateStorageTransaction
        .mockRejectedValueOnce(new Error('insufficient WAL tokens'));

      const result = await storage.ensureStorageAllocated();
      expect(result).toBeFalsy();
    });

    it('should calculate storage costs correctly', async () => {
      await storage.ensureStorageAllocated(1000000);
      expect(mockWalrusClient.storageCost).toHaveBeenCalledWith(1000000, 52);
    });
  });
});