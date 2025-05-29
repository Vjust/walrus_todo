import { createWalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import type { WalrusStorage } from '../../apps/cli/src/utils/walrus-storage';
import { Todo } from '../../apps/cli/src/types/todo';
import type { CompleteWalrusClientMock } from '../helpers/complete-walrus-client-mock';
// Using real WalrusStorage implementation

// Mock the external dependencies for unit testing
jest.mock('@mysten/walrus', () => ({
  WalrusClient: jest.fn().mockImplementation(() => ({
    store: jest.fn().mockResolvedValue('mock-blob-id'),
    read: jest.fn().mockResolvedValue(new Uint8Array()),
  })),
}));

jest.mock('../../apps/cli/src/utils/adapters/sui-client-compatibility', () => ({
  SuiClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    getBalance: jest.fn(),
    getLatestSuiSystemState: jest.fn(),
    getOwnedObjects: jest.fn(),
    signAndExecuteTransactionBlock: jest.fn(),
    executeTransactionBlock: jest.fn(),
  })),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import { SuiClient } from '../../apps/cli/src/utils/adapters/sui-client-compatibility';
import { execSync } from 'child_process';

// Removed unused types

describe('WalrusStorage', () => {
  let storage: WalrusStorage;
  let mockTodo: Todo;
  let mockWalrusClient: CompleteWalrusClientMock;
  let mockSuiClient: jest.Mocked<InstanceType<typeof SuiClient>>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock walrus client
    mockWalrusClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      getConfig: jest.fn().mockResolvedValue({
        network: 'testnet',
        version: '1.0.0',
        maxSize: 10485760,
      }),
      readBlob: jest.fn(),
      writeBlob: jest.fn(),
      getBlobObject: jest.fn(),
      verifyPoA: jest.fn(),
      storageCost: jest.fn(),
      executeCreateStorageTransaction: jest.fn(),
      getWalBalance: jest.fn(),
      getStorageUsage: jest.fn(),
      getBlobInfo: jest.fn(),
      deleteBlob: jest.fn(),
    } as CompleteWalrusClientMock;

    mockSuiClient = {
      connect: jest.fn(),
      getBalance: jest.fn(),
      getLatestSuiSystemState: jest.fn(),
      getOwnedObjects: jest.fn(),
      signAndExecuteTransaction: jest.fn(),
      executeTransactionBlock: jest.fn(),
    } as any;

    // Mock constructor implementations
    (SuiClient as jest.Mock).mockImplementation(() => mockSuiClient);

    // Mock execSync
    (execSync as jest.Mock).mockImplementation((cmd: string): string => {
      if (cmd.includes('active-env')) return 'testnet';
      if (cmd.includes('active-address')) return '0xtest-address';
      throw new Error(`Unexpected command: ${cmd}`);
    });

    // Setup default mock responses
    mockSuiClient.getBalance.mockResolvedValue({
      coinType: 'WAL',
      totalBalance: BigInt(1000),
      coinObjectCount: 1,
      lockedBalance: { number: BigInt(0) },
      coinObjectId: 'mock-coin-object-id',
    });

    mockSuiClient.getLatestSuiSystemState.mockResolvedValue({
      epoch: '1',
      protocolVersion: '1',
      systemStateVersion: '1',
      storageFundTotalObjectStorageRebates: '0',
      storageFundNonRefundableBalance: '0',
      referenceGasPrice: '1000',
      safeMode: false,
      safeModeStorageRewards: '0',
      safeModeComputationRewards: '0',
      safeModeStorageRebates: '0',
      safeModeNonRefundableStorageFee: '0',
      epochStartTimestampMs: '0',
      epochDurationMs: '86400000',
      stakeSubsidyStartEpoch: '0',
      maxValidatorCount: '150',
      minValidatorJoiningStake: '30000000000000',
      validatorLowStakeThreshold: '20000000000000',
      validatorVeryLowStakeThreshold: '15000000000000',
      validatorLowStakeGracePeriod: '7',
      stakeSubsidyBalance: '0',
      stakeSubsidyDistributionCounter: '0',
      stakeSubsidyCurrentDistributionAmount: '0',
      stakeSubsidyPeriodLength: '10',
      stakeSubsidyDecreaseRate: 10,
      totalStake: '0',
      activeValidators: [],
      pendingActiveValidatorsId: 'dummy',
      pendingActiveValidatorsSize: '0',
      pendingRemovals: [],
      stakingPoolMappingsId: 'dummy',
      stakingPoolMappingsSize: '0',
      inactiveValidatorsId: 'dummy',
      inactiveValidatorsSize: '0',
      validatorCandidatesId: 'dummy',
      validatorCandidatesSize: '0',
      atRiskValidators: [],
      validatorReportRecords: [],
    } as any);
    mockSuiClient.getOwnedObjects.mockResolvedValue({
      data: [],
      hasNextPage: false,
      nextCursor: null,
    });
    mockSuiClient.signAndExecuteTransactionBlock.mockResolvedValue({
      digest: 'test-digest',
      effects: { status: { status: 'success' } },
    });

    mockWalrusClient.connect.mockResolvedValue(undefined);
    mockWalrusClient.getConfig.mockResolvedValue({
      network: 'testnet',
      version: '1.0.0',
      maxSize: 10485760,
    });

    // Setup mock todo
    mockTodo = {
      id: 'test-id',
      title: 'Test Todo',
      description: 'Test Description',
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priority: 'medium' as const,
      tags: [],
      private: false,
    };

    storage = createWalrusStorage(false);
  });

  describe('retrieveTodo', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should validate input', async () => {
      await expect(storage.retrieveTodo('')).rejects.toThrow(
        /Blob ID is required/
      );
      await expect(storage.retrieveTodo('   ')).rejects.toThrow(
        /Blob ID is required/
      );
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
      const mockFetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          url: 'https://test.com',
          type: 'default' as ResponseType,
          redirected: false,
          arrayBuffer: async () => Buffer.from(JSON.stringify(mockTodo)),
          blob: async () => new Blob(),
          formData: async () => new FormData(),
          json: async () => ({}),
          text: async () => '',
          clone: () => ({} as Response),
          body: null,
          bodyUsed: false,
        } as Response);
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

      await expect(storage.retrieveTodo('test-blob-id')).rejects.toThrow(
        /Retrieved todo data is invalid/
      );
    });

    it('should handle all retrieval attempts failing', async () => {
      // Mock direct retrieval failure
      mockWalrusClient.readBlob.mockResolvedValueOnce(new Uint8Array());

      // Mock aggregator failures
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(storage.retrieveTodo('test-blob-id')).rejects.toThrow(
        /Failed to retrieve todo after all attempts/
      );
    });

    it('should handle invalid JSON data', async () => {
      // Mock invalid JSON response
      const invalidData = Buffer.from('not json');
      mockWalrusClient.readBlob.mockResolvedValueOnce(invalidData);

      await expect(storage.retrieveTodo('test-blob-id')).rejects.toThrow(
        /Failed to parse todo data/
      );
    });
  });

  describe('storeTodo', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should validate todo data', async () => {
      // Invalid todo with missing fields
      const invalidTodo = { ...mockTodo, title: undefined };
      await expect(
        storage.storeTodo(invalidTodo as unknown as Todo)
      ).rejects.toThrow(/Invalid todo: missing or invalid title/);

      // Invalid todo with wrong data types
      const wrongTypeTodo = {
        ...mockTodo,
        completed: 'yes' as unknown as boolean,
      };
      await expect(storage.storeTodo(wrongTypeTodo)).rejects.toThrow(
        /Invalid todo: invalid completed status/
      );

      // Invalid todo with invalid dates
      const invalidDateTodo = { ...mockTodo, createdAt: 'not-a-date' };
      await expect(storage.storeTodo(invalidDateTodo)).rejects.toThrow(
        /Invalid todo: invalid createdAt date/
      );
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
                $kind: 'RedStuff',
              },
              unencoded_length: '1024',
              hashes: [],
            },
          },
          deletable: true,
        },
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
            encoding: 'utf-8',
          }),
        })
      );
    });

    it('should handle data size limits', async () => {
      const largeTodo = {
        ...mockTodo,
        description: 'a'.repeat(11 * 1024 * 1024), // 11MB
      };

      await expect(storage.storeTodo(largeTodo)).rejects.toThrow(
        /Todo data is too large/
      );
    });
  });

  describe('ensureStorageAllocated', () => {
    beforeEach(async () => {
      await storage.init();
    });

    it('should allocate new storage if none exists', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({
        data: [],
        hasNextPage: false,
        nextCursor: null,
      });
      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(100),
        writeCost: BigInt(50),
        totalCost: BigInt(150),
      });
      mockWalrusClient.executeCreateStorageTransaction.mockResolvedValue({
        storage: {
          id: { id: 'test-storage-id' },
          storage_size: 1000000,
          end_epoch: 100,
          start_epoch: 1,
        },
      });

      const result = await storage.ensureStorageAllocated(1000000, 5);
      expect(result).toBeTruthy();
      expect(
        mockWalrusClient.executeCreateStorageTransaction
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          storageSize: 1000000,
          epochs: 52,
        })
      );
    });

    it('should reuse existing storage if suitable', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValueOnce({
        data: [
          {
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
                  start_epoch: '100',
                },
              },
            },
            error: null,
          },
        ],
        hasNextPage: false,
        nextCursor: null,
      });

      const result = await storage.ensureStorageAllocated(1000000, 5);
      expect(result).toBeTruthy();
      expect(
        mockWalrusClient.executeCreateStorageTransaction
      ).not.toHaveBeenCalled();
    });

    it('should handle insufficient WAL tokens', async () => {
      mockWalrusClient.executeCreateStorageTransaction.mockRejectedValueOnce(
        new Error('insufficient WAL tokens')
      );

      const result = await storage.ensureStorageAllocated(1000000, 5);
      expect(result).toBeFalsy();
    });

    it('should calculate storage costs correctly', async () => {
      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(100),
        writeCost: BigInt(50),
        totalCost: BigInt(150),
      });

      await storage.ensureStorageAllocated(1000000);
      expect(mockWalrusClient.storageCost).toHaveBeenCalledWith(1000000, 52);
    });
  });

  // Tests that can work without mocks:
  it('should be able to create walrus storage instance', () => {
    const storage = createWalrusStorage();
    expect(storage).toBeDefined();
  });

  it('should create mock storage when flag is true', () => {
    const mockStorage = createWalrusStorage(true);
    expect(mockStorage).toBeDefined();
  });
});
