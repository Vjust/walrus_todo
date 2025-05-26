/**
 * Direct Walrus HTTP client for browser-based storage
 * Implements blob upload/download without backend dependency
 */

import { loadAppConfig } from '@/lib/config-loader';

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
    }
  ): Promise<WalrusUploadResponse> {
    await this.ensureConfigLoaded();
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

      // Make the upload request
      const response = await fetch(url.toString(), {
        method: 'PUT',
        body: blobData,
        headers: {
          'Content-Type': options?.contentType || 'application/octet-stream',
        },
      });

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

      return {
        blobId: blobInfo.blobId,
        size: blobInfo.size || blobData.length,
        encodedSize: blobInfo.encodedSize || blobData.length,
        cost: blobInfo.cost || 0,
      };
    } catch (error) {
      console.error('Walrus upload error:', error);
      throw error;
    }
  }

  /**
   * Download data from Walrus storage
   */
  async download(blobId: string): Promise<WalrusBlob> {
    await this.ensureConfigLoaded();
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || undefined;

      return {
        id: blobId,
        data: new Uint8Array(data),
        contentType,
      };
    } catch (error) {
      console.error('Walrus download error:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data
   */
  async uploadJson(
    data: unknown,
    options?: { epochs?: number }
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
    options?: { epochs?: number }
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
    // Stub: implement deletion logic if needed
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
   * Get WAL balance (stub)
   */
  async getWalBalance(): Promise<string> {
    return '0';
  }

  /**
   * Get storage usage (stub)
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    return { used: '0', total: '0' };
  }
}

// Singleton instance
export const walrusClient = new WalrusClient();

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
