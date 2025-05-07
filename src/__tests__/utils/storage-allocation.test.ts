import { jest } from '@jest/globals';
import { SuiClient } from '@mysten/sui.js/client';
import { WalrusClient } from '@mysten/walrus';
import { StorageManager } from '../../utils/storage-manager';
import { CLIError } from '../../types/error';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('StorageManager - Allocation Tests', () => {
  let storageManager: StorageManager;
  let mockSuiClient: jest.Mocked<SuiClient>;
  let mockWalrusClient: jest.Mocked<WalrusClient>;

  beforeEach(() => {
    mockSuiClient = {
      getBalance: jest.fn(),
      getLatestSuiSystemState: jest.fn(),
      getOwnedObjects: jest.fn()
    } as any;

    mockWalrusClient = {
      storageCost: jest.fn()
    } as any;

    storageManager = new StorageManager(mockSuiClient, mockWalrusClient, '0xtest');
  });

  describe('checkBalances', () => {
    it('should verify sufficient WAL balance', async () => {
      const walBalance = BigInt(1000);
      const storageBalance = BigInt(500);

      mockSuiClient.getBalance
        .mockResolvedValueOnce({ totalBalance: walBalance })
        .mockResolvedValueOnce({ totalBalance: storageBalance });

      const result = await storageManager.checkBalances();
      expect(result.walBalance).toBe(walBalance);
      expect(result.storageFundBalance).toBe(storageBalance);
      expect(result.isStorageFundSufficient).toBe(true);
    });

    it('should throw error on insufficient WAL balance', async () => {
      mockSuiClient.getBalance
        .mockResolvedValueOnce({ totalBalance: BigInt(50) });

      await expect(storageManager.checkBalances())
        .rejects
        .toThrow(CLIError);
    });

    it('should handle network errors during balance check', async () => {
      mockSuiClient.getBalance.mockRejectedValue(new Error('Network error'));

      await expect(storageManager.checkBalances())
        .rejects
        .toThrow(CLIError);
    });
  });

  describe('validateStorageRequirements', () => {
    beforeEach(() => {
      // Mock successful network environment check
      (execSync as jest.Mock).mockReturnValue(Buffer.from('testnet'));
      mockSuiClient.getLatestSuiSystemState.mockResolvedValue({ epoch: BigInt(100) });

      // Mock successful balance check
      mockSuiClient.getBalance
        .mockResolvedValueOnce({ totalBalance: BigInt(1000) }) // WAL balance
        .mockResolvedValueOnce({ totalBalance: BigInt(500) }); // Storage balance

      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(100),
        writeCost: BigInt(50),
        totalCost: BigInt(150)
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should validate storage requirements with sufficient balance', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValue({
        hasNextPage: false,
        data: [],
        nextCursor: null
      });

      const result = await storageManager.validateStorageRequirements(1024);
      expect(result.canProceed).toBe(true);
      expect(result.requiredCost?.totalCost).toBe(BigInt(150));
      expect(result.balances?.walBalance).toBe(BigInt(1000));
    });

    it('should indicate insufficient balance for storage', async () => {
      // Mock low WAL balance
      mockSuiClient.getBalance
        .mockReset()
        .mockResolvedValueOnce({ totalBalance: BigInt(10) }) // WAL balance
        .mockResolvedValueOnce({ totalBalance: BigInt(5) }); // Storage balance

      // No existing storage
      mockSuiClient.getOwnedObjects.mockResolvedValue({
        hasNextPage: false,
        data: [],
        nextCursor: null
      });

      // Storage cost higher than balance
      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(1000),
        writeCost: BigInt(500),
        totalCost: BigInt(1500)
      });

      await expect(storageManager.validateStorageRequirements(1024))
        .rejects
        .toThrow(CLIError);
    });

    it('should detect and use existing storage if available', async () => {
      const mockStorage = {
        hasNextPage: false,
        data: [{
          data: {
            objectId: '0xstorage',
            content: {
              dataType: 'moveObject',
              fields: {
                storage_size: '20480',
                used_size: '1024',
                end_epoch: '200'
              }
            }
          }
        }],
        nextCursor: null
      };
      
      mockSuiClient.getOwnedObjects.mockResolvedValue(mockStorage);

      const result = await storageManager.validateStorageRequirements(1024);
      expect(result.canProceed).toBe(true);
      expect(result.existingStorage?.isValid).toBe(true);
      expect(result.existingStorage?.details?.id).toBe('0xstorage');
    });
  });
});