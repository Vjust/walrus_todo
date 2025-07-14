/**
 * Blob manager for tracking and managing published blobs on Walrus
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WalrusClient } from './walrus';
import { PublishedBlob, BlobStatus, BlobStats, BlobSearchCriteria, BlobSearchResult, PublishConfig, BlobValidator, BlobUtils } from '../models/blob';
import { Todo } from '../models/todo';
import { getDataPath } from '../config';
import { WalrusError, StorageError } from '../utils/errors';
import { logger } from '../utils/logger';
import { compress, decompress } from '../utils/compression';

/**
 * Manager for tracking published blobs and their metadata
 */
export class BlobManager {
  private blobsFilePath: string;
  private walrusClient: WalrusClient;
  private publishConfig: PublishConfig;

  constructor(walrusClient: WalrusClient, dataPath?: string, publishConfig?: PublishConfig) {
    const dataDir = dataPath || getDataPath();
    this.blobsFilePath = path.join(dataDir, 'blobs.json');
    this.walrusClient = walrusClient;
    
    // Use provided publish configuration or defaults
    this.publishConfig = publishConfig || {
      defaultEpochs: 5,
      defaultDeletable: true,
      maxBlobSize: 10 * 1024 * 1024, // 10 MB
      enableCompression: true,
      enableEncryption: false,
      defaultTags: ['waltodo'],
    };
  }

