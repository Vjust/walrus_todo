import { randomBytes } from 'crypto';

/**
 * Generate a mock blob ID for testing
 */
export function generateMockBlobId(): string {
  return `MOCK_${randomBytes(8).toString('hex')}`;
}

/**
 * Mock response for Walrus storage
 */
export interface MockStorageResponse {
  blobId: string;
  size: number;
  timestamp: string;
}

/**
 * Create a mock storage response
 */
export function createMockStorageResponse(size: number): MockStorageResponse {
  return {
    blobId: generateMockBlobId(),
    size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Simulate network delay for more realistic testing
 */
export async function simulateNetworkDelay(minMs: number = 50, maxMs: number = 200): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Mock file stats for testing
 */
export interface MockFileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtime: Date;
}

/**
 * Create mock file stats
 */
export function createMockFileStats(size: number): MockFileStats {
  return {
    size,
    isFile: true,
    isDirectory: false,
    mtime: new Date(),
  };
}