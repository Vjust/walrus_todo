import { expect, jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

// Setup TextDecoder/TextEncoder for image-size with proper typing
if (!global.TextDecoder) {
  (global as typeof globalThis).TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
if (!global.TextEncoder) {
  (global as typeof globalThis).TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

// Configure Jest timeout
jest.setTimeout(10000);

// Ensure mocks are applied
jest.mock('@mysten/sui/client');
jest.mock('@mysten/sui/cryptography');
jest.mock('@mysten/sui/keypairs/ed25519');
jest.mock('@mysten/sui/transactions');
jest.mock('../utils/adapters/sui-client-adapter');

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