  /**
   * Ensure the data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    const dataDir = path.dirname(this.blobsFilePath);
    await fs.mkdir(dataDir, { recursive: true });
  }

  /**
   * Load blob metadata from local storage
   */
  async loadBlobs(): Promise<PublishedBlob[]> {
    try {
      await this.ensureDataDir();
      
      const data = await fs.readFile(this.blobsFilePath, 'utf-8');
      const rawBlobs = JSON.parse(data);
      
      if (!Array.isArray(rawBlobs)) {
        logger.warn('Invalid blob data format, resetting to empty array');
        return [];
      }
      
      // Validate and sanitize each blob
      const blobs: PublishedBlob[] = [];
      for (const rawBlob of rawBlobs) {
        try {
          if (BlobValidator.validatePublishedBlob(rawBlob)) {
            blobs.push(BlobValidator.sanitizeBlob(rawBlob));
          } else {
            logger.warn('Invalid blob entry found, skipping:', rawBlob);
          }
        } catch (error) {
          logger.warn('Error validating blob entry:', error);
        }
      }
      
      logger.debug(`Loaded ${blobs.length} blobs from storage`);
      return blobs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Blob storage file not found, returning empty array');
        return [];
      }
      
      logger.error('Failed to load blobs:', error);
      throw new StorageError(`Failed to load blob metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save blob metadata to local storage
   */
  async saveBlobs(blobs: PublishedBlob[]): Promise<void> {
    try {
      await this.ensureDataDir();
      
      // Validate all blobs before saving
      const validBlobs = blobs.filter(blob => {
        const isValid = BlobValidator.validatePublishedBlob(blob);
        if (!isValid) {
          logger.warn('Invalid blob found during save, excluding:', blob);
        }
        return isValid;
      });
      
      await fs.writeFile(
        this.blobsFilePath,
        JSON.stringify(validBlobs, null, 2),
        'utf-8'
      );
      
      logger.debug(`Saved ${validBlobs.length} blobs to storage`);
    } catch (error) {
      logger.error('Failed to save blobs:', error);
      throw new StorageError(`Failed to save blob metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Track a newly published blob
   */
  async trackBlob(
    blobId: string,
    todos: Todo[],
    epochs: number,
    cost: number,
    size: number,
    deletable: boolean = true,
    description?: string,
    tags: string[] = []
  ): Promise<PublishedBlob> {
    try {
      const blobs = await this.loadBlobs();
      
      // Check if blob already exists
      const existingIndex = blobs.findIndex(b => b.id === blobId);
      if (existingIndex !== -1) {
        logger.warn('Blob already tracked, updating:', blobId);
      }
      
      // Calculate data hash for integrity
      const todoData = JSON.stringify(todos);
      const dataHash = crypto.createHash('sha256').update(todoData).digest('hex');
      
      const newBlob: PublishedBlob = {
        id: blobId,
        publishedAt: new Date(),
        epochs,
        cost,
        todoCount: todos.length,
        size,
        status: BlobStatus.ACTIVE,
        lastStatusCheck: new Date(),
        deletable,
        description,
        tags: [...this.publishConfig.defaultTags, ...tags],
        dataHash,
      };
      
      if (existingIndex !== -1) {
        blobs[existingIndex] = newBlob;
      } else {
        blobs.push(newBlob);
      }
      
      await this.saveBlobs(blobs);
      
      logger.info('Blob tracked successfully:', { blobId, todoCount: todos.length });
      return newBlob;
    } catch (error) {
      logger.error('Failed to track blob:', error);
      throw new StorageError(`Failed to track blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all tracked blobs
   */
  async getBlobs(): Promise<PublishedBlob[]> {
    return this.loadBlobs();
  }

  /**
   * Get a specific blob by ID
   */
  async getBlob(blobId: string): Promise<PublishedBlob | null> {
    const blobs = await this.loadBlobs();
    return blobs.find(blob => blob.id === blobId) || null;
  }

  /**
   * Search blobs based on criteria
   */
  async searchBlobs(criteria: BlobSearchCriteria, limit?: number): Promise<BlobSearchResult> {
    const allBlobs = await this.loadBlobs();
    const filteredBlobs = BlobUtils.filterBlobs(allBlobs, criteria);
    
    // Apply limit if specified
    const resultBlobs = limit ? filteredBlobs.slice(0, limit) : filteredBlobs;
    
    return {
      blobs: resultBlobs,
      totalMatches: filteredBlobs.length,
      criteria,
      searchedAt: new Date(),
    };
  }

  /**
   * Update blob status
   */
  async updateBlobStatus(blobId: string, status: BlobStatus): Promise<void> {
    const blobs = await this.loadBlobs();
    const blobIndex = blobs.findIndex(b => b.id === blobId);
    
    if (blobIndex === -1) {
      throw new StorageError(`Blob not found: ${blobId}`);
    }
    
    blobs[blobIndex].status = status;
    blobs[blobIndex].lastStatusCheck = new Date();
    
    await this.saveBlobs(blobs);
    logger.debug('Blob status updated:', { blobId, status });
  }

  /**
   * Check blob status on Walrus network
   */
  async checkBlobStatus(blobId: string): Promise<BlobStatus> {
    try {
      logger.debug('Checking blob status on Walrus network:', blobId);
      
      const exists = await this.walrusClient.exists(blobId);
      
      let status: BlobStatus;
      if (exists) {
        // Check if expired based on tracked metadata
        const blob = await this.getBlob(blobId);
        if (blob && BlobUtils.isExpired(blob)) {
          status = BlobStatus.EXPIRED;
        } else {
          status = BlobStatus.ACTIVE;
        }
      } else {
        status = BlobStatus.DELETED;
      }
      
      // Update local status
      await this.updateBlobStatus(blobId, status);
      
      return status;
    } catch (error) {
      logger.error('Failed to check blob status:', error);
      await this.updateBlobStatus(blobId, BlobStatus.ERROR);
      return BlobStatus.ERROR;
    }
  }

  /**
   * Download and parse TODOs from a blob
   */
  async downloadTodos(blobId: string): Promise<Todo[]> {
    try {
      logger.debug('Downloading TODOs from blob:', blobId);
      
      // Retrieve data from Walrus
      const rawData = await this.walrusClient.retrieve(blobId);
      
      // Decompress if needed
      let todoData: string;
      if (this.publishConfig.enableCompression) {
        try {
          todoData = await decompress(rawData);
        } catch (decompressError) {
          logger.debug('Decompression failed, trying raw data');
          todoData = rawData;
        }
      } else {
        todoData = rawData;
      }
      
      // Parse the JSON data
      const parsedData = JSON.parse(todoData);
      
      let todos: Todo[];
      
      // Handle different data formats
      if (Array.isArray(parsedData)) {
        // Direct array of TODOs
        todos = parsedData;
      } else if (parsedData.todos && Array.isArray(parsedData.todos)) {
        // Export format with metadata wrapper
        todos = parsedData.todos;
        logger.debug('Parsed TODO export data:', {
          totalTodos: parsedData.metadata?.totalTodos || todos.length,
          exportedAt: parsedData.metadata?.exportedAt
        });
      } else if (parsedData.data && Array.isArray(parsedData.data)) {
        // Walrus JSON format with metadata wrapper
        todos = parsedData.data;
      } else {
        throw new WalrusError('Invalid TODO data format in blob - expected array of TODOs or wrapped format');
      }
      
      // Verify data integrity if hash is available
      const blob = await this.getBlob(blobId);
      if (blob?.dataHash) {
        const downloadedHash = crypto.createHash('sha256').update(JSON.stringify(todos)).digest('hex');
        if (downloadedHash !== blob.dataHash) {
          logger.warn('Data integrity check failed for blob:', blobId);
        }
      }
      
      logger.info('TODOs downloaded successfully:', { blobId, todoCount: todos.length });
      return todos;
    } catch (error) {
      logger.error('Failed to download TODOs:', error);
      if (error instanceof WalrusError) {
        throw error;
      }
      throw new WalrusError(`Failed to download TODOs from blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete blob from tracking (and optionally from Walrus)
   */
  async deleteBlob(blobId: string, deleteFromWalrus: boolean = false): Promise<void> {
    try {
      const blobs = await this.loadBlobs();
      const blobIndex = blobs.findIndex(b => b.id === blobId);
      
      if (blobIndex === -1) {
        throw new StorageError(`Blob not found: ${blobId}`);
      }
      
      const blob = blobs[blobIndex];
      
      if (deleteFromWalrus && blob.deletable) {
        try {
          await this.walrusClient.delete(blobId);
          logger.debug('Blob deleted from Walrus network:', blobId);
        } catch (error) {
          logger.warn('Failed to delete blob from Walrus (continuing with local deletion):', error);
        }
      }
      
      // Remove from local tracking
      blobs.splice(blobIndex, 1);
      await this.saveBlobs(blobs);
      
      logger.info('Blob removed from tracking:', blobId);
    } catch (error) {
      logger.error('Failed to delete blob:', error);
      throw new StorageError(`Failed to delete blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get statistics about tracked blobs
   */
  async getStats(): Promise<BlobStats> {
    const blobs = await this.loadBlobs();
    
    const stats: BlobStats = {
      totalBlobs: blobs.length,
      activeBlobs: 0,
      expiredBlobs: 0,
      deletedBlobs: 0,
      totalCost: 0,
      totalTodos: 0,
      totalSize: 0,
      lastPublished: undefined,
    };
    
    let latestDate: Date | undefined;
    
    for (const blob of blobs) {
      // Update counters
      switch (blob.status) {
        case BlobStatus.ACTIVE:
          stats.activeBlobs++;
          break;
        case BlobStatus.EXPIRED:
          stats.expiredBlobs++;
          break;
        case BlobStatus.DELETED:
          stats.deletedBlobs++;
          break;
      }
      
      stats.totalCost += blob.cost;
      stats.totalTodos += blob.todoCount;
      stats.totalSize += blob.size;
      
      // Track latest publish date
      if (!latestDate || blob.publishedAt > latestDate) {
        latestDate = blob.publishedAt;
      }
    }
    
    stats.lastPublished = latestDate;
    
    return stats;
  }

  /**
   * Refresh status of all tracked blobs
   */
  async refreshAllStatuses(): Promise<void> {
    const blobs = await this.loadBlobs();
    const promises = blobs.map(blob => this.checkBlobStatus(blob.id));
    
    try {
      await Promise.allSettled(promises);
      logger.info('Refreshed status for all tracked blobs');
    } catch (error) {
      logger.error('Some blob status checks failed:', error);
    }
  }

  /**
   * Clean up expired or deleted blobs from tracking
   */
  async cleanup(removeExpired: boolean = true, removeDeleted: boolean = true): Promise<number> {
    const blobs = await this.loadBlobs();
    const initialCount = blobs.length;
    
    const filteredBlobs = blobs.filter(blob => {
      if (removeExpired && blob.status === BlobStatus.EXPIRED) {
        return false;
      }
      if (removeDeleted && blob.status === BlobStatus.DELETED) {
        return false;
      }
      return true;
    });
    
    await this.saveBlobs(filteredBlobs);
    
    const removedCount = initialCount - filteredBlobs.length;
    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} blob(s) from tracking`);
    }
    
    return removedCount;
  }

  /**
   * Get publish configuration
   */
  getPublishConfig(): PublishConfig {
    return { ...this.publishConfig };
  }

  /**
   * Update publish configuration
   */
  updatePublishConfig(config: Partial<PublishConfig>): void {
    this.publishConfig = { ...this.publishConfig, ...config };
    logger.debug('Publish configuration updated');
  }

  /**
   * Export blob metadata to JSON
   */
  async exportMetadata(filePath: string): Promise<void> {
    const blobs = await this.loadBlobs();
    const stats = await this.getStats();
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      stats,
      blobs,
    };
    
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
    logger.info('Blob metadata exported to:', filePath);
  }

  /**
   * Import blob metadata from JSON
   */
  async importMetadata(filePath: string, merge: boolean = true): Promise<number> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const importData = JSON.parse(data);
      
      if (!importData.blobs || !Array.isArray(importData.blobs)) {
        throw new StorageError('Invalid metadata format');
      }
      
      const importedBlobs: PublishedBlob[] = [];
      for (const rawBlob of importData.blobs) {
        if (BlobValidator.validatePublishedBlob(rawBlob)) {
          importedBlobs.push(BlobValidator.sanitizeBlob(rawBlob));
        }
      }
      
      let finalBlobs: PublishedBlob[];
      if (merge) {
        const existingBlobs = await this.loadBlobs();
        const existingIds = new Set(existingBlobs.map(b => b.id));
        
        // Add only new blobs
        const newBlobs = importedBlobs.filter(b => !existingIds.has(b.id));
        finalBlobs = [...existingBlobs, ...newBlobs];
      } else {
        finalBlobs = importedBlobs;
      }
      
      await this.saveBlobs(finalBlobs);
      
      logger.info(`Imported ${importedBlobs.length} blob(s) from metadata file`);
      return importedBlobs.length;
    } catch (error) {
      logger.error('Failed to import metadata:', error);
      throw new StorageError(`Failed to import metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}