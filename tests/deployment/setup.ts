/**
 * @fileoverview Test setup for Walrus Sites deployment tests
 * 
 * Configures the testing environment with:
 * - Global mocks and utilities
 * - Environment variable setup
 * - Test data initialization
 * - Cleanup functions
 */

import 'jest-extended';

// Global test timeout for deployment operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };

beforeEach(() => {
  // Mock console.log and console.info for cleaner test output
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  
  // Keep console.error for debugging
  console.error = originalConsole.error;
});

afterEach(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  // Generate random test identifiers
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  // Create temporary file paths
  getTempPath: (filename: string) => `/tmp/walrus-test-${Date.now()}-${filename}`,
  
  // Mock network delays
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Test data generators
  generateMockConfig: (network: 'testnet' | 'mainnet' = 'testnet') => ({
    [`waltodo-${global.testUtils.generateTestId()}`]: {
      source: '/build',
      network,
      headers: {
        '/*': [`Cache-Control: public, max-age=${network === 'testnet' ? 3600 : 86400}`]
      }
    }
  }),
  
  // Environment setup
  setTestEnvironment: (env: Record<string, string>) => {
    const originalEnv = { ...process.env };
    Object.assign(process.env, env);
    return () => {
      process.env = originalEnv;
    };
  }
};

// Setup test environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.WALRUS_TEST_MODE = 'true';
  process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend global types
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUrl(): R;
      toBeValidWalrusUrl(): R;
      toContainDeploymentInfo(): R;
    }
  }
  
  var testUtils: {
    generateTestId: () => string;
    getTempPath: (filename: string) => string;
    delay: (ms: number) => Promise<void>;
    generateMockConfig: (network?: 'testnet' | 'mainnet') => any;
    setTestEnvironment: (env: Record<string, string>) => () => void;
  };
}

// Custom Jest matchers for deployment testing
expect.extend({
  toBeValidUrl(received: string) {
    const pass = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(received);
    return {
      message: () => 
        pass 
          ? `Expected ${received} not to be a valid URL`
          : `Expected ${received} to be a valid URL`,
      pass
    };
  },
  
  toBeValidWalrusUrl(received: string) {
    const pass = /^https:\/\/[a-z0-9]+\.walrus\.site$/i.test(received);
    return {
      message: () =>
        pass
          ? `Expected ${received} not to be a valid Walrus URL`
          : `Expected ${received} to be a valid Walrus URL (https://[id].walrus.site)`,
      pass
    };
  },
  
  toContainDeploymentInfo(received: any) {
    const requiredFields = ['success', 'siteUrl'];
    const hasRequiredFields = requiredFields.every(field => field in received);
    
    return {
      message: () =>
        hasRequiredFields
          ? `Expected deployment result not to contain required fields: ${requiredFields.join(', ')}`
          : `Expected deployment result to contain required fields: ${requiredFields.join(', ')}`,
      pass: hasRequiredFields
    };
  }
});

export {};