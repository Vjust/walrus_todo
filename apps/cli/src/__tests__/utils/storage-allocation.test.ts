import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { execSync } from 'child_process';
import { StorageManager } from '../../utils/storage-manager';
import { CLIError } from '../../types/errors/consolidated';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// Define CoinBalance type locally if not exported
interface CoinBalance {
  coinType: string;
  coinObjectCount: number;
  totalBalance: string;
  lockedBalance: Record<string, string>;
}

describe('StorageManager - Allocation Tests', () => {
  let storageManager: StorageManager;
  let mockSuiClient: {
    getLatestSuiSystemState: jest.Mock;
    getBalance: jest.Mock;
    getOwnedObjects: jest.Mock;
  };
  let mockWalrusClient: {
    upload: jest.Mock;
    downloadBlob: jest.Mock;
    storageCost: jest.Mock;
    getConfig: jest.Mock;
    getWalBalance: jest.Mock;
    getStorageUsage: jest.Mock;
    getBlobInfo: jest.Mock;
    getBlobObject: jest.Mock;
    getBlobSize: jest.Mock;
    verifyPoA: jest.Mock;
    writeBlob: jest.Mock;
    readBlob: jest.Mock;
    getBlobMetadata: jest.Mock;
    executeCreateStorageTransaction: jest.Mock;
    executeCertifyBlobTransaction: jest.Mock;
    executeWriteBlobAttributesTransaction: jest.Mock;
    deleteBlob: jest.Mock;
    executeRegisterBlobTransaction: jest.Mock;
    getStorageConfirmationFromNode: jest.Mock;
    createStorageBlock: jest.Mock;
    createStorage: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSuiClient = {
      getBalance: jest.fn(),
      getLatestSuiSystemState: jest.fn(),
      getOwnedObjects: jest.fn(),
    };

    mockWalrusClient = {
      upload: jest.fn(),
      downloadBlob: jest.fn(),
      storageCost: jest.fn(),
      getConfig: jest
        .fn()
        .mockResolvedValue({
          network: 'testnet',
          version: '1.0.0',
          maxSize: 1000000,
        }),
      getWalBalance: jest.fn().mockResolvedValue('2000'),
      getStorageUsage: jest
        .fn()
        .mockResolvedValue({ used: '500', total: '2000' }),
      getBlobInfo: jest.fn(),
      getBlobObject: jest.fn(),
      getBlobSize: jest.fn(),
      verifyPoA: jest.fn(),
      writeBlob: jest.fn(),
      readBlob: jest.fn(),
      getBlobMetadata: jest.fn(),
      executeCreateStorageTransaction: jest.fn(),
      executeCertifyBlobTransaction: jest.fn(),
      executeWriteBlobAttributesTransaction: jest.fn(),
      deleteBlob: jest.fn(),
      executeRegisterBlobTransaction: jest.fn(),
      getStorageConfirmationFromNode: jest.fn(),
      createStorageBlock: jest.fn(),
      createStorage: jest.fn(),
    };

    storageManager = new StorageManager(
      mockSuiClient,
      mockWalrusClient,
      '0xtest'
    );
  });

  describe('checkBalances', () => {
    it('should verify sufficient WAL balance', async () => {
      const walBalance = BigInt(1000);
      const storageBalance = BigInt(500);

      mockSuiClient.getBalance
        .mockResolvedValueOnce({
          coinType: 'WAL',
          totalBalance: walBalance.toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance)
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: storageBalance.toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance);

      const result = await storageManager.checkBalances();
      expect(result.walBalance).toBe(walBalance);
      expect(result.storageFundBalance).toBe(storageBalance);
      expect(result.isStorageFundSufficient).toBe(true);
    });

    it('should throw error on insufficient WAL balance', async () => {
      mockSuiClient.getBalance.mockResolvedValueOnce({
        coinType: 'WAL',
        totalBalance: BigInt(50).toString(),
        coinObjectCount: 1,
        lockedBalance: {
          aggregate: BigInt(0).toString(),
          coinBalances: {} as Record<string, string>,
        },
      } as unknown as CoinBalance);

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
        storageFund: '10000',
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
          totalBalance: BigInt(1000).toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance) // WAL balance
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: BigInt(500).toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance); // Storage balance

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
      expect(result.requiredCost?.totalCost).toBe(BigInt(150).toString());
      expect(result.balances?.walBalance).toBe(BigInt(1000).toString());
    });

    it('should indicate insufficient balance for storage', async () => {
      // Mock low WAL balance
      mockSuiClient.getBalance
        .mockReset()
        .mockResolvedValueOnce({
          coinType: 'WAL',
          totalBalance: BigInt(10).toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance) // WAL balance
        .mockResolvedValueOnce({
          coinType: 'STORAGE',
          totalBalance: BigInt(5).toString(),
          coinObjectCount: 1,
          lockedBalance: {
            aggregate: BigInt(0).toString(),
            coinBalances: {},
          },
        } as unknown as CoinBalance); // Storage balance

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
              digest: '0xdigest123',
              version: '1',
              type: '0x2::storage::Storage',
              owner: { AddressOwner: '0xtest' },
              content: {
                dataType: 'moveObject',
                type: '0x2::storage::Storage',
                hasPublicTransfer: true,
                fields: {
                  storage_size: '20480',
                  used_size: '1024',
                  end_epoch: '200',
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
