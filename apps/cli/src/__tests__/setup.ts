import { expect, jest } from '@jest/globals';
import { forceGC, logMemoryUsage } from './helpers/memory-utils';

// Configure Jest timeout for CLI tests
jest.setTimeout(15000);

// CLI-specific mocks (reduced - using real implementations where possible)
// Only mock external network calls and blockchain operations for unit tests

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Ensure test environment is set
  process.env.NODE_ENV = 'test';
  // Removed WALRUS_USE_MOCK - using real implementations
  
  // Force garbage collection
  forceGC();
});

// Clean up after each test
afterEach(() => {
  // Force garbage collection
  forceGC();
});

// Log memory usage after all tests
afterAll(() => {
  logMemoryUsage('CLI Tests Final');
  forceGC();
});

// Setup test to verify test environment
describe('CLI Setup Test', () => {
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(true).toBe(true);
  });
});
