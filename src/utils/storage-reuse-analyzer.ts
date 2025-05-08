import { SuiClient } from '@mysten/sui.js/client';
import { WalrusClient } from '@mysten/walrus';
import { CLIError } from '../types/error';
import { TodoSizeCalculator } from './todo-size-calculator';

/**
 * Interface representing storage information
 */
interface StorageObject {
  id: string;
  totalSize: number;
  usedSize: number;
  endEpoch: number;
  startEpoch: number;
  remaining: number;
  active: boolean;
}

/**
 * Storage analysis result
 */
interface StorageAnalysis {
  bestMatch: StorageObject | null;
  totalStorage: number;
  usedStorage: number;
  availableStorage: number;
  activeStorageCount: number;
  inactiveStorageCount: number;
  hasViableStorage: boolean;
  recommendation: 'use-existing' | 'allocate-new' | 'extend-existing';
}

/**
 * Utility class for analyzing and reusing existing Walrus storage
 */
export class StorageReuseAnalyzer {
  private minRemainingBuffer = 1024 * 1024; // 1MB minimum remaining buffer
  private minEpochsRemaining = 10; // Minimum epochs remaining
  
  constructor(
    private suiClient: SuiClient,
    private walrusClient: WalrusClient,
    private userAddress: string
  ) {}
  
  /**
   * Finds the best storage object for reuse based on required size
   * 
   * @param requiredSize The size in bytes needed for storage
   * @param bufferSize Optional additional buffer to ensure (defaults to 10KB)
   * @returns Analysis result with recommendation
   */
  async findBestStorageForReuse(
    requiredSize: number, 
    bufferSize: number = 10240
  ): Promise<StorageAnalysis> {
    try {
      // Get the current epoch
      const { epoch } = await this.suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(epoch);
      
      // Get all storage objects owned by this address
      const response = await this.suiClient.getOwnedObjects({
        owner: this.userAddress,
        filter: { StructType: '0x2::storage::Storage' },
        options: { showContent: true }
      });
      
      // Parse and collect all storage objects
      const storageObjects: StorageObject[] = [];
      let totalStorage = 0;
      let usedStorage = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      
      // Process each storage object
      for (const item of response.data) {
        // Skip if no content or not a move object
        if (!item.data?.content || item.data.content.dataType !== 'moveObject') {
          continue;
        }
        
        // Parse storage fields
        const content = item.data.content as any;
        if (!content.fields) continue;
        
        const fields = content.fields;
        const totalSize = Number(fields.storage_size);
        const usedSize = Number(fields.used_size || 0);
        const endEpoch = Number(fields.end_epoch);
        const startEpoch = Number(fields.start_epoch || 0);
        const remaining = totalSize - usedSize;
        const active = endEpoch > currentEpoch;
        
        // Add to total counts
        totalStorage += totalSize;
        usedStorage += usedSize;
        if (active) activeCount++;
        else inactiveCount++;
        
        // Add to storage objects array
        storageObjects.push({
          id: item.data.objectId,
          totalSize,
          usedSize,
          endEpoch,
          startEpoch,
          remaining,
          active
        });
      }
      
      // Filter for viable storage (active, sufficient remaining space, sufficient epochs)
      const viableStorage = storageObjects.filter(storage => 
        storage.active && 
        storage.remaining >= (requiredSize + bufferSize) &&
        (storage.endEpoch - currentEpoch) >= this.minEpochsRemaining
      );
      
      // Sort viable storage by best fit (minimize wasted space)
      viableStorage.sort((a, b) => {
        // First sort by sufficient size
        const aFit = a.remaining - (requiredSize + bufferSize);
        const bFit = b.remaining - (requiredSize + bufferSize);
        
        // If both are sufficient, prefer the one with less wasted space
        if (aFit >= 0 && bFit >= 0) {
          return aFit - bFit; // Smallest remaining goes first (best fit)
        }
        
        // If only one is sufficient, prefer that one
        if (aFit >= 0) return -1;
        if (bFit >= 0) return 1;
        
        // Otherwise sort by remaining space
        return b.remaining - a.remaining;
      });
      
      // Find best match
      const bestMatch = viableStorage.length > 0 ? viableStorage[0] : null;
      
      // Create recommendation
      let recommendation: 'use-existing' | 'allocate-new' | 'extend-existing';
      
      if (bestMatch) {
        // We have a viable storage to reuse
        recommendation = 'use-existing';
      } else {
        // No viable storage
        // Check if there's an active storage that could be extended
        const extendableStorage = storageObjects.filter(storage => 
          storage.active && 
          storage.remaining < (requiredSize + bufferSize) && 
          storage.remaining > 0
        );
        
        if (extendableStorage.length > 0) {
          recommendation = 'extend-existing';
        } else {
          recommendation = 'allocate-new';
        }
      }
      
      return {
        bestMatch,
        totalStorage,
        usedStorage,
        availableStorage: totalStorage - usedStorage,
        activeStorageCount: activeCount,
        inactiveStorageCount: inactiveCount,
        hasViableStorage: viableStorage.length > 0,
        recommendation
      };
    } catch (error) {
      throw new CLIError(
        `Failed to analyze storage for reuse: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_STORAGE_ANALYSIS_FAILED'
      );
    }
  }
  
  /**
   * Analyzes the efficiency of reusing storage vs creating new storage
   * 
   * @param requiredSize Size in bytes needed
   * @returns Analysis with cost comparisons and recommendations
   */
  async analyzeStorageEfficiency(
    requiredSize: number
  ): Promise<{
    analysisResult: StorageAnalysis;
    costComparison: {
      newStorageCost: bigint;
      reuseExistingSavings: bigint;
      reuseExistingPercentSaved: number;
    };
    detailedRecommendation: string;
  }> {
    try {
      // Find the best storage to reuse
      const analysisResult = await this.findBestStorageForReuse(requiredSize);
      
      // Get cost estimate for new storage
      const { storageCost, writeCost, totalCost } = await this.walrusClient.storageCost(
        requiredSize,
        52 // Default to 52 epochs (approximately 6 months)
      );
      const newStorageCost = BigInt(totalCost);
      
      // Calculate savings if we reuse existing storage
      let reuseExistingSavings = BigInt(0);
      let reuseExistingPercentSaved = 0;
      
      if (analysisResult.hasViableStorage) {
        // Only pay for write cost when reusing
        reuseExistingSavings = BigInt(storageCost);
        reuseExistingPercentSaved = Number((BigInt(100) * reuseExistingSavings) / newStorageCost);
      }
      
      // Create detailed recommendation
      let detailedRecommendation = '';
      
      switch (analysisResult.recommendation) {
        case 'use-existing':
          detailedRecommendation = `Reuse existing storage ${analysisResult.bestMatch?.id} to save ${reuseExistingSavings} WAL (${reuseExistingPercentSaved}%).`;
          break;
        case 'extend-existing':
          detailedRecommendation = 'Extend an existing storage allocation to accommodate the required size.';
          break;
        case 'allocate-new':
          detailedRecommendation = 'Allocate new storage as no suitable existing storage was found.';
          break;
      }
      
      return {
        analysisResult,
        costComparison: {
          newStorageCost,
          reuseExistingSavings,
          reuseExistingPercentSaved
        },
        detailedRecommendation
      };
    } catch (error) {
      throw new CLIError(
        `Failed to analyze storage efficiency: ${error instanceof Error ? error.message : String(error)}`,
        'WALRUS_EFFICIENCY_ANALYSIS_FAILED'
      );
    }
  }
}