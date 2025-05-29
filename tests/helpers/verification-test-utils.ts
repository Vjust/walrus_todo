import { jest } from '@jest/globals';
import { AIVerificationService } from '../../apps/cli/src/services/ai/AIVerificationService';
import { BlockchainAIVerificationService } from '../../apps/cli/src/services/ai/BlockchainAIVerificationService';
import { BlockchainVerifier } from '../../apps/cli/src/services/ai/BlockchainVerifier';
import {
  AIActionType,
  AIPrivacyLevel,
  VerificationRecord,
  AIVerifierAdapter,
} from '../../apps/cli/src/types/adapters/AIVerifierAdapter';
import { createMockAIVerifierAdapter as baseMockAIVerifierAdapter } from '../mocks/AIVerifierAdapter.mock';

/**
 * Create a complete mock verification record
 */
export function createMockVerificationRecord(
  overrides: Partial<VerificationRecord> = {}
): VerificationRecord {
  return {
    id: 'test-verification-id',
    requestHash: 'test-request-hash',
    responseHash: 'test-response-hash',
    user: 'test-user',
    provider: 'test-provider',
    timestamp: Date.now(),
    verificationType: AIActionType.SUMMARIZE,
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a mock AIVerifierAdapter with all required methods
 * Uses the canonical mock implementation with custom behavior overlay
 */
export function createMockAIVerifierAdapter(
  customBehavior: Partial<AIVerifierAdapter> = {}
): jest.Mocked<AIVerifierAdapter> {
  const baseMock = baseMockAIVerifierAdapter();
  
  // Apply custom behavior overrides if provided
  return {
    ...baseMock,
    ...customBehavior,
  } as jest.Mocked<AIVerifierAdapter>;
}

/**
 * Create a mock BlockchainVerifier with all required methods
 */
export function createMockBlockchainVerifier(
  customBehavior: Partial<BlockchainVerifier> = {}
): jest.Mocked<BlockchainVerifier> {
  const mockRecord = createMockVerificationRecord();
  const mockAdapter = createMockAIVerifierAdapter();

  return {
    verifyOperation: jest.fn().mockResolvedValue(mockRecord),
    verifyCredential: jest.fn().mockResolvedValue({
      isValid: true,
      verificationId: 'test-credential-verification',
      timestamp: Date.now(),
    }),
    verifyRecord: jest.fn().mockResolvedValue(true),
    getVerification: jest.fn().mockResolvedValue(mockRecord),
    listVerifications: jest.fn().mockResolvedValue([mockRecord]),
    retrieveVerificationData: jest.fn().mockResolvedValue({
      request: 'test-request',
      response: 'test-response',
    }),
    generateVerificationProof: jest
      .fn()
      .mockResolvedValue('test-verification-proof'),
    verifyProof: jest
      .fn()
      .mockResolvedValue({ isValid: true, record: mockRecord }),
    getVerifierAdapter: jest.fn().mockReturnValue(mockAdapter),
    getCredentialAdapter: jest.fn().mockReturnValue(undefined),
    getSigner: jest.fn().mockReturnValue({
      getPublicKey: jest.fn().mockReturnValue({
        toBase64: jest.fn().mockReturnValue('test-public-key'),
      }),
      toSuiAddress: jest.fn().mockReturnValue('test-sui-address'),
    }),
    generateProof: jest.fn().mockResolvedValue('test-proof-string'),
    exportVerifications: jest.fn().mockResolvedValue('test-export'),
    enforceRetentionPolicy: jest.fn().mockResolvedValue(0),
    securelyDestroyData: jest.fn().mockResolvedValue(true),
    deleteVerification: jest.fn().mockResolvedValue(true),
    verifySignature: jest.fn().mockResolvedValue(true),
    setCredentialAdapter: jest.fn(),
    setWalrusAdapter: jest.fn(),
    ...customBehavior,
  } as jest.Mocked<BlockchainVerifier>;
}

/**
 * Create a mock permission manager
 */
export function createMockPermissionManager(customBehavior: any = {}) {
  return {
    checkPermission: jest.fn().mockResolvedValue(true),
    getPermissionLevel: jest.fn().mockResolvedValue(1), // STANDARD level
    setPermissionLevel: jest.fn().mockResolvedValue(true),
    getAllowedOperations: jest.fn().mockResolvedValue(['summarize', 'analyze']),
    verifyOperationPermission: jest.fn().mockResolvedValue({
      allowed: true,
      verificationId: 'test-permission-verification',
    }),
    ...customBehavior,
  };
}

/**
 * Create a mock credential manager
 */
export function createMockCredentialManager(customBehavior: any = {}) {
  return {
    getCredential: jest.fn().mockResolvedValue('test-api-key'),
    setCredential: jest.fn().mockResolvedValue({
      id: 'test-credential-id',
      providerName: 'test-provider',
      credentialType: 'api_key',
      credentialValue: 'test-api-key',
      isVerified: true,
      storageOptions: { encrypt: true },
      createdAt: Date.now(),
      permissionLevel: 1,
    }),
    hasCredential: jest.fn().mockResolvedValue(true),
    removeCredential: jest.fn().mockResolvedValue(true),
    verifyCredential: jest.fn().mockResolvedValue(true),
    updatePermissions: jest.fn().mockResolvedValue({
      providerName: 'test-provider',
      permissionLevel: 1,
    }),
    generateCredentialProof: jest
      .fn()
      .mockResolvedValue('test-credential-proof'),
    getCredentialObject: jest.fn().mockResolvedValue({
      id: 'test-credential-id',
      providerName: 'test-provider',
      credentialType: 'api_key',
      credentialValue: 'test-api-key',
      isVerified: true,
      storageOptions: { encrypt: true },
      createdAt: Date.now(),
      permissionLevel: 1,
    }),
    listCredentials: jest.fn().mockResolvedValue([]),
    setBlockchainAdapter: jest.fn(),
    ...customBehavior,
  };
}

/**
 * Create a properly mocked AIVerificationService
 */
export function createMockAIVerificationService(
  customBehavior: any = {}
): AIVerificationService {
  const mockAdapter = createMockAIVerifierAdapter(customBehavior.adapter);
  return new AIVerificationService(mockAdapter);
}

/**
 * Create a properly mocked BlockchainAIVerificationService
 */
export function createMockBlockchainAIVerificationService(
  customBehavior: any = {}
): BlockchainAIVerificationService {
  const mockBlockchainVerifier = createMockBlockchainVerifier(
    customBehavior.blockchainVerifier
  );
  const mockPermissionManager = createMockPermissionManager(
    customBehavior.permissionManager
  );
  const mockCredentialManager = createMockCredentialManager(
    customBehavior.credentialManager
  );

  return new BlockchainAIVerificationService(
    mockBlockchainVerifier as any,
    mockPermissionManager as any,
    mockCredentialManager as any,
    customBehavior.defaultProvider || 'test-provider'
  );
}

/**
 * Assert that a function returns a proper promise
 */
export function assertReturnsPromise<T>(fn: () => Promise<T>): void {
  const result = fn();
  expect(result).toBeInstanceOf(Promise);
  expect(typeof result.then).toBe('function');
  expect(typeof result.catch).toBe('function');
}

/**
 * Assert that a verification operation completes successfully
 */
export async function assertVerificationSuccess<T>(
  verificationPromise: Promise<T>,
  expectedType?: string
): Promise<T> {
  // Ensure it's a promise
  expect(verificationPromise).toBeInstanceOf(Promise);

  // Wait for completion
  const result = await verificationPromise;

  // Ensure result is not undefined
  expect(result).toBeDefined();
  expect(result).not.toBeNull();

  // Check type if specified
  if (expectedType) {
    expect(typeof result).toBe(expectedType);
  }

  return result;
}

/**
 * Assert that a verification operation fails with expected error
 */
export async function assertVerificationFailure(
  verificationPromise: Promise<any>,
  expectedErrorMessage?: string | RegExp
): Promise<Error> {
  // Ensure it's a promise
  expect(verificationPromise).toBeInstanceOf(Promise);

  // Expect it to reject
  await expect(verificationPromise).rejects.toThrow(expectedErrorMessage);

  try {
    await verificationPromise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    return error as Error;
  }
}
