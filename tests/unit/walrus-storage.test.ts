import { SuiClient } from '@mysten/sui.js';
import { TransactionBlock } from '@mysten/sui.js';
import { WalrusClient, type BlobType, type BlobObject, type Storage } from '@mysten/walrus';
import type { Mocked } from 'jest-mock';
import { createWalrusStorage } from '../../src/utils/walrus-storage';
import { KeystoreSigner } from '../../src/utils/sui-keystore';
import { CLIError } from '../../src/types/error';
import { execSync } from 'child_process';
import { Todo } from '../../src/types/todo';

interface MockedWalrusClient extends WalrusClient {
  readBlob: jest.Mock<Promise<Uint8Array>, [string]>;
  writeBlob: jest.Mock<Promise<{ blobId: string; blobObject: BlobObject }>, [{ data: Uint8Array; deletable: boolean; epochs: number; attributes: Record<string, string> }]>;
  storageCost: jest.Mock<Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>, [number, number]>;
  executeCreateStorageTransaction: jest.Mock<Promise<{ storage: Storage }>, [{ storageSize: number; epochs: number }]>;
  getBlobType: jest.Mock<Promise<BlobType>, [string]>;
  connect: jest.Mock<Promise<void>, []>;
}

interface MockedSuiClient extends SuiClient {
  connect: jest.Mock<Promise<void>, []>;
  getBalance: jest.Mock<Promise<{ coinType: string; totalBalance: string; coinObjectCount: number; lockedBalance: { number: string } }>, [string]>;
  getLatestSuiSystemState: jest.Mock<Promise<{ epoch: string }>, []>;
  getOwnedObjects: jest.Mock<Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null }>, [{ owner: string }]>;
  signAndExecuteTransactionBlock: jest.Mock<Promise<{ digest: string; effects: { status: { status: string }; created?: { reference: { objectId: string } }[] } }>, [TransactionBlock]>;
  executeTransactionBlock: jest.Mock<Promise<{ digest: string; effects: { status: { status: string } } }>, [TransactionBlock]>;
}

jest.mock('child_process');
jest.mock('@mysten/sui');
jest.mock('@mysten/walrus');
jest.mock('../../src/utils/sui-keystore');

describe('WalrusStorage', () => {
  let mockSuiClient: MockedSuiClient;
  let mockWalrusClient: MockedWalrusClient;
  let storage: ReturnType<typeof createWalrusStorage>;
  let mockTodo: Todo;

  beforeEach(() => {
    mockSuiClient = {
      getBalance: jest.fn<Promise<{ coinType: string; totalBalance: string; coinObjectCount: number; lockedBalance: { number: string } }>, [string]>()
        .mockResolvedValue({
          coinType: 'WAL',
          totalBalance: '1000',
          coinObjectCount: 1,
          lockedBalance: { number: '0' }
        }),
      getLatestSuiSystemState: jest.fn<Promise<{ epoch: string }>, []>()
        .mockResolvedValue({ epoch: '1' }),
      getOwnedObjects: jest.fn<Promise<{ data: any[]; hasNextPage: boolean; nextCursor: string | null }>, [any]>()
        .mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null }),
      signAndExecuteTransactionBlock: jest.fn<Promise<{ digest: string; effects: { status: { status: string } } }>, [any]>()
        .mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } }),
      executeTransactionBlock: jest.fn<Promise<{ digest: string; effects: { status: { status: string } } }>, [any]>()
        .mockResolvedValue({ digest: 'test-digest', effects: { status: { status: 'success' } } })
    } satisfies MockedSuiClient;

    mockWalrusClient = {
      readBlob: jest.fn<Promise<Uint8Array>, [string]>().mockResolvedValue(new Uint8Array()),
      writeBlob: jest.fn<Promise<{ blobId: string; blobObject: BlobObject }>, [{ data: Uint8Array; deletable: boolean; epochs: number; attributes: Record<string, string> }]>()
        .mockResolvedValue({ blobId: '', blobObject: {} as BlobObject }),
      storageCost: jest.fn<Promise<{ storageCost: bigint; writeCost: bigint; totalCost: bigint }>, [number, number]>()
        .mockResolvedValue({
          storageCost: BigInt(100),
          writeCost: BigInt(50),
          totalCost: BigInt(150)
        }),
      getBlobType: jest.fn<Promise<BlobType>, [string]>().mockResolvedValue('todo' as BlobType),
      executeCreateStorageTransaction: jest.fn<Promise<{ storage: Storage }>, [{ storageSize: number; epochs: number }]>()
        .mockResolvedValue({
          storage: {
            id: { id: 'test-storage-id' },
            storage_size: 1000000,
            end_epoch: 100,
            start_epoch: 1
          } as Storage
        }),
      connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined)
    } satisfies MockedWalrusClient;

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
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
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
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
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
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
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
          certified_epoch: 150,
          size: '1024',
          encoding_type: 1,
          storage: {
            id: { id: 'storage1' },
            start_epoch: 100,
            end_epoch: 200,
            storage_size: '2048'
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
            certified_epoch: 150,
            size: '1024',
            encoding_type: 1,
            storage: {
              id: { id: 'storage1' },
              start_epoch: 100,
              end_epoch: 200,
              storage_size: '2048'
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
        totalBalance: '50', // Below minimum required
        coinObjectCount: 1,
        lockedBalance: { number: '0' }
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
        totalBalance: '1000',
        coinObjectCount: 1,
        lockedBalance: { number: '0' }
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
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({ data: [], hasNextPage: false });
      
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