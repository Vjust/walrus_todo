import { jest } from '@jest/globals';
import { WalrusClientInterface } from '../../types';

// Simulated storage for blobs
const blobStorage = new Map<string, Uint8Array>();

// Error types matching the mock guide
class WalrusError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WalrusError';
  }
}

// Mock storage validation
const validateBlobData = (data: Uint8Array, size?: number) => {
  if (!data || !(data instanceof Uint8Array)) {
    throw new WalrusError('Invalid blob data format', 'INVALID_FORMAT');
  }
  if (size && data.length > size) {
    throw new WalrusError(`Blob size exceeds limit of ${size} bytes`, 'SIZE_EXCEEDED');
  }
};

// Mock WalrusClient class
export class WalrusClient implements WalrusClientInterface {
  private static instance: WalrusClient;
  public network: string = 'testnet';

  constructor(config?: any) {
    if (WalrusClient.instance) {
      return WalrusClient.instance;
    }
    WalrusClient.instance = this;
  }

  async writeBlob(data: Uint8Array, size?: number, isPublic?: boolean): Promise<string> {
    try {
      validateBlobData(data, size);
      const blobId = 'mock-blob-' + Math.random().toString(36).substr(2, 9);
      blobStorage.set(blobId, data);
      return blobId;
    } catch (error) {
      throw error;
    }
  }

  async readBlob(blobId: string): Promise<Uint8Array> {
    const data = blobStorage.get(blobId);
    if (!data) {
      throw new WalrusError('Blob not found', 'NOT_FOUND');
    }
    return data;
  }

  isConnected(): boolean {
    return true;
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async connect(): Promise<void> {
    return Promise.resolve();
  }
}

// Reset functionality with storage clear
export const resetMocks = () => {
  blobStorage.clear();
  jest.clearAllMocks();
};

// Helper for test setup
export const setupMockTodos = (todos: any[]) => {
  const blobId = 'mock-todos-blob';
  const data = Buffer.from(JSON.stringify({ todos }));
  blobStorage.set(blobId, data);
  return blobId;
}; 