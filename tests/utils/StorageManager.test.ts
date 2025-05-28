import { jest } from '@jest/globals';
import { WalrusClient } from '../../apps/cli/src/types/client';
import { StorageManager } from '../../apps/cli/src/utils/StorageManager';
import {
  StorageError,
  ValidationError,
  BlockchainError,
} from '../../apps/cli/src/types/errors/consolidated';
import { Logger } from '../../apps/cli/src/utils/Logger';
import { createWalrusClientMock, setupDefaultWalrusClientMocks, type MockWalrusClient } from '../../apps/cli/src/__tests__/helpers/walrus-client-mock';

jest.mock('@mysten/walrus');
jest.mock('../../apps/cli/src/utils/Logger');

describe('StorageManager', () => {
  let manager: StorageManager;
  let mockWalrusClient: MockWalrusClient;
  let mockSuiClient: unknown;
  let mockLogger: jest.MockedObject<Logger>;

  const testConfig = {
    minAllocation: 1000n,
    checkThreshold: 20,
    client: {} as Record<string, unknown>,
  };

  beforeEach(() => {
    mockSuiClient = {
      // Add any required sui client methods here
    };

    // Create proper WalrusClient mock with all required methods
    mockWalrusClient = createWalrusClientMock();
    setupDefaultWalrusClientMocks(mockWalrusClient);

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.MockedObject<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    // Override default mock return values for StorageManager tests
    mockWalrusClient.getWalBalance.mockResolvedValue('1000');
    mockWalrusClient.getStorageUsage.mockResolvedValue({
      used: '100',
      total: '1000',
    });
    mockWalrusClient.storageCost.mockResolvedValue({
      storageCost: BigInt(100),
      writeCost: BigInt(50),
      totalCost: BigInt(150),
    });

    manager = new StorageManager(
      mockSuiClient,
      mockWalrusClient as unknown as WalrusClient,
      'test-address',
      testConfig
    );
  });

  describe('Storage Allocation Check', () => {
    it('should pass when sufficient storage is available', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('2000');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '500',
        total: '2000',
      });

      await expect(
        manager.ensureStorageAllocated(1000n)
      ).resolves.not.toThrow();
    });

    it('should throw when insufficient storage', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('1500');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1000',
        total: '1500',
      });

      await expect(manager.ensureStorageAllocated(1000n)).rejects.toThrow(
        StorageError
      );
    });

    it('should warn when storage is below threshold', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('2000');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1700', // 85% used
        total: '2000',
      });

      await manager.ensureStorageAllocated(100n);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Storage allocation running low',
        expect.any(Object)
      );
    });

    it('should throw when below minimum allocation', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('500'); // Below min 1000
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '100',
        total: '500',
      });

      await expect(manager.ensureStorageAllocated(100n)).rejects.toThrow(
        'Insufficient WAL tokens'
      );
    });

    it('should handle missing balance data', async () => {
      // Mock getWalBalance to return null to simulate missing data
      mockWalrusClient.getWalBalance.mockResolvedValue(null as unknown as string);
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '100',
        total: '1000',
      });

      await expect(manager.ensureStorageAllocated(100n)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle missing storage usage data', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('1500');
      // Mock getStorageUsage to return null to simulate missing data
      mockWalrusClient.getStorageUsage.mockResolvedValue(null as unknown as { used: string; total: string });

      await expect(manager.ensureStorageAllocated(100n)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle client errors', async () => {
      mockWalrusClient.getWalBalance.mockRejectedValue(
        new Error('Network error')
      );

      await expect(manager.ensureStorageAllocated(100n)).rejects.toThrow(
        BlockchainError
      );
    });
  });

  describe('Storage Allocation Status', () => {
    it('should return correct allocation status', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('2000');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '500',
        total: '2000',
      });

      const status = await manager.getStorageAllocation();

      expect(status).toEqual({
        allocated: 2000n,
        used: 500n,
        available: 1500n,
        minRequired: 1000n,
      });
    });

    it('should handle zero usage', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('1000');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '0',
        total: '1000',
      });

      const status = await manager.getStorageAllocation();

      expect(status.available).toBe(1000n);
    });

    it('should handle maximum usage', async () => {
      mockWalrusClient.getWalBalance.mockResolvedValue('1000');
      mockWalrusClient.getStorageUsage.mockResolvedValue({
        used: '1000',
        total: '1000',
      });

      const status = await manager.getStorageAllocation();

      expect(status.available).toBe(0n);
    });
  });

  describe('Storage Requirement Calculation', () => {
    it('should calculate correct storage requirement', () => {
      const size = 2 * 1024 * 1024; // 2MB
      const duration = 30; // 30 days

      const required = manager.calculateRequiredStorage(size, duration);

      // 2MB * 30 days = 60 WAL tokens + 1 safety margin
      expect(required).toBe(61n);
    });

    it('should handle small files', () => {
      const size = 100 * 1024; // 100KB
      const duration = 7; // 7 days

      const required = manager.calculateRequiredStorage(size, duration);

      // Less than 1MB per day = 1 WAL token + 1 safety margin
      expect(required).toBe(2n);
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
