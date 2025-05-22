/**
 * Direct Walrus HTTP client for browser-based storage
 * Implements blob upload/download without backend dependency
 */

import testnetConfig from '@/config/testnet.json';

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

  constructor() {
    this.publisherUrl = testnetConfig.walrus.publisherUrl;
    this.aggregatorUrl = testnetConfig.walrus.aggregatorUrl;
  }

  /**
   * Upload data to Walrus storage
   */
  async upload(data: Uint8Array | string, options?: {
    epochs?: number;
    contentType?: string;
  }): Promise<WalrusUploadResponse> {
    try {
      // Convert string to Uint8Array if needed
      const blobData = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      // Prepare the request
      const formData = new FormData();
      const blob = new Blob([blobData], { 
        type: options?.contentType || 'application/octet-stream' 
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
          'Content-Type': options?.contentType || 'application/octet-stream'
        }
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
        cost: blobInfo.cost || 0
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
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || undefined;

      return {
        id: blobId,
        data: new Uint8Array(data),
        contentType
      };
    } catch (error) {
      console.error('Walrus download error:', error);
      throw error;
    }
  }

  /**
   * Upload JSON data
   */
  async uploadJson(data: any, options?: { epochs?: number }): Promise<WalrusUploadResponse> {
    const jsonString = JSON.stringify(data);
    return this.upload(jsonString, {
      ...options,
      contentType: 'application/json'
    });
  }

  /**
   * Download and parse JSON data
   */
  async downloadJson<T = any>(blobId: string): Promise<T> {
    const blob = await this.download(blobId);
    const text = new TextDecoder().decode(blob.data);
    return JSON.parse(text);
  }

  /**
   * Upload an image file
   */
  async uploadImage(file: File, options?: { epochs?: number }): Promise<WalrusUploadResponse> {
    const data = await file.arrayBuffer();
    return this.upload(new Uint8Array(data), {
      ...options,
      contentType: file.type
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
    try {
      const response = await fetch(`${this.aggregatorUrl}/v1/${blobId}`, {
        method: 'HEAD'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const walrusClient = new WalrusClient();