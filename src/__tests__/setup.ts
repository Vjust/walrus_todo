import { jest } from '@jest/globals';

// Configure Jest timeout
jest.setTimeout(10000);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 