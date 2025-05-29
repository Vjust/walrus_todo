/**
 * Global mock setup for Jest tests
 * This file provides global mock definitions that can be used across all test files
 */

import { jest } from '@jest/globals';
import {
  createTodoServiceClassMock,
  createSuiClientClassMock,
  createSuiNftStorageClassMock,
  MockSuiClientClass,
} from '../mocks';

// Global mock classes
global.MockTodoService = createTodoServiceClassMock();
global.MockSuiClient = createSuiClientClassMock();
global.MockSuiNftStorage = createSuiNftStorageClassMock();

// Make SuiClient available globally for tests that reference it without proper imports
// @ts-ignore - Global assignment for test compatibility
global.SuiClient = MockSuiClientClass;

// Setup global Jest mocks for common modules
jest.mock('@mysten/sui/client', () => ({
  SuiClient: global.MockSuiClient,
  getFullnodeUrl: jest.fn(() => 'https://test.endpoint'),
}));

jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn().mockImplementation(() => ({
    getPublicKey: jest.fn().mockReturnValue({
      toSuiAddress: jest.fn().mockReturnValue('0xtest-address'),
    }),
    signData: jest.fn().mockResolvedValue(new Uint8Array()),
  })),
}));

// Mock Walrus client
jest.mock('@mysten/walrus', () => ({
  WalrusClient: jest.fn().mockImplementation(() => ({
    readBlob: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    writeBlob: jest.fn().mockResolvedValue({
      blobId: 'mock-blob-id',
      blobObject: { id: { id: 'mock-blob-id' } },
    }),
  })),
}));

// Ensure console methods don't interfere with test output in CI
if (process.env.CI) {
  const originalLog = console.log;
  const originalError = console.error;

  console.log = jest.fn((...args) => {
    if (process.env.DEBUG) {
      originalLog(...args);
    }
  });

  console.error = jest.fn((...args) => {
    if (process.env.DEBUG) {
      originalError(...args);
    }
  });
}
