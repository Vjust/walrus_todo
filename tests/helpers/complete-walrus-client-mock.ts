/**
 * Complete WalrusClient Mock Implementation for tests/ directory
 * 
 * This is a mirror of the complete mock from apps/cli/src/__tests__/helpers/
 * to ensure all test directories have access to the same comprehensive mock.
 */

// Re-export everything from the main implementation
export * from '../../apps/cli/src/__tests__/helpers/complete-walrus-client-mock';

// Direct import for convenience
import { 
  createCompleteWalrusClientMock,
  setupDefaultMockImplementations,
  createWalrusModuleMock,
  getMockWalrusClient,
  type CompleteWalrusClientMock
} from '../../apps/cli/src/__tests__/helpers/complete-walrus-client-mock';

// Re-export for backward compatibility
export {
  createCompleteWalrusClientMock,
  setupDefaultMockImplementations,
  createWalrusModuleMock as walrusModuleMock,
  getMockWalrusClient,
  type CompleteWalrusClientMock
};

/**
 * Convenience function for tests that need to quickly get a mock
 */
export function createWalrusClientMock(): CompleteWalrusClientMock {
  return createCompleteWalrusClientMock();
}

/**
 * Legacy interface for backward compatibility
 */
export interface MockWalrusClient extends CompleteWalrusClientMock {}

/**
 * Legacy factory function for backward compatibility
 */
export const WalrusClientMockFactory = getMockWalrusClient;