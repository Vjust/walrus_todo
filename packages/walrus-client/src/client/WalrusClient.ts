/**
 * Universal Walrus Client for Node.js and Browser
 * Consolidates functionality from CLI and frontend implementations
 */

import type { 
  WalrusUploadResponse, 
  WalrusBlob, 
  WalrusUploadOptions,
  WalrusStorageInfo,
  WalrusClientAdapter,
  UniversalSigner
} from '../types';
import { WalrusConfig } from '../config/WalrusConfig';
import { RetryManager } from '../utils/RetryManager';
import { ErrorHandler } from '../utils/ErrorHandler';
import { universalFetch, RUNTIME } from '../utils/environment';
import { 
  WalrusClientError, 
  WalrusNetworkError, 
  WalrusValidationError,
  WalrusStorageError 
} from '../errors';
import { API_ENDPOINTS, DEFAULT_UPLOAD_OPTIONS } from '../constants';

export class WalrusClient implements WalrusClientAdapter {
  private config: WalrusConfig;
  private retryManager: RetryManager;

  constructor(config?: WalrusConfig | string) {
    if (typeof config === 'string') {
      this.config = WalrusConfig.forNetwork(config as any);
    } else if (config instanceof WalrusConfig) {
      this.config = config;
    } else {
      this.config = new WalrusConfig(config);
    }

    this.retryManager = new RetryManager({
      maxRetries: this.config.getRetries(),
      timeout: this.config.getTimeout(),
      shouldRetry: ErrorHandler.isRetryableError,
    });
  }

  async getConfig() {
    return this.config.get();
  }

  /**
   * Upload data to Walrus storage
   */
  async upload(
    data: Uint8Array | string,
    options: WalrusUploadOptions = {}
  ): Promise<WalrusUploadResponse> {
    const mergedOptions = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
    
    return this.retryManager.execute(async () => {
      const blobData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      
      if (blobData.length === 0) {
        throw new WalrusValidationError('Cannot upload empty data');
      }

      const url = new URL(`${this.config.getPublisherUrl()}${API_ENDPOINTS.STORE}`);
      
      if (mergedOptions.epochs) {
        url.searchParams.append('epochs', mergedOptions.epochs.toString());
      }

      mergedOptions.onProgress?.('Uploading to Walrus...', 0);

      const response = await universalFetch(url.toString(), {
        method: 'PUT',
        body: blobData,
        headers: {
          'Content-Type': mergedOptions.contentType || 'application/octet-stream',
        },
      });

      if (!response.ok) {
        const errorMessage = await ErrorHandler.extractErrorMessage(response);
        throw ErrorHandler.createErrorFromResponse(response);
      }

      mergedOptions.onProgress?.('Processing response...', 90);

      const result = await response.json();
      
      // Handle different response formats from Walrus
      const blobInfo = result.newlyCreated || result.alreadyCertified;
      if (!blobInfo?.blobId) {
        throw new WalrusStorageError('Invalid response format from Walrus', 'upload');
      }

      mergedOptions.onProgress?.('Upload complete', 100);

      return {
        blobId: blobInfo.blobId,
        size: blobInfo.size || blobData.length,
        encodedSize: blobInfo.encodedSize || blobData.length,
        cost: blobInfo.cost || 0,
        transactionId: blobInfo.transactionId,
        explorerUrl: blobInfo.explorerUrl,
      };
    }, 'upload');
  }

  /**
   * Download data from Walrus storage
   */
  async download(blobId: string): Promise<WalrusBlob> {
    this.validateBlobId(blobId);

    return this.retryManager.execute(async () => {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'download', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || undefined;

      return {
        id: blobId,
        data: new Uint8Array(data),
        contentType,
        size: data.byteLength,
      };
    }, 'download');
  }

  /**
   * Check if a blob exists
   */
  async exists(blobId: string): Promise<boolean> {
    this.validateBlobId(blobId);

    try {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'HEAD',
      });

