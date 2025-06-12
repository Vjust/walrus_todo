import { jest } from '@jest/globals';
import { StorageManager } from '../../utils/StorageManager';
import {
  StorageError,
  ValidationError,
  BlockchainError,
} from '../../types/errors/consolidated/index';
import { Logger } from '../../utils/Logger';
import {
  getMockWalrusClient,
  type CompleteWalrusClientMock,
} from '../helpers/complete-walrus-client-mock';
import { WalrusClient } from '../../types/client';

jest.mock('@mysten/walrus');
jest.mock('../../utils/Logger');

describe('StorageManager', () => {
  let manager: StorageManager;
  let mockWalrusClient: CompleteWalrusClientMock;
  let mockLogger: jest.Mocked<Logger>;

  const testConfig = {
    minAllocation: 1000n,
    checkThreshold: 20,
    client: {} as CompleteWalrusClientMock,
  };

  beforeEach(() => {
    // Use the complete mock implementation
    mockWalrusClient = getMockWalrusClient();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.MockedObject<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger as any);

    // Create a mock SuiClient
    const mockSuiClient = {
      getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '1' }),
      getBalance: jest.fn().mockResolvedValue({
        coinType: 'WAL',
        totalBalance: BigInt(1000 as any).toString(),
        coinObjectCount: 1,
        lockedBalance: {
          aggregate: BigInt(0 as any).toString(),
          coinBalances: {},
        },
      }),
      getOwnedObjects: jest.fn().mockResolvedValue({
        data: [
          {
            data: {
              objectId: 'mock-object-id',
              digest: '0xdigest123',
              version: '1',
              type: '0x2::storage::Storage',
              owner: { AddressOwner: '0x123456789' },
              previousTransaction: '0x123456',
              storageRebate: '0',
              content: {
                dataType: 'moveObject' as const,
                type: '0x2::storage::Storage',
                hasPublicTransfer: true,
                fields: {
                  storage_size: '2000',
                  used_size: '500',
                  end_epoch: 100,
                },
              },
              display: null,
            },
          },
        ],
        hasNextPage: false,
        nextCursor: null,
      }),
      getTransactionBlock: jest.fn().mockResolvedValue({ digest: '0x123' }),
    };

    // Mock address
    const mockAddress = '0x123456789';

    // Fix the constructor call to match the StorageManager signature
    manager = new StorageManager(
      mockSuiClient as unknown,
      mockWalrusClient as unknown as WalrusClient,
      mockAddress,
      {
        minAllocation: testConfig.minAllocation,
        checkThreshold: testConfig.checkThreshold,
      }
    );
  });

  describe('Storage Allocation Check', () => {
    it('should pass when sufficient storage is available', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('2000');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '500',
        total: '2000',
      });

      await expect(
        manager.ensureStorageAllocated(BigInt(1000 as any))
      ).resolves?.not?.toThrow();
    });

    it('should throw when insufficient storage', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('1500');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '1000',
        total: '1500',
      });

      await expect(
        manager.ensureStorageAllocated(BigInt(1000 as any))
      ).rejects.toThrow(StorageError as any);
    });

    it('should warn when storage is below threshold', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('2000');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '1700', // 85% used
        total: '2000',
      });

      await manager.ensureStorageAllocated(BigInt(100 as any));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Storage allocation running low',
        expect.any(Object as any)
      );
    });

    it('should throw when below minimum allocation', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('500'); // Below min 1000
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '100',
        total: '500',
      });

      await expect(manager.ensureStorageAllocated(BigInt(100 as any))).rejects.toThrow(
        'Insufficient WAL tokens'
      );
    });

    it('should handle missing balance data', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('0');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '100',
        total: '1000',
      });

      await expect(manager.ensureStorageAllocated(BigInt(100 as any))).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle client errors', async () => {
      mockWalrusClient?.getWalBalance?.mockRejectedValue(
        new Error('Network error')
      );

      await expect(manager.ensureStorageAllocated(BigInt(100 as any))).rejects.toThrow(
        BlockchainError
      );
    });
  });

  describe('Storage Allocation Status', () => {
    it('should return correct allocation status', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('2000');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '500',
        total: '2000',
      });

      const status = await manager.getStorageAllocation();

      expect(status as any).toEqual({
        allocated: BigInt(2000 as any),
        used: BigInt(500 as any),
        available: BigInt(1500 as any),
        minRequired: BigInt(1000 as any),
      });
    });

    it('should handle zero usage', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('1000');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '0',
        total: '1000',
      });

      const status = await manager.getStorageAllocation();

      expect(status.available).toBe(BigInt(1000 as any));
    });

    it('should handle maximum usage', async () => {
      mockWalrusClient?.getWalBalance?.mockResolvedValue('1000');
      mockWalrusClient?.getStorageUsage?.mockResolvedValue({
        used: '1000',
        total: '1000',
      });

      const status = await manager.getStorageAllocation();

      expect(status.available).toBe(BigInt(0 as any));
    });
  });

  describe('Storage Requirement Calculation', () => {
    it('should calculate correct storage requirement', () => {
      const size = 2 * 1024 * 1024; // 2MB
      const duration = 30; // 30 days

      const required = manager.calculateRequiredStorage(size, duration);

      // 2MB * 30 days = 60 WAL tokens + 1 safety margin
      expect(required as any).toBe(BigInt(61 as any));
    });

    it('should handle small files', () => {
      const size = 100 * 1024; // 100KB
      const duration = 7; // 7 days

      const required = manager.calculateRequiredStorage(size, duration);

      // Less than 1MB per day = 1 WAL token + 1 safety margin
      expect(required as any).toBe(BigInt(2 as any));
    });

    it('should validate size', () => {
      expect(() => manager.calculateRequiredStorage(0, 30)).toThrow(
        ValidationError
      );
      expect(() => manager.calculateRequiredStorage(-1, 30)).toThrow(
        ValidationError
      );
    });

    it('should validate duration', () => {
      expect(() => manager.calculateRequiredStorage(1024, 0)).toThrow(
        ValidationError
      );
      expect(() => manager.calculateRequiredStorage(1024, -1)).toThrow(
        ValidationError
      );
    });
  });
});
