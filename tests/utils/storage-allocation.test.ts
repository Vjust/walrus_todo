import { jest } from '@jest/globals';
import { SuiClient } from '../../../apps/cli/src/utils/adapters/sui-client-compatibility';

// Define CoinBalance type locally since it's not exported
interface CoinBalance {
  coinType: string;
  coinObjectCount: number;
  totalBalance: string;
  lockedBalance: Record<string, string>;
}
import { WalrusClient } from '../../src/types/client';
import { StorageManager } from '../../src/utils/StorageManager';
import { CLIError } from '../../src/types/errors/consolidated';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('StorageManager - Allocation Tests', () => {
  let storageManager: StorageManager;
  let mockSuiClient: jest.Mocked<typeof SuiClient>;
  let mockWalrusClient: jest.Mocked<WalrusClient>;

  beforeEach(() => {
    mockSuiClient = {
      getBalance: jest.fn(),
      getLatestSuiSystemState: jest.fn(),
      getOwnedObjects: jest.fn(),
    } as jest.Mocked<typeof SuiClient>;

    mockWalrusClient = {
      storageCost: jest.fn(),
      getConfig: jest.fn(),
      getWalBalance: jest.fn(),
      getStorageUsage: jest.fn(),
      getBlobObject: jest.fn(),
      verifyPoA: jest.fn(),
      executeCreateStorageTransaction: jest.fn(),
      readBlob: jest.fn(),
      writeBlob: jest.fn(),
      getBlobInfo: jest.fn(),
      connect: jest.fn(),
      getBlobMetadata: jest.fn(),
      getStorageProviders: jest.fn(),
      getBlobSize: jest.fn(),
      reset: jest.fn(),
    } as jest.Mocked<WalrusClient>;

    storageManager = new StorageManager(
      mockSuiClient,
      mockWalrusClient,
      '0xtest'
    );
  });

  describe('checkBalances', () => {
    it('should verify sufficient WAL balance', async () => {
      const walBalance = '1000';
      const storageBalance = '500';

      mockSuiClient.getBalance
        .mockResolvedValueOnce({
          coinType: 'WAL',
          totalBalance: walBalance,
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance)
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: storageBalance,
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance);

      const result = await storageManager.checkBalances();
      expect(result.walBalance.toString()).toBe(walBalance);
      expect(result.storageFundBalance.toString()).toBe(storageBalance);
      expect(result.isStorageFundSufficient).toBe(true);
    });

    it('should throw error on insufficient WAL balance', async () => {
      mockSuiClient.getBalance.mockResolvedValueOnce({
        coinType: 'WAL',
        totalBalance: '50',
        coinObjectCount: 1,
        lockedBalance: { number: '0' },
      } as CoinBalance);

      await expect(storageManager.checkBalances()).rejects.toThrow(CLIError);
    });

    it('should handle network errors during balance check', async () => {
      mockSuiClient.getBalance.mockRejectedValue(new Error('Network error'));

      await expect(storageManager.checkBalances()).rejects.toThrow(CLIError);
    });
  });

  describe('validateStorageRequirements', () => {
    beforeEach(() => {
      // Mock successful network environment check
      (execSync as jest.Mock).mockReturnValue(Buffer.from('testnet'));
      mockSuiClient.getLatestSuiSystemState.mockResolvedValue({
        epoch: '100',
        protocolVersion: '1',
        referenceGasPrice: '1000',
        totalStake: '1000000',
        storageFund: {
          totalObjectStorageRebates: '0',
          nonRefundableBalance: '10000',
        },
        activeValidators: [],
        atRiskValidators: [],
        pendingActiveValidatorsSize: '0',
        pendingRemovals: [],
        stakingPoolMappingsSize: '0',
        inactivePoolsSize: '0',
        validatorReportRecords: [],
        atRiskValidatorSize: '0',
        validatorCandidatesSize: '0',
        validatorLowStakeThreshold: '1000',
        validatorLowStakeGracePeriod: '10',
        validatorVeryLowStakeThreshold: '500',
        validatorVeryLowStakeGracePeriod: '5',
        systemStateVersion: '1',
        maxValidatorCount: '100',
        minValidatorCount: '10',
        validatorLowStakeThresholdMetadata: {},
        stakeSubsidyStartEpoch: '0',
        stakeSubsidyBalance: '1000',
        stakeSubsidyDistributionCounter: '0',
        stakeSubsidyCurrentDistributionAmount: '100',
        stakeSubsidyPeriodLength: '10',
        stakeSubsidyDecreaseRate: '10',
        totalGasFeesCollected: '1000',
        totalStakeRewardsDistributed: '100',
        totalStakeSubsidiesDistributed: '100',
        validatorReportRecordsSize: '0',
        systemParameters: {},
        systemStakeSubsidy: {},
        satInCirculation: '1000000',
        epochDurationMs: '86400000',
      });

      // Mock successful balance check
      mockSuiClient.getBalance
        .mockResolvedValueOnce({
          coinType: 'WAL',
          totalBalance: '1000',
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance) // WAL balance
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: '500',
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance); // Storage balance

      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(100),
        writeCost: BigInt(50),
        totalCost: BigInt(150),
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should validate storage requirements with sufficient balance', async () => {
      mockSuiClient.getOwnedObjects.mockResolvedValue({
        hasNextPage: false,
        data: [],
        nextCursor: null,
      });

      const result = await storageManager.validateStorageRequirements(1024);
      expect(result.canProceed).toBe(true);
      expect(result.requiredCost?.totalCost.toString()).toBe('150');
      expect(result.balances?.walBalance.toString()).toBe('1000');
    });

    it('should indicate insufficient balance for storage', async () => {
      // Mock low WAL balance
      mockSuiClient.getBalance
        .mockReset()
        .mockResolvedValueOnce({
          coinType: 'WAL',
          totalBalance: '10',
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance) // WAL balance
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: '5',
          coinObjectCount: 1,
          lockedBalance: { number: '0' },
        } as CoinBalance); // Storage balance

      // No existing storage
      mockSuiClient.getOwnedObjects.mockResolvedValue({
        hasNextPage: false,
        data: [],
        nextCursor: null,
      });

      // Storage cost higher than balance
      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(1000),
        writeCost: BigInt(500),
        totalCost: BigInt(1500),
      });

      await expect(
        storageManager.validateStorageRequirements(1024)
      ).rejects.toThrow(CLIError);
    });

    it('should detect and use existing storage if available', async () => {
      const mockStorage = {
        hasNextPage: false,
        data: [
          {
            data: {
              objectId: '0xstorage',
              version: '1',
              digest: 'mock-digest',
              content: {
                dataType: 'moveObject' as const,
                type: '0x2::storage::Storage',
                hasPublicTransfer: true,
                fields: {
                  storage_size: '20480',
                  used_size: '1024',
                  end_epoch: 200,
                },
              },
            },
          },
        ],
        nextCursor: null,
      };

      mockSuiClient.getOwnedObjects.mockResolvedValue(mockStorage);

      const result = await storageManager.validateStorageRequirements(1024);
      expect(result.canProceed).toBe(true);
      expect(result.existingStorage?.isValid).toBe(true);
      expect(result.existingStorage?.details?.id).toBe('0xstorage');
    });
  });
});
