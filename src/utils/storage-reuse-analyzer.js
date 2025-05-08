const { CLIError } = require('../types/error');

/**
 * Utility class for analyzing and reusing existing Walrus storage
 */
class StorageReuseAnalyzer {
  constructor(suiClient, walrusClient, userAddress) {
    this.suiClient = suiClient;
    this.walrusClient = walrusClient;
    this.userAddress = userAddress;
    this.minRemainingBuffer = 1024 * 1024; // 1MB minimum remaining buffer
    this.minEpochsRemaining = 10; // Minimum epochs remaining
  }
  
  /**
   * Finds the best storage object for reuse based on required size
   */
  async findBestStorageForReuse(requiredSize, bufferSize = 10240) {
    try {
      // Get the current epoch
      const epochResult = await this.suiClient.getLatestSuiSystemState();
      const currentEpoch = Number(epochResult.epoch);
      
      // Get all storage objects owned by this address
      const response = await this.suiClient.getOwnedObjects({
        owner: this.userAddress,
        filter: { StructType: '0x2::storage::Storage' },
        options: { showContent: true }
      });
      
      // Parse storage objects
      const storageObjects = [];
      let totalStorage = 0;
      let usedStorage = 0;
      let activeCount = 0;
      let inactiveCount = 0;
      
      for (const item of response.data) {
        if (!item.data?.content || item.data.content.dataType !== 'moveObject') {
          continue;
        }
        
        const content = item.data.content;
        if (!content.fields) continue;
        
        const fields = content.fields;
        const totalSize = Number(fields.storage_size);
        const usedSize = Number(fields.used_size || 0);
        const endEpoch = Number(fields.end_epoch);
        const startEpoch = Number(fields.start_epoch || 0);
        const remaining = totalSize - usedSize;
        const active = endEpoch > currentEpoch;
        
        totalStorage += totalSize;
        usedStorage += usedSize;
        if (active) activeCount++;
        else inactiveCount++;
        
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
      
      // Filter for viable storage
      const viableStorage = storageObjects.filter(storage => 
        storage.active && 
        storage.remaining >= (requiredSize + bufferSize) &&
        (storage.endEpoch - currentEpoch) >= this.minEpochsRemaining
      );
      
      // Sort by best fit
      viableStorage.sort((a, b) => {
        const aFit = a.remaining - (requiredSize + bufferSize);
        const bFit = b.remaining - (requiredSize + bufferSize);
        
        if (aFit >= 0 && bFit >= 0) {
          return aFit - bFit; // Best fit first
        }
        
        if (aFit >= 0) return -1;
        if (bFit >= 0) return 1;
        
        return b.remaining - a.remaining;
      });
      
      const bestMatch = viableStorage.length > 0 ? viableStorage[0] : null;
      
      // Create recommendation
      let recommendation;
      
      if (bestMatch) {
        recommendation = 'use-existing';
      } else {
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
   */
  async analyzeStorageEfficiency(requiredSize) {
    try {
      // Find the best storage to reuse
      const analysisResult = await this.findBestStorageForReuse(requiredSize);
      
      // Get cost estimate for new storage
      const costEstimate = await this.walrusClient.storageCost(
        requiredSize,
        52 // Default to 52 epochs (approximately 6 months)
      );
      
      const newStorageCost = BigInt(costEstimate.totalCost);
      
      // Calculate savings if we reuse existing storage
      let reuseExistingSavings = BigInt(0);
      let reuseExistingPercentSaved = 0;
      
      if (analysisResult.hasViableStorage) {
        // Only pay for write cost when reusing
        reuseExistingSavings = BigInt(costEstimate.storageCost);
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

module.exports = { StorageReuseAnalyzer };