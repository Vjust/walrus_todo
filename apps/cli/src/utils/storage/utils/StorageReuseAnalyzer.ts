/**
 * @fileoverview Storage Reuse Analyzer - Optimizes storage allocation and reuse
 *
 * This utility class analyzes and optimizes blockchain storage usage by finding the
 * best existing storage objects to reuse, calculating cost savings, and providing
 * recommendations on allocation strategies. It uses a best-fit algorithm to minimize
 * wasted space and token costs.
 */

import { SuiClientType } from '../../adapters/sui-client-compatibility';
import { WalrusClientAdapter } from '../../adapters/walrus-client-adapter';
import { StorageOperationHandler } from './StorageOperationHandler';
import { ValidationError } from '../../../types/errors/consolidated';

/**
 * Storage object representation for analysis
 */
export interface StorageObject {
  /** Unique identifier for the storage object on-chain */
  id: string;
  /** Total size allocated for this storage object in bytes */
  totalSize: number;
  /** Currently used size within this storage object in bytes */
  usedSize: number;
  /** Epoch when this storage allocation expires */
  endEpoch: number;
  /** Epoch when this storage allocation began */
  startEpoch: number;
  /** Remaining available bytes in this storage object (totalSize - usedSize) */
  remaining: number;
  /** Whether the storage is still active (not expired) */
  active: boolean;
}

/**
 * Results of storage analysis containing recommendation and detailed metrics
 */
export interface StorageAnalysis {
  /** Best matching storage object for reuse based on required size and fit algorithm */
  bestMatch: StorageObject | null;
  /** Total storage space allocated across all objects in bytes */
  totalStorage: number;
  /** Total storage space currently in use across all objects in bytes */
  usedStorage: number;
  /** Total available storage space (totalStorage - usedStorage) */
  availableStorage: number;
  /** Count of storage objects that are still active (not expired) */
  activeStorageCount: number;
  /** Count of storage objects that have expired */
  inactiveStorageCount: number;
  /** Whether any viable storage objects were found that meet the requirements */
  hasViableStorage: boolean;
  /**
   * Recommended action based on analysis:
   * - 'use-existing': Reuse an existing storage object
   * - 'allocate-new': Create a new storage allocation
   * - 'extend-existing': Extend an existing storage object with more space
   */
  recommendation: 'use-existing' | 'allocate-new' | 'extend-existing';
}

/**
 * Utility class that analyzes and optimizes Walrus blockchain storage usage.
 */
export class StorageReuseAnalyzer {
  /** Minimum buffer space that must remain in storage after use (1MB) - Reserved for future use */
  private _minRemainingBuffer = 1024 * 1024; // 1MB minimum remaining buffer
  /** Minimum number of epochs that must remain before storage expiration */
  private minEpochsRemaining = 10; // Minimum epochs remaining

  /**
   * Creates a new StorageReuseAnalyzer instance.
   *
   * @param suiClient - Client for interacting with the Sui blockchain
   * @param walrusClient - Client for interacting with Walrus storage service
   * @param userAddress - Address of the user whose storage will be analyzed
   */
  constructor(
    private suiClient: SuiClientType,
    private walrusClient: WalrusClientAdapter,
    private userAddress: string
  ) {}