      return response.ok;
    } catch (error) {
      // If it's a network error, we can't determine existence
      if (ErrorHandler.isRetryableError(error as Error)) {
        throw ErrorHandler.wrapError(error, `Failed to check existence of blob ${blobId}`);
      }
      return false;
    }
  }

  /**
   * Delete a blob (if deletable)
   */
  async delete(blobId: string, signer?: UniversalSigner): Promise<string> {
    this.validateBlobId(blobId);

    return this.retryManager.execute(async () => {
      const url = `${this.config.getPublisherUrl()}${API_ENDPOINTS.DELETE.replace('{blobId}', blobId)}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication if signer is provided
      if (signer) {
        // This would need to be implemented based on Walrus auth requirements
        // For now, we'll just include the address
        const address = typeof signer.getAddress === 'function' 
          ? await signer.getAddress() 
          : signer.toSuiAddress();
        headers['X-Wallet-Address'] = address;
      }

      const response = await universalFetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'delete', blobId);
        }
        if (response.status === 403) {
          throw new WalrusStorageError(`Blob is not deletable: ${blobId}`, 'delete', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      return blobId;
    }, 'delete');
  }

  /**
   * Get blob information
   */
  async getBlobInfo(blobId: string): Promise<{ size?: number }> {
    this.validateBlobId(blobId);

    try {
      const url = `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
      
      const response = await universalFetch(url, {
        method: 'HEAD',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new WalrusStorageError(`Blob not found: ${blobId}`, 'getBlobInfo', blobId);
        }
        throw ErrorHandler.createErrorFromResponse(response);
      }

      const contentLength = response.headers.get('content-length');
      const size = contentLength ? parseInt(contentLength) : undefined;

      return { size };
    } catch (error) {
      throw ErrorHandler.wrapError(error, `Failed to get blob info for ${blobId}`);
    }
  }

  /**
   * Calculate storage costs
   */
  async calculateStorageCost(
    size: number,
    epochs: number
  ): Promise<{ totalCost: bigint; storageCost: bigint; writeCost: bigint }> {
    if (size <= 0) {
      throw new WalrusValidationError('Size must be positive', 'size', size);
    }
    if (epochs <= 0) {
      throw new WalrusValidationError('Epochs must be positive', 'epochs', epochs);
    }

    // Simple cost calculation - would need to be updated based on actual Walrus pricing
    const writeCost = BigInt(Math.ceil(size / 1024)); // Cost per KB
    const storageCost = BigInt(epochs) * writeCost;
    const totalCost = writeCost + storageCost;

    return {
      totalCost,
      storageCost,
      writeCost,
    };
  }

  /**
   * Get WAL balance (stub - would need actual implementation)
   */
  async getWalBalance(): Promise<string> {
    // This would require integration with Sui wallet
    return '0';
  }

  /**
   * Get storage usage (stub - would need actual implementation)
   */
  async getStorageUsage(): Promise<{ used: string; total: string }> {
    // This would require querying storage objects
    return { used: '0', total: '0' };
  }

  /**
   * Upload JSON data
   */
  async uploadJson(
    data: unknown,
    options?: WalrusUploadOptions
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
    
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new WalrusValidationError(
        `Invalid JSON in blob ${blobId}`,
        'json',
        text.substring(0, 100)
      );
    }
  }

  /**
   * Upload image file (for browser use with File objects)
   */
  async uploadImage(
    file: File,
    options?: WalrusUploadOptions
  ): Promise<WalrusUploadResponse> {
    if (!RUNTIME.isBrowser) {
      throw new WalrusClientError('uploadImage with File objects is only available in browsers');
    }

    const data = await file.arrayBuffer();
    return this.upload(new Uint8Array(data), {
      ...options,
      contentType: file.type,
    });
  }

  /**
   * Get public URL for a blob
   */
  getBlobUrl(blobId: string): string {
    this.validateBlobId(blobId);
    return `${this.config.getAggregatorUrl()}${API_ENDPOINTS.BLOB.replace('{blobId}', blobId)}`;
  }

  /**
   * Get storage information for a blob
   */
  async getStorageInfo(blobId: string): Promise<WalrusStorageInfo> {
    const exists = await this.exists(blobId);
    
    if (!exists) {
      return { exists: false };
    }

    try {
      const blobInfo = await this.getBlobInfo(blobId);
      let storageCost;
      
      if (blobInfo.size) {
        storageCost = await this.calculateStorageCost(blobInfo.size, 5);
      }

      return {
        exists: true,
        size: blobInfo.size,
        storageCost,
      };
    } catch (error) {
      return { exists: true }; // We know it exists, but couldn't get details
    }
  }

  private validateBlobId(blobId: string): void {
    if (!blobId || typeof blobId !== 'string') {
      throw new WalrusValidationError('Blob ID must be a non-empty string', 'blobId', blobId);
    }
    
    // Basic validation - actual format may vary
    if (blobId.length < 10) {
      throw new WalrusValidationError('Blob ID appears to be too short', 'blobId', blobId);
    }
  }
}