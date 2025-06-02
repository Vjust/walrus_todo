/**
 * Direct Walrus HTTP client for browser-based storage
 * Implements blob upload/download without backend dependency
 * Uses IndexedDB for persistent caching and offline support
 */

import { loadAppConfig } from '@/lib/config-loader';
import { cacheManager } from './cache-manager';
import { analytics } from './analytics';

export interface WalrusUploadResponse {
  blobId: string;
  size: number;
  encodedSize: number;
  cost: number;
}

export interface WalrusBlob {
  id: string;
  data: Uint8Array;
  contentType?: string;
}

export class WalrusClient {
  private publisherUrl: string;
  private aggregatorUrl: string;
  private configPromise: Promise<void>;

  constructor() {
    // Set fallback URLs initially
    this.publisherUrl = 'https://publisher-testnet.walrus.space';
    this.aggregatorUrl = 'https://aggregator-testnet.walrus.space';
    
    // Load configuration asynchronously
    this.configPromise = this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const config = await loadAppConfig();
      this.publisherUrl = config.walrus.publisherUrl;
      this.aggregatorUrl = config.walrus.aggregatorUrl;
    } catch (error) {
      console.warn('Failed to load Walrus config, using fallback URLs:', error);
    }
  }

  private async ensureConfigLoaded(): Promise<void> {
    await this.configPromise;
  }

  /**
   * Upload data to Walrus storage
   */
  async upload(
    data: Uint8Array | string,
    options?: {
      epochs?: number;
      contentType?: string;
      onProgress?: (progress: number) => void;
    }
  ): Promise<WalrusUploadResponse> {
    await this.ensureConfigLoaded();
    const uploadStartTime = performance.now();
    try {
      // Convert string to Uint8Array if needed
      const blobData =
        typeof data === 'string' ? new TextEncoder().encode(data) : data;

      // Prepare the request
      const formData = new FormData();
      const blob = new Blob([blobData], {
        type: options?.contentType || 'application/octet-stream',
      });
      formData.append('file', blob);

      // Add epochs parameter if specified
      const url = new URL(`${this.publisherUrl}/v1/store`);
      if (options?.epochs) {
        url.searchParams.append('epochs', options.epochs.toString());
      }

      // Report progress
      options?.onProgress?.(30);

      // Make the upload request
      const response = await fetch(url.toString(), {
        method: 'PUT',
        body: blobData,
        headers: {
          'Content-Type': options?.contentType || 'application/octet-stream',
        },
      });

      options?.onProgress?.(70);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${error}`);
      }

      const result = await response.json();

      // Extract blob ID from response
      // Walrus returns either newlyCreated or alreadyCertified
      const blobInfo = result.newlyCreated || result.alreadyCertified;
      if (!blobInfo?.blobId) {
        throw new Error('Invalid response from Walrus');
      }

      options?.onProgress?.(100);

      const uploadDuration = performance.now() - uploadStartTime;
      const uploadSize = blobInfo.size || blobData.length;
      
      // Track successful upload
      analytics?.trackStorage({
        action: 'upload',
        size: uploadSize,
        duration: uploadDuration,
        success: true,
      });

      return {
        blobId: blobInfo.blobId,
        size: uploadSize,
        encodedSize: blobInfo.encodedSize || blobData.length,
        cost: blobInfo.cost || 0,
      };
    } catch (error) {
      console.error('Walrus upload error:', error);
      
      // Track failed upload
      analytics?.trackStorage({
        action: 'upload',
        size: typeof data === 'string' ? new TextEncoder().encode(data).length : data.length,
        duration: performance.now() - uploadStartTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }

  /**
   * Download data from Walrus storage with persistent caching
   */
  async download(blobId: string, useCache: boolean = true): Promise<WalrusBlob> {
    await this.ensureConfigLoaded();
    const uploadStartTime = performance.now();
    const downloadStartTime = performance.now();
    
    // Check cache first if enabled
    if (useCache) {
      try {
        const cached = await cacheManager.get(blobId);
        if (cached) {
          // Convert base64 back to Uint8Array
          const binaryString = atob(cached.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          return {
            id: blobId,
            data: bytes,
            contentType: cached.contentType,
          };
        }
      } catch (cacheError) {
        console.warn('Cache read failed, fetching from network:', cacheError);
      }
    }
    
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || undefined;
      const result = {
        id: blobId,
        data: new Uint8Array(data),
        contentType,
      };

      // Cache the result if enabled
      if (useCache) {
        try {
          // Convert Uint8Array to base64 for storage
          const base64 = btoa(String.fromCharCode(...Array.from(result.data)));
          await cacheManager.set(blobId, base64, {
            contentType,
            contentLength: result.data.length,
          });
        } catch (cacheError) {
          console.warn('Failed to cache blob:', cacheError);
        }
      }

      // Track successful download
      analytics?.trackStorage({
        action: 'download',
        size: result.data.length,
        duration: performance.now() - downloadStartTime,
        success: true,
      });
      
      return result;
    } catch (error) {
      console.error('Walrus download error:', error);
      
      // Track failed download
      analytics?.trackStorage({
        action: 'download',
        duration: performance.now() - downloadStartTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      
      throw error;
    }
  }

  /**
   * Upload JSON data
   */
  async uploadJson(
    data: unknown,
    options?: { epochs?: number; onProgress?: (progress: number) => void }
  ): Promise<WalrusUploadResponse> {
    const jsonString = JSON.stringify(data);
    return this.upload(jsonString, {
      ...options,
      contentType: 'application/json',
    });
  }

  /**
   * Download and parse JSON data
   */
  async downloadJson<T = unknown>(blobId: string): Promise<T> {
    const blob = await this.download(blobId);
    const text = new TextDecoder().decode(blob.data);
    return JSON.parse(text);
  }

  /**
   * Upload an image file
   */
  async uploadImage(
    file: File,
    options?: { epochs?: number; onProgress?: (progress: number) => void }
  ): Promise<WalrusUploadResponse> {
    const data = await file.arrayBuffer();
    return this.upload(new Uint8Array(data), {
      ...options,
      contentType: file.type,
    });
  }

  /**
   * Get a public URL for a blob
   */
  getBlobUrl(blobId: string): string {
    return `${this.aggregatorUrl}/v1/${blobId}`;
  }

  /**
   * Check if a blob exists
   */
  async exists(blobId: string): Promise<boolean> {
    await this.ensureConfigLoaded();
    const uploadStartTime = performance.now();
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`, {
        method: 'HEAD',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Delete blob by ID
   */
  async deleteBlob(blobId: string, signer: unknown): Promise<string> {
    // Note: Walrus doesn't support deletion in the current version
    // This is a placeholder for future implementation
    console.warn('Blob deletion is not supported in current Walrus version');
    return blobId;
  }

  /**
   * Check if blob exists (alias)
   */
  async blobExists(blobId: string): Promise<boolean> {
    return this.exists(blobId);
  }

  /**
   * Get blob info
   */
  async getBlobInfo(blobId: string): Promise<{ size?: number }> {
    const blob = await this.download(blobId);
    return { size: blob.data.length };
  }

  /**
   * Calculate storage cost based on size and epochs
   */
  async calculateStorageCost(
    size: number,
    epochs: number
  ): Promise<{ totalCost: bigint; storageCost: bigint; writeCost: bigint }> {
    const writeCost = BigInt(size);
    const storageCost = BigInt(size) * BigInt(epochs);
    return { totalCost: writeCost + storageCost, storageCost, writeCost };
  }

  /**
   * Get WAL balance
   */
  async getWalBalance(): Promise<string> {
    // In a real implementation, this would query the blockchain for WAL token balance
    // For now, return a placeholder
    return '1000.0';
  }

  /**
   * Get storage usage
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    // In a real implementation, this would track storage usage
    // For now, return placeholder values
    return { used: '256', total: '10240' }; // MB
  }

  /**
   * Clear cache for specific blob or all blobs
   */
  async clearCache(blobId?: string): Promise<void> {
    if (blobId) {
      await cacheManager.delete(blobId);
    } else {
      await cacheManager.clear();
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalSize: number;
    entryCount: number;
    oldestEntry?: number;
  }> {
    return cacheManager.getStats();
  }

  /**
   * Preload blobs into cache for offline access
   */
  async preloadBlobs(blobIds: string[]): Promise<void> {
    const promises = blobIds.map(async (blobId) => {
      try {
        await this.download(blobId, true);
      } catch (error) {
        console.error(`Failed to preload blob ${blobId}:`, error);
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * Run cache cleanup to remove expired entries
   */
  async cleanupCache(): Promise<{
    removedEntries: number;
    freedSpace: number;
  }> {
    return cacheManager.cleanup();
  }

  /**
   * Check if a blob is cached
   */
  async isCached(blobId: string): Promise<boolean> {
    const cached = await cacheManager.get(blobId);
    return cached !== null;
  }
}

// Singleton instance
export const walrusClient = new WalrusClient();

// Export helper function for getting image URLs
export const getImageUrl = (blobId: string): string => {
  return walrusClient.getBlobUrl(blobId);
};

// Exporting a custom error for Walrus client operations
export class WalrusClientError extends Error {
  public code?: string;
  public cause?: Error;
  constructor(message: string, code?: string, cause?: Error) {
    super(message);
    this.name = 'WalrusClientError';
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

// Alias for the HTTP client
export type FrontendWalrusClient = WalrusClient;

// Supported network types for Walrus storage
export type WalrusNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

// Result type for WalrusTodoStorage operations
export interface WalrusUploadResult {
  blobId: string;
  metadata: {
    size: number;
    [key: string]: unknown;
  };
}

// Content encoder stub for extra attributes
export class ContentEncoder {
  static encode(data: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(data));
  }
}

// Error classes for retry and validation
export class WalrusRetryError extends WalrusClientError {
  constructor(message: string) {
    super(message, 'RETRY_ERROR');
    this.name = 'WalrusRetryError';
  }
}

export class WalrusValidationError extends WalrusClientError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'WalrusValidationError';
  }
}

// Abstraction for Todo storage operations
export class WalrusTodoStorage {
  private client: FrontendWalrusClient;
  constructor(network: WalrusNetwork) {
    this.client = walrusClient;
  }
  getClient(): FrontendWalrusClient {
    return this.client;
  }
  async storeTodo(
    data: unknown,
    signer: unknown,
    options: {
      epochs?: number;
      deletable?: boolean;
      attributes?: unknown;
      onProgress?: (p: number) => void;
    }
  ): Promise<WalrusUploadResult> {
    const result = await this.client.uploadJson(data, {
      epochs: options.epochs,
    });
    return {
      blobId: result.blobId,
      metadata: { size: result.encodedSize || result.size },
    };
  }
  /**
   * Retrieve JSON todo data from Walrus storage
   */
  async retrieveTodo(walrusBlobId: string): Promise<unknown> {
    return this.client.downloadJson(walrusBlobId);
  }
  async estimateTodoStorageCost(
    data: unknown,
    epochs: number
  ): Promise<{
    totalCost: bigint;
    sizeBytes: number;
    storageCost: bigint;
    writeCost: bigint;
  }> {
    const sizeBytes = JSON.stringify(data).length;
    const writeCost = BigInt(sizeBytes);
    const storageCost = BigInt(sizeBytes) * BigInt(epochs);
    return {
      totalCost: writeCost + storageCost,
      sizeBytes,
      storageCost,
      writeCost,
    };
  }
}
