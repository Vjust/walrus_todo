/**
 * Comprehensive WalrusClient mock implementation
 * 
 * This mock provides all required methods that test files need for WalrusClient,
 * including getBlobSize, getStorageProviders, reset, and all other methods used
 * throughout the test suite.
 * 
 * NOTE: This file now uses the complete implementation from complete-walrus-client-mock.ts
 * for consistency and completeness.
 */

// Unused imports removed during TypeScript cleanup
// import type { BlobObject } from '../../apps/cli/src/types/walrus';
import { 
  createCompleteWalrusClientMock,
  type CompleteWalrusClientMock 
} from './complete-walrus-client-mock';

/**
 * Complete WalrusClient mock interface matching WalrusClientExt
 * @deprecated Use CompleteWalrusClientMock from complete-walrus-client-mock.ts instead
 */
export interface MockWalrusClient extends CompleteWalrusClientMock {}

/**
 * Creates a comprehensive WalrusClient mock with all required methods
 * @deprecated Use createCompleteWalrusClientMock from complete-walrus-client-mock.ts instead
 */
export function createWalrusClientMock(): MockWalrusClient {
  return createCompleteWalrusClientMock();
}

/**
 * Sets up default mock responses for WalrusClient
 * @deprecated Defaults are automatically set up in createCompleteWalrusClientMock
 */
export function setupDefaultWalrusClientMocks(_mockClient: MockWalrusClient): void {
  // Default implementations are now handled in the complete mock
  // This function is kept for backward compatibility but does nothing
}

/**
 * Jest mock factory for @mysten/walrus WalrusClient
 * @deprecated Use getMockWalrusClient from complete-walrus-client-mock.ts instead
 */
export const WalrusClientMockFactory = () => {
  return createCompleteWalrusClientMock();
};

/**
 * Complete Jest module mock for @mysten/walrus
 */
export const walrusModuleMock = {
  WalrusClient: jest.fn().mockImplementation(() => createCompleteWalrusClientMock()),
  // Export additional types that might be imported
  BlobObject: {},
  BlobInfo: {},
  BlobMetadataShape: {},
};

/**
 * Default export for direct import
 */
export default walrusModuleMock;