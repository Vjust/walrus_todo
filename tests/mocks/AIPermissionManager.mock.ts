const { jest } = require('@jest/globals');

/**
 * Mock implementation of AIPermissionManager for testing
 */
export interface MockAIPermissionManager {
  checkPermission: jest.MockedFunction<(provider: string, operation: string) => boolean>;
  verifyOperationPermission: jest.MockedFunction<(operation: string) => Promise<void>>;
  updatePermissions: jest.MockedFunction<(provider: string, permissions: string[]) => Promise<void>>;
  getPermissions: jest.MockedFunction<(provider: string) => Promise<string[]>>;
}

/**
 * Creates a mock AIPermissionManager instance
 */
export function createMockAIPermissionManager(): MockAIPermissionManager {
  return {
    checkPermission: jest.fn().mockImplementation((provider: string, operation: string) => {
      // Default permission logic for testing
      // Allow most operations except restricted ones
      const restrictedOperations = ['analyze', 'blockchain_verification'];
      
      // Special provider-specific rules
      if (provider === 'xai') {
        return operation === 'summarize'; // XAI only allowed to summarize
      }
      
      if (provider === 'anthropic') {
        return true; // Anthropic allowed for all operations
      }
      
      // For other providers, allow everything except restricted operations
      return !restrictedOperations.includes(operation);
    }),
    
    verifyOperationPermission: jest.fn().mockImplementation(async (operation: string) => {
      const allowedOperations = ['summarize', 'categorize', 'suggest'];
      if (!allowedOperations.includes(operation)) {
        throw new Error(`Operation "${operation}" is not permitted`);
      }
    }),
    
    updatePermissions: jest.fn().mockImplementation(async (provider: string, permissions: string[]) => {
      // Simulate permission update logic
      const adminOperations = ['admin', 'delete_all', 'system_access'];
      const hasAdminPermission = permissions.some(p => adminOperations.includes(p));
      
      if (hasAdminPermission) {
        throw new Error('Unauthorized permission escalation attempt');
      }
    }),
    
    getPermissions: jest.fn().mockImplementation(async (provider: string) => {
      // Return default permissions for the provider
      const defaultPermissions: Record<string, string[]> = {
        'xai': ['summarize'],
        'anthropic': ['summarize', 'categorize', 'suggest', 'analyze'],
        'openai': ['summarize', 'categorize', 'suggest'],
      };
      
      return defaultPermissions[provider] || ['summarize'];
    }),
  };
}

/**
 * Mock initializePermissionManager function
 */
export const mockInitializePermissionManager = jest.fn().mockImplementation(() => {
  return createMockAIPermissionManager();
});

/**
 * Mock getPermissionManager function
 */
export const mockGetPermissionManager = jest.fn().mockImplementation(() => {
  return createMockAIPermissionManager();
});

/**
 * Mock permission manager instance
 */
export const mockPermissionManager = createMockAIPermissionManager();