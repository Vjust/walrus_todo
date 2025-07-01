/**
 * Credential Test Helpers
 *
 * Utilities for testing credential and encryption services safely
 */

import crypto from 'crypto';
import { AI_CONFIG } from '../constants';

/**
 * Create test-safe encryption key
 */
export function createTestEncryptionKey(): Buffer {
  return Buffer.alloc(32, 'a'); // Fixed key for consistent tests
}

/**
 * Create test-safe crypto mocks that work with the real encryption flow
 */
export function createCryptoMocks() {
  const mockCipher = {
    update: jest.fn().mockReturnValue(Buffer.from('encrypted')),
    final: jest.fn().mockReturnValue(Buffer.from('final')),
    getAuthTag: jest.fn().mockReturnValue(Buffer.alloc(16, 'tag')),
    setAAD: jest.fn(),
  };

  const mockDecipher = {
    update: jest.fn().mockReturnValue(Buffer.from('decrypted')),
    final: jest.fn().mockReturnValue(Buffer.from('')),
    setAuthTag: jest.fn(),
    setAAD: jest.fn(),
  };

  return {
    randomBytes: jest.fn((size: number) => Buffer.alloc(size, 'a')),
    createCipheriv: jest.fn(() => mockCipher),
    createDecipheriv: jest.fn(() => mockDecipher),
    pbkdf2Sync: jest.fn(() => Buffer.alloc(32, 'derived')),
    randomUUID: jest.fn(() => 'test-uuid'),
  };
}

/**
 * Validate test environment setup
 */
export function validateTestEnvironment(): boolean {
  return process.env?.NODE_ENV === 'test' || process.env?.NODE_ENV === 'testing';
}

/**
 * Get test-safe encryption config
 */
export function getTestEncryptionConfig() {
  return {
    ALGORITHM: 'aes-256-gcm',
    KEY_SIZE: 32,
    IV_SIZE: 16,
    SALT_SIZE: 32,
    KEY_ITERATIONS: validateTestEnvironment()
      ? 1000
      : AI_CONFIG?.CREDENTIAL_ENCRYPTION?.KEY_ITERATIONS,
  };
}

/**
 * Create test credential metadata
 */
export function createTestCredentialMetadata() {
  return {
    id: 'test-credential-id',
    provider: 'test-provider',
    type: 'API_KEY',
    permissionLevel: 'STANDARD',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    authFailCount: 0,
    rotationRequired: false,
    metadata: { test: true },
  };
}

/**
 * Setup test environment variables
 */
export function setupTestEnvironment() {
  process.env?.NODE_ENV = 'test';
  process.env?.HOME = '/tmp/test-home';

  // Set test-safe defaults for encryption
  process.env?.CREDENTIAL_KEY_ITERATIONS = '1000';
  process.env?.CREDENTIAL_AUTO_ROTATION_DAYS = '90';
  process.env?.CREDENTIAL_ROTATION_WARNING_DAYS = '75';
  process.env?.CREDENTIAL_MAX_FAILED_AUTH = '5';
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment() {
  delete process?.env?.NODE_ENV;
  delete process?.env?.HOME;
  delete process?.env?.CREDENTIAL_KEY_ITERATIONS;
  delete process?.env?.CREDENTIAL_AUTO_ROTATION_DAYS;
  delete process?.env?.CREDENTIAL_ROTATION_WARNING_DAYS;
  delete process?.env?.CREDENTIAL_MAX_FAILED_AUTH;
}

/**
 * Create file system mocks for credential tests
 */
export function createFileSystemMocks() {
  const mockData = new Map<string, Buffer | string>();

  return {
    existsSync: jest.fn((path: string) => mockData.has(path)),
    readFileSync: jest.fn((path: string) => {
      const data = mockData.get(path);
      if (!data) throw new Error(`File not found: ${path}`);
      return data;
    }),
    writeFileSync: jest.fn(
      (path: string, data: Buffer | string, options?: any) => {
        mockData.set(path, data);
      }
    ),
    mkdirSync: jest.fn(),
    copyFileSync: jest.fn(),
    chmodSync: jest.fn(),
    renameSync: jest.fn(),
    unlinkSync: jest.fn((path: string) => mockData.delete(path)),
    readdirSync: jest.fn(() => []),
    statSync: jest.fn(() => ({ mtime: { getTime: () => Date.now() } })),
    constants: { COPYFILE_EXCL: 1 },
    setMockData: (path: string, data: Buffer | string) =>
      mockData.set(path, data),
    getMockData: (path: string) => mockData.get(path),
    clearMockData: () => mockData.clear(),
  };
}