  /**
   * Finds the best storage object for reuse based on required size using a best-fit algorithm.
   *
   * @param requiredSize - The size in bytes needed for storage
   * @param bufferSize - Optional additional buffer to ensure (defaults to 10KB)
   * @returns Analysis result with detailed metrics and recommendation
   * @throws {ValidationError} if storage analysis fails
   */
  async findBestStorageForReuse(
    requiredSize: number,
    bufferSize: number = 10240
  ): Promise<StorageAnalysis> {
    try {
      // Get the current epoch from the Sui blockchain
      const epochResult = await StorageOperationHandler.execute(
        () => this?.suiClient?.getLatestSuiSystemState(),
        { operation: 'get epoch for storage analysis' }
      );

      if (!epochResult.success || !epochResult.data?.epoch) {
        throw new ValidationError('Failed to get current epoch', {
          operation: 'storage analysis',
          recoverable: true,
          cause: epochResult.error,
        });
      }

      const currentEpoch = Number(epochResult?.data?.epoch);

      // Fetch all storage objects owned by this address from the blockchain
      const objectsResult = await StorageOperationHandler.execute(
        () =>
          this?.suiClient?.getOwnedObjects({
            owner: this.userAddress,
            filter: { StructType: '0x2::storage::Storage' },
            options: { showContent: true },
          }),
        { operation: 'get storage objects for analysis' }
      );

      if (!objectsResult.success) {
        throw new ValidationError('Failed to get storage objects', {
          operation: 'storage analysis',
          recoverable: true,
          cause: objectsResult.error,
        });
      }

      // Initialize counters and collection for storage metrics
      const storageObjects: StorageObject[] = [];
      let totalStorage = 0;
      let usedStorage = 0;
      let activeCount = 0;
      let inactiveCount = 0;

      // Process and extract data from each storage object
      for (const item of objectsResult?.data?.data) {
        // Skip if no content or not a move object
        if (
          !item.data?.content ||
          (item?.data?.content as { dataType?: string }).dataType !== 'moveObject'
        ) {
          continue;
        }

        // Parse storage fields from the move object
        const content = item?.data?.content as {
          fields?: {
            storage_size?: string;
            used_size?: string;
            end_epoch?: string;
            start_epoch?: string;
          };
        };
        if (!content.fields) continue;

        const fields = content.fields;
        const totalSize = Number(fields.storage_size);
        const usedSize = Number(fields.used_size || 0);
        const endEpoch = Number(fields.end_epoch);
        const startEpoch = Number(fields.start_epoch || 0);
        const remaining = totalSize - usedSize;
        const active = endEpoch > currentEpoch;

        // Accumulate totals for the analysis metrics
        totalStorage += totalSize;
        usedStorage += usedSize;
        if (active) activeCount++;
        else inactiveCount++;

        // Add parsed storage object to our collection
        storageObjects.push({
          id: item?.data?.objectId,
          totalSize,
          usedSize,
          endEpoch,
          startEpoch,
          remaining,
          active,
        });
      }

      // Filter for viable storage using three criteria:
      // 1. Must be active (not expired)
      // 2. Must have sufficient remaining space (including buffer)
      // 3. Must have sufficient time remaining before expiration
      const viableStorage = storageObjects.filter(
        storage =>
          storage.active &&
          storage.remaining >= requiredSize + bufferSize &&
          storage.endEpoch - currentEpoch >= this.minEpochsRemaining
      );

      // Sort viable storage using a best-fit algorithm
      // This prioritizes storage objects that minimize wasted space
      viableStorage.sort((a, b) => {
        // Calculate how much space would remain after use
        const aFit = a.remaining - (requiredSize + bufferSize);
        const bFit = b.remaining - (requiredSize + bufferSize);

        // If both storage objects have sufficient space,
        // prefer the one with less wasted space (best fit)
        if (aFit >= 0 && bFit >= 0) {
          return aFit - bFit; // Smallest remaining goes first (best fit)
        }

        // If only one has sufficient space, prefer that one
        if (aFit >= 0) return -1;
        if (bFit >= 0) return 1;

        // If neither has sufficient space, prefer the one with more space
        return b.remaining - a.remaining;
      });

      // Select the best match (first item after sorting)
      const bestMatch = viableStorage.length > 0 ? viableStorage[0] : null;

      // Determine recommendation based on analysis
      let recommendation: 'use-existing' | 'allocate-new' | 'extend-existing';

      if (bestMatch) {
        // Found a viable storage to reuse - most efficient option
        recommendation = 'use-existing';
      } else {
        // No viable storage with sufficient space
        // Check if there's an active storage that could be extended
        const extendableStorage = storageObjects.filter(
          storage =>
            storage.active &&
            storage.remaining < requiredSize + bufferSize &&
            storage.remaining > 0
        );

        if (extendableStorage.length > 0) {
          // Found active storage with some space - could be extended
          recommendation = 'extend-existing';
        } else {
          // No suitable storage found - need to allocate new
          recommendation = 'allocate-new';
        }
      }

      // Return complete analysis with metrics and recommendation
      return {
        bestMatch,
        totalStorage,
        usedStorage,
        availableStorage: totalStorage - usedStorage,
        activeStorageCount: activeCount,
        inactiveStorageCount: inactiveCount,
        hasViableStorage: viableStorage.length > 0,
        recommendation,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(
        `Failed to analyze storage for reuse: ${error instanceof Error ? error.message : String(error as any)}`,
        {
          operation: 'storage analysis',
          recoverable: true,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }

  /**
   * Analyzes the efficiency and cost savings of reusing storage vs creating new storage.
   *
   * @param requiredSize - Size in bytes needed for storage
   * @returns Detailed analysis with cost comparisons and recommendations
   * @throws {ValidationError} if efficiency analysis fails
   */
  async analyzeStorageEfficiency(requiredSize: number): Promise<{
    /** Full storage analysis result */
    analysisResult: StorageAnalysis;
    /** Cost comparison metrics in WAL tokens */
    costComparison: {
      /** Cost in WAL tokens to allocate new storage */
      newStorageCost: bigint;
      /** Amount saved by reusing existing storage in WAL tokens */
      reuseExistingSavings: bigint;
      /** Percentage saved by reusing existing storage */
      reuseExistingPercentSaved: number;
    };
    /** Human-readable recommendation with financial justification */
    detailedRecommendation: string;
  }> {
    try {
      // Find the best storage to reuse based on our best-fit algorithm
      const analysisResult = await this.findBestStorageForReuse(requiredSize as any);

      // Get cost estimate for allocating new storage from Walrus
      // Default to 52 epochs (approximately 6 months)
      const costResult = await StorageOperationHandler.execute(
        async () =>
          this?.walrusClient?.storageCost(
            requiredSize,
            52 // Default to 52 epochs (approximately 6 months)
          ),
        { operation: 'calculate storage cost' }
      );

      if (!costResult.success) {
        throw new ValidationError('Failed to calculate storage cost', {
          operation: 'cost analysis',
          recoverable: true,
          cause: costResult.error,
        });
      }

      if (!costResult.data) {
        throw new ValidationError('No cost data returned', {
          operation: 'cost analysis',
          recoverable: true,
        });
      }

      const { storageCost, totalCost } = costResult.data;
      const newStorageCost = BigInt(totalCost as any);

      // Calculate potential savings if we reuse existing storage
      let reuseExistingSavings = BigInt(0 as any);
      let reuseExistingPercentSaved = 0;

      if (analysisResult.hasViableStorage) {
        // When reusing storage, we only pay the write cost, not the storage allocation cost
        // This is where the significant savings come from
        reuseExistingSavings = BigInt(storageCost as any);
        reuseExistingPercentSaved = Number(
          (BigInt(100 as any) * reuseExistingSavings) / newStorageCost
        );
      }

      // Generate a human-readable recommendation with financial justification
      let detailedRecommendation = '';

      switch (analysisResult.recommendation) {
        case 'use-existing':
          detailedRecommendation = `Reuse existing storage ${analysisResult.bestMatch?.id} to save ${reuseExistingSavings} WAL (${reuseExistingPercentSaved}%).`;
          break;
        case 'extend-existing':
          detailedRecommendation =
            'Extend an existing storage allocation to accommodate the required size.';
          break;
        case 'allocate-new':
          detailedRecommendation =
            'Allocate new storage as no suitable existing storage was found.';
          break;
      }

      // Return the complete analysis with cost comparisons
      return {
        analysisResult,
        costComparison: {
          newStorageCost,
          reuseExistingSavings,
          reuseExistingPercentSaved,
        },
        detailedRecommendation,
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      throw new ValidationError(
        `Failed to analyze storage efficiency: ${error instanceof Error ? error.message : String(error as any)}`,
        {
          operation: 'efficiency analysis',
          recoverable: true,
          cause: error instanceof Error ? error : undefined,
        }
      );
    }
  }
}
