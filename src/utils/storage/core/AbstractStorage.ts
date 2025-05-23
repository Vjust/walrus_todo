/**
import { Logger } from '../../Logger';

const logger = new Logger('AbstractStorage');
 * @fileoverview Abstract Storage Implementation - Base class for storage implementations
 *
 * This abstract class provides common functionality for all storage implementations,
 * including configuration management, connection state tracking, and default implementations
 * for some methods. Storage implementations can extend this class to avoid duplicating code.
 */

import { IStorage } from './IStorage';
import { 
  StorageInfo, 
  StorageUsage, 
  StorageOptimizationResult, 
  StorageConfig,
  StorageOperationOptions,
  VerificationResult,
} from './StorageTypes';
import { StorageError, NetworkError } from '../../../types/errors';
import { ValidationError } from '../../../types/errors/ValidationError';
import crypto from 'crypto';

/**
 * Abstract base class for storage implementations that provides common functionality.
 */
export abstract class AbstractStorage implements IStorage {
  /** Current connection state */
  protected connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed' = 'disconnected';
  
  /** Timestamp of last health check */
  protected lastHealthCheck: number = 0;
  
  /** Interval between health checks in milliseconds */
  protected healthCheckInterval: number = 30000; // 30 seconds
  
  /** AbortController for canceling operations */
  protected abortController: AbortController = new AbortController();
  
  /** In-memory cache for frequently accessed items */
  protected static readonly cache: Map<string, { data: Uint8Array; metadata: Record<string, string>; expires: number }> = new Map();
  
  /** Default cache TTL in milliseconds */
  protected static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Creates a new storage instance with the specified configuration.
   * 
   * @param config - Configuration for the storage
   */
  constructor(protected config: StorageConfig) {}
  
  /**
   * Gets the current storage configuration.
   * 
   * @returns The current storage configuration
   */
  public getConfig(): StorageConfig {
    return { ...this.config }; // Return a copy to prevent modification
  }
  
