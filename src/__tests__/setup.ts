import { jest } from '@jest/globals';

// Configure Jest timeout
jest.setTimeout(10000);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); import { describe, it, expect } from '@jest/globals';

describe('Setup Test', () => {
  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
