import { expect, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

// Setup TextDecoder/TextEncoder for image-size
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// Configure Jest timeout
jest.setTimeout(10000);

// Ensure mocks are applied
jest.mock('@mysten/sui/dist/cjs/client');
jest.mock('@mysten/sui/dist/cjs/cryptography');
jest.mock('@mysten/sui/dist/cjs/keypairs/ed25519');
jest.mock('@mysten/sui/transactions');

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Configure Jest matchers - these are already included with Jest types
// Remove custom declarations to avoid conflicts

// Setup test
describe('Setup Test', () => {
  it('should have at least one test', () => {
    expect(true).toBe(true);
  });
});
