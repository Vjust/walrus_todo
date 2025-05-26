import { StorageReuseAnalyzer } from '../../src/utils/storage-reuse-analyzer';
import { SuiClient, type SuiClientType } from '../../src/utils/adapters/sui-client-compatibility';
import { WalrusClient } from '../../src/types/client';
import { createWalrusClientMock, setupDefaultWalrusClientMocks, type MockWalrusClient } from '../../src/__tests__/helpers/walrus-client-mock';

// Mock the SuiClient and WalrusClient
jest.mock('@mysten/sui/client');
jest.mock('@mysten/walrus');

describe('StorageReuseAnalyzer', () => {
  let storageReuseAnalyzer: StorageReuseAnalyzer;
  let mockSuiClient: jest.Mocked<SuiClientType>;
  let mockWalrusClient: MockWalrusClient;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockSuiClient = new SuiClient({
      url: 'mock-url',
    }) as jest.Mocked<typeof SuiClient>;
    
    // Create proper WalrusClient mock
    mockWalrusClient = createWalrusClientMock();
    setupDefaultWalrusClientMocks(mockWalrusClient);

    // Mock the getLatestSuiSystemState method
    mockSuiClient.getLatestSuiSystemState = jest.fn().mockResolvedValue({
      epoch: '1000',
    });

    // Override storageCost with proper bigint values
    mockWalrusClient.storageCost.mockResolvedValue({
      storageCost: BigInt(5000),
      writeCost: BigInt(1000),
      totalCost: BigInt(6000),
    });

    // Create the analyzer instance
    storageReuseAnalyzer = new StorageReuseAnalyzer(
      mockSuiClient,
      mockWalrusClient as unknown as WalrusClient,
      '0xmockAddress'
    );
  });

  describe('findBestStorageForReuse', () => {
    it('should return no viable storage when no storage objects exist', async () => {
      // Mock the getOwnedObjects to return empty array
      mockSuiClient.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [],
      });

      const result = await storageReuseAnalyzer.findBestStorageForReuse(1024);

      expect(result.hasViableStorage).toBe(false);
      expect(result.bestMatch).toBeNull();
      expect(result.totalStorage).toBe(0);
      expect(result.usedStorage).toBe(0);
      expect(result.recommendation).toBe('allocate-new');
    });

    it('should find and return the best viable storage object', async () => {
      // Mock the getOwnedObjects to return storage objects
      mockSuiClient.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [
          {
            data: {
              objectId: 'storage-1',
              content: {
                dataType: 'moveObject',
                fields: {
                  storage_size: '2000000', // 2MB
                  used_size: '500000', // 500KB
                  end_epoch: 1100, // 100 epochs remaining
                  start_epoch: 900,
                },
              },
            },
          },
          {
            data: {
              objectId: 'storage-2',
              content: {
                dataType: 'moveObject',
                fields: {
                  storage_size: '1000000', // 1MB
                  used_size: '800000', // 800KB
                  end_epoch: 1050, // 50 epochs remaining
                  start_epoch: 950,
                },
              },
            },
          },
          {
            data: {
              objectId: 'storage-3',
              content: {
                dataType: 'moveObject',
                fields: {
                  storage_size: '5000000', // 5MB
                  used_size: '4500000', // 4.5MB
                  end_epoch: 1200, // 200 epochs remaining
                  start_epoch: 800,
                },
              },
            },
          },
        ],
      });

      // Test looking for 100KB of storage
      const result = await storageReuseAnalyzer.findBestStorageForReuse(100000);

      expect(result.hasViableStorage).toBe(true);
      expect(result.bestMatch).not.toBeNull();
      expect(result.bestMatch?.id).toBe('storage-2'); // Best fit for 100KB
      expect(result.totalStorage).toBe(8000000); // 8MB total
      expect(result.usedStorage).toBe(5800000); // 5.8MB used
      expect(result.recommendation).toBe('use-existing');
    });

    it('should recommend allocate-new when no viable storage exists', async () => {
      // Mock the getOwnedObjects to return expired storage objects
      mockSuiClient.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [
          {
            data: {
              objectId: 'storage-expired',
              content: {
                dataType: 'moveObject',
                fields: {
                  storage_size: '1000000', // 1MB
                  used_size: '500000', // 500KB
                  end_epoch: 990, // Expired (current epoch is 1000)
                  start_epoch: 900,
                },
              },
            },
          },
        ],
      });

      const result = await storageReuseAnalyzer.findBestStorageForReuse(100000);

      expect(result.hasViableStorage).toBe(false);
      expect(result.bestMatch).toBeNull();
      expect(result.activeStorageCount).toBe(0);
      expect(result.inactiveStorageCount).toBe(1);
      expect(result.recommendation).toBe('allocate-new');
    });

    it('should recommend extend-existing when storage exists but is insufficient', async () => {
      // Mock the getOwnedObjects to return storage with insufficient space
      mockSuiClient.getOwnedObjects = jest.fn().mockResolvedValue({
        data: [
          {
            data: {
              objectId: 'storage-insufficient',
              content: {
                dataType: 'moveObject',
                fields: {
                  storage_size: '1000000', // 1MB
                  used_size: '990000', // 990KB (only 10KB left)
                  end_epoch: 1050, // 50 epochs remaining
                  start_epoch: 950,
                },
              },
            },
          },
        ],
      });

      // Test looking for 50KB of storage (more than the 10KB available)
      const result = await storageReuseAnalyzer.findBestStorageForReuse(50000);

      expect(result.hasViableStorage).toBe(false);
      expect(result.bestMatch).toBeNull();
      expect(result.activeStorageCount).toBe(1);
      expect(result.recommendation).toBe('extend-existing');
    });
  });

  describe('analyzeStorageEfficiency', () => {
    it('should calculate cost savings when reusing existing storage', async () => {
      // Mock the findBestStorageForReuse method
      jest
        .spyOn(storageReuseAnalyzer as StorageReuseAnalyzer & { findBestStorageForReuse: () => Promise<unknown> }, 'findBestStorageForReuse')
        .mockResolvedValue({
          bestMatch: {
            id: 'storage-1',
            totalSize: 2000000,
            usedSize: 500000,
            endEpoch: 1100,
            startEpoch: 900,
            remaining: 1500000,
            active: true,
          },
          totalStorage: 2000000,
          usedStorage: 500000,
          availableStorage: 1500000,
          activeStorageCount: 1,
          inactiveStorageCount: 0,
          hasViableStorage: true,
          recommendation: 'use-existing',
        });

      // Mock the storageCost method for our test
      mockWalrusClient.storageCost.mockResolvedValue({
        storageCost: BigInt(5000),
        writeCost: BigInt(1000),
        totalCost: BigInt(6000),
      });

      const result =
        await storageReuseAnalyzer.analyzeStorageEfficiency(100000);

      expect(result.analysisResult.recommendation).toBe('use-existing');
      expect(result.costComparison.newStorageCost).toBe(BigInt(6000));
      expect(result.costComparison.reuseExistingSavings).toBe(BigInt(5000));
      expect(result.costComparison.reuseExistingPercentSaved).toBe(83);
      expect(result.detailedRecommendation).toContain('Reuse existing storage');
      expect(result.detailedRecommendation).toContain('storage-1');
    });

    it('should recommend allocating new storage when no viable storage exists', async () => {
      // Mock the findBestStorageForReuse method
      jest
        .spyOn(storageReuseAnalyzer as StorageReuseAnalyzer & { findBestStorageForReuse: () => Promise<unknown> }, 'findBestStorageForReuse')
        .mockResolvedValue({
          bestMatch: null,
          totalStorage: 1000000,
          usedStorage: 990000,
          availableStorage: 10000,
          activeStorageCount: 1,
          inactiveStorageCount: 0,
          hasViableStorage: false,
          recommendation: 'allocate-new',
        });

      const result =
        await storageReuseAnalyzer.analyzeStorageEfficiency(100000);

      expect(result.analysisResult.recommendation).toBe('allocate-new');
      expect(result.costComparison.reuseExistingSavings).toBe(BigInt(0));
      expect(result.costComparison.reuseExistingPercentSaved).toBe(0);
      expect(result.detailedRecommendation).toContain('Allocate new storage');
    });
  });
});