  /**
   * Updates the storage configuration.
   * 
   * @param config - Partial configuration to update
   */
  public setConfig(config: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Initializes the storage connection.
   * Must be implemented by subclasses.
   */
  public abstract connect(): Promise<void>;
  
  /**
   * Disconnects from the storage.
   * Base implementation resets connection state and cancels pending operations.
   */
  public async disconnect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      logger.info('Disconnecting storage...');
      
      // Cancel any pending operations
      this.abortController.abort('Disconnecting');
      this.abortController = new AbortController();
      
      // Reset connection state
      this.connectionState = 'disconnected';
    }
  }
  
  /**
   * Checks if the storage is connected with an optional health check.
   * 
   * @returns Promise resolving to boolean indicating connection status
   */
  public async isConnected(): Promise<boolean> {
    if (this.connectionState === 'connected' && 
        Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
      const isHealthy = await this.checkConnectionHealth();
      if (!isHealthy) {
        this.connectionState = 'failed';
        return false;
      }
    }
    return this.connectionState === 'connected';
  }
  
  /**
   * Checks the health of the connection.
   * Must be implemented by subclasses.
   * 
   * @returns Promise resolving to boolean indicating if connection is healthy
   */
  protected abstract checkConnectionHealth(): Promise<boolean>;
  
  /**
   * Stores content in the storage system.
   * Must be implemented by subclasses.
   */
  public abstract store(content: Uint8Array, metadata: Record<string, string>): Promise<string>;
  
  /**
   * Retrieves content from the storage system.
   * Must be implemented by subclasses.
   */
  public abstract retrieve(id: string): Promise<{ content: Uint8Array; metadata: Record<string, string> }>;
  
  /**
   * Updates existing content in the storage system.
   * Must be implemented by subclasses.
   */
  public abstract update(id: string, content: Uint8Array, metadata: Record<string, string>): Promise<string>;
  
  /**
   * Ensures sufficient storage space is allocated.
   * Must be implemented by subclasses.
   */
  public abstract ensureStorageAllocated(sizeBytes: number): Promise<StorageInfo>;
  
  /**
   * Gets current storage usage statistics.
   * Must be implemented by subclasses.
   */
  public abstract getStorageUsage(): Promise<StorageUsage>;
  
  /**
   * Optimizes storage usage.
   * Default implementation returns a no-op result.
   * Subclasses should override for actual optimization.
   */
  public async optimizeStorage(): Promise<StorageOptimizationResult> {
    return {
      success: false,
      recommendedStorage: null,
      recommendation: 'allocate-new',
      potentialSavings: BigInt(0),
      savingsPercentage: 0,
      recommendationDetails: 'Storage optimization not implemented for this storage type'
    };
  }
  
  /**
   * Verifies the integrity of stored content.
   * Default implementation retrieves content and verifies its checksum.
   * 
   * @param id - The unique identifier for the content
   * @param expectedChecksum - Optional expected checksum for verification
   * @returns Promise resolving to verification result
   */
  public async verify(id: string, expectedChecksum?: string): Promise<boolean> {
    try {
      // Retrieve the content
      const { content, metadata } = await this.retrieve(id);
      
      // Extract checksum from metadata or use provided one
      const storedChecksum = metadata.checksum || expectedChecksum;
      
      // If no checksum available, cannot verify
      if (!storedChecksum) {
        return false;
      }
      
      // Calculate checksum of retrieved content
      const checksumAlgo = metadata.checksumAlgorithm || 'sha256';
      const calculatedChecksum = this.calculateChecksum(content, checksumAlgo);
      
      // Compare checksums
      return calculatedChecksum === storedChecksum;
    } catch (error) {
      logger.warn('Content verification failed:', error);
      return false;
    }
  }
  
  /**
   * Calculates a checksum for the provided data using the specified algorithm.
   * 
   * @param data - The data to calculate a checksum for
   * @param algorithm - The hash algorithm to use (default: sha256)
   * @returns Hexadecimal representation of the hash
   */
  protected calculateChecksum(data: Uint8Array, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(Buffer.from(data)).digest('hex');
  }
  
  /**
   * Caches content for faster retrieval.
   * 
   * @param id - The unique identifier for the content
   * @param content - The content to cache
   * @param metadata - The metadata to cache
   * @param ttl - Optional time-to-live in milliseconds
   */
  protected cacheContent(
    id: string,
    content: Uint8Array,
    metadata: Record<string, string>,
    ttl: number = AbstractStorage.CACHE_TTL
  ): void {
    AbstractStorage.cache.set(id, {
      data: content,
      metadata,
      expires: Date.now() + ttl
    });
    
    // Clean expired entries
    this.cleanCache();
  }
  
  /**
   * Gets cached content if available and not expired.
   * 
   * @param id - The unique identifier for the content
   * @returns The cached content and metadata, or null if not in cache or expired
   */
  protected getCachedContent(id: string): { content: Uint8Array; metadata: Record<string, string> } | null {
    const cached = AbstractStorage.cache.get(id);
    if (cached && cached.expires > Date.now()) {
      return {
        content: cached.data,
        metadata: cached.metadata
      };
    }
    return null;
  }
  
  /**
   * Removes expired entries from the cache.
   */
  protected cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of AbstractStorage.cache.entries()) {
      if (value.expires <= now) {
        AbstractStorage.cache.delete(key);
      }
    }
  }
  
  /**
   * Creates a fresh AbortController for new operations.
   * 
   * @returns A new AbortController
   */
  protected createFreshAbortController(): AbortController {
    this.abortController = new AbortController();
    return this.abortController;
  }
  
  /**
   * Validates that the storage is connected.
   * 
   * @param operation - The operation being performed
   * @throws {ValidationError} if not connected
   */
  protected validateConnection(operation: string): void {
    if (this.connectionState !== 'connected') {
      throw new ValidationError(`Storage not connected. Call connect() first.`, {
        operation,
        recoverable: true
      });
    }
  }
}